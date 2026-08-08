import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AddressesService } from '../addresses/addresses.service';
import { CartService } from '../cart/cart.service';
import { MailService } from '../mail/mail.service';
import { ProductsService } from '../products/products.service';
import { ShippingService } from '../shipping/shipping.service';
import { StripeService } from '../stripe/stripe.service';
import { OrderItem } from './order-item.entity';
import { Order, OrderStatus } from './order.entity';

/** What checkout returns to the client (to confirm payment with Stripe). */
export interface CheckoutResult {
  orderId: string;
  status: OrderStatus;
  currency: string;
  amounts: {
    subtotalMinor: number;
    shippingMinor: number;
    taxMinor: number;
    totalMinor: number;
  };
  clientSecret: string | null;
  publishableKey: string;
}

/** Rough per-currency Stripe minimum charge (minor units); default 50. */
const MIN_CHARGE_MINOR: Record<string, number> = {
  usd: 50, eur: 50, gbp: 30, inr: 50, aud: 50, cad: 50, jpy: 50,
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly carts: CartService,
    private readonly addresses: AddressesService,
    private readonly shipping: ShippingService,
    private readonly products: ProductsService,
    private readonly stripe: StripeService,
    private readonly mail: MailService,
  ) {}

  /**
   * Turn the user's cart into a pending order + Stripe PaymentIntent. Prices are
   * snapshotted; the destination country (cart == address) drives price,
   * currency, shipping, and tax. Stock is only decremented once payment is
   * confirmed (webhook), but we validate availability here.
   */
  async checkout(
    userId: string,
    email: string,
    addressId: string,
  ): Promise<CheckoutResult> {
    const { cart } = await this.carts.resolveOrCreate({
      userId,
      cookieCartId: null,
    });
    const view = await this.carts.view(cart);
    if (view.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Idempotency: drop any earlier in-progress orders (+ their PaymentIntents)
    // so a re-checkout doesn't leave duplicate pending orders / live PIs.
    await this.cancelPendingForUser(userId);

    const address = await this.addresses.get(userId, addressId);
    if (address.country !== cart.country) {
      throw new BadRequestException(
        `Cart country (${cart.country}) must match the shipping country (${address.country})`,
      );
    }
    if (!view.currency) {
      throw new BadRequestException('Cart has no priced items for this country');
    }

    // Validate availability + build snapshotted line items.
    const items: OrderItem[] = [];
    for (const line of view.items) {
      if (!line.available || line.unitAmountMinor == null) {
        throw new BadRequestException(`"${line.name}" is not available here`);
      }
      if (line.quantity > line.stock) {
        throw new BadRequestException(`Not enough stock for "${line.name}"`);
      }
      items.push(
        Object.assign(new OrderItem(), {
          productId: line.productId,
          name: line.name,
          unitAmountMinor: line.unitAmountMinor,
          quantity: line.quantity,
        }),
      );
    }

    const currency = view.currency;
    const subtotalMinor = view.subtotalMinor;

    const rate = await this.shipping.getForCountry(cart.country);
    const shippingMinor =
      rate && rate.currency === currency ? rate.amountMinor : 0;

    const tax = await this.stripe.calculateTax({
      currency,
      lineItems: view.items.map((l) => ({
        amount: l.lineTotalMinor,
        reference: l.productId,
        quantity: l.quantity,
      })),
      shippingMinor,
      country: address.country,
      postalCode: address.postalCode,
      state: address.state,
      city: address.city,
      line1: address.line1,
    });

    const totalMinor = subtotalMinor + shippingMinor + tax.taxMinor;

    const min = MIN_CHARGE_MINOR[currency] ?? 50;
    if (totalMinor < min) {
      throw new BadRequestException(
        `Order total is below the minimum chargeable amount for ${currency.toUpperCase()}`,
      );
    }

    // Persist the pending order first (source of truth), then attach the PI.
    const order = await this.orders.save(
      Object.assign(new Order(), {
        userId,
        customerEmail: email,
        status: 'pending' as OrderStatus,
        currency,
        subtotalMinor,
        shippingMinor,
        taxMinor: tax.taxMinor,
        totalMinor,
        taxCalculationId: tax.calculationId,
        shippingAddress: {
          fullName: address.fullName,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
        },
        items,
      }),
    );

    const pi = await this.stripe.createPaymentIntent({
      amountMinor: totalMinor,
      currency,
      orderId: order.id,
      idempotencyKey: `order_${order.id}`,
    });
    order.stripePaymentIntentId = pi.id;
    await this.orders.save(order);

    return {
      orderId: order.id,
      status: order.status,
      currency,
      amounts: { subtotalMinor, shippingMinor, taxMinor: tax.taxMinor, totalMinor },
      clientSecret: pi.client_secret,
      publishableKey: '', // filled by the controller from config
    };
  }

  // ---- Payment lifecycle (called by the webhook) ----------------------------

  /**
   * Mark paid: atomically decrement stock for ALL lines. If any line can't be
   * fulfilled (raced to zero after checkout), roll back, AUTO-REFUND the whole
   * payment, and cancel the order — so we never keep money for something we
   * can't ship. On success: record tax, clear the cart. Idempotent.
   */
  async markPaidByPaymentIntent(paymentIntentId: string): Promise<void> {
    const order = await this.orders.findOne({
      where: { stripePaymentIntentId: paymentIntentId },
      relations: { items: true },
    });
    if (!order || !['pending', 'processing'].includes(order.status)) return;

    const decremented: OrderItem[] = [];
    let oversold = false;
    for (const item of order.items) {
      if (await this.products.decrementStock(item.productId, item.quantity)) {
        decremented.push(item);
      } else {
        oversold = true;
        break;
      }
    }

    if (oversold) {
      await this.restock(decremented); // roll back partial decrements
      if (order.stripePaymentIntentId) {
        await this.stripe.refund(order.stripePaymentIntentId); // full auto-refund
      }
      order.status = 'cancelled';
      order.refundedMinor = order.totalMinor;
      await this.orders.save(order);
      this.logger.warn(`Order ${order.id} oversold -> auto-refunded + cancelled`);
      this.mailOrder(order, 'cancelled');
      return;
    }

    order.status = 'paid';
    await this.orders.save(order);
    if (order.taxCalculationId) {
      await this.stripe.recordTax(order.taxCalculationId, order.id);
    }
    const { cart } = await this.carts.resolveOrCreate({
      userId: order.userId,
      cookieCartId: null,
    });
    await this.carts.clear(cart);
    this.logger.log(`Order ${order.id} paid`);
    this.mailOrder(order, 'paid');
  }

  async markProcessingByPaymentIntent(paymentIntentId: string): Promise<void> {
    await this.orders.update(
      { stripePaymentIntentId: paymentIntentId, status: 'pending' },
      { status: 'processing' },
    );
  }

  async markFailedByPaymentIntent(paymentIntentId: string): Promise<void> {
    await this.orders.update(
      { stripePaymentIntentId: paymentIntentId },
      { status: 'failed' },
    );
  }

  async markDisputedByPaymentIntent(paymentIntentId: string): Promise<void> {
    await this.orders.update(
      { stripePaymentIntentId: paymentIntentId },
      { status: 'disputed' },
    );
  }

  /**
   * Reconcile a FULL refund that happened outside the app (e.g. the Stripe
   * Dashboard). If the app already handled it (status cancelled/refunded) this
   * is a no-op, so we never double-restock.
   */
  async markRefundedByPaymentIntent(paymentIntentId: string): Promise<void> {
    const order = await this.orders.findOne({
      where: { stripePaymentIntentId: paymentIntentId },
      relations: { items: true },
    });
    if (!order || order.status === 'refunded' || order.status === 'cancelled') {
      return;
    }
    await this.restock(order.items);
    order.status = 'refunded';
    await this.orders.save(order);
    this.logger.log(`Order ${order.id} refunded (external)`);
  }

  // ---- Cancel / refund ------------------------------------------------------

  /** Customer cancels their own order. */
  cancelForUser(userId: string, id: string): Promise<Order> {
    return this.cancel(id, userId);
  }

  /** Admin cancels any order. */
  cancelAsAdmin(id: string): Promise<Order> {
    return this.cancel(id, null);
  }

  private async cancel(id: string, userId: string | null): Promise<Order> {
    const order = await this.loadOwned(id, userId);
    if (['shipped', 'delivered', 'fulfilled'].includes(order.status)) {
      throw new BadRequestException(
        'Order already shipped — request a return instead',
      );
    }
    if (['cancelled', 'refunded', 'failed'].includes(order.status)) {
      throw new BadRequestException(`Order is ${order.status}`);
    }

    if (order.status === 'paid' && order.stripePaymentIntentId) {
      await this.stripe.refund(order.stripePaymentIntentId); // full refund
      await this.restock(order.items); // paid => stock was decremented
      order.refundedMinor = order.totalMinor;
    } else if (order.status === 'pending' && order.stripePaymentIntentId) {
      await this.stripe.cancelPaymentIntent(order.stripePaymentIntentId);
    }
    order.status = 'cancelled';
    await this.orders.save(order);
    this.logger.log(`Order ${order.id} cancelled`);
    this.mailOrder(order, 'cancelled');
    return order;
  }

  /** Admin full/partial refund. Full refunds restore stock + mark refunded. */
  async refund(id: string, amountMinor?: number): Promise<Order> {
    const order = await this.loadOwned(id, null);
    if (!order.stripePaymentIntentId || order.status === 'pending') {
      throw new BadRequestException('Order has no captured payment to refund');
    }
    if (order.status === 'refunded' || order.status === 'cancelled') {
      throw new BadRequestException(`Order is ${order.status}`);
    }
    const refundAmount = amountMinor ?? order.totalMinor - order.refundedMinor;
    const { fullyRefunded } = await this.stripe.refund(
      order.stripePaymentIntentId,
      amountMinor,
    );
    order.refundedMinor = Math.min(
      order.totalMinor,
      order.refundedMinor + refundAmount,
    );
    if (fullyRefunded) {
      await this.restock(order.items);
      order.status = 'refunded';
    }
    await this.orders.save(order);
    this.logger.log(`Order ${order.id} refunded (${fullyRefunded ? 'full' : 'partial'})`);
    if (fullyRefunded) this.mailOrder(order, 'refunded');
    return order;
  }

  /** Cancel pending orders older than the cutoff (+ their PaymentIntents). */
  async sweepStalePending(olderThan: Date): Promise<number> {
    const stale = await this.orders.find({
      where: { status: 'pending', createdAt: LessThan(olderThan) },
    });
    for (const o of stale) {
      if (o.stripePaymentIntentId) {
        await this.stripe.cancelPaymentIntent(o.stripePaymentIntentId);
      }
      o.status = 'cancelled';
    }
    if (stale.length) await this.orders.save(stale);
    return stale.length;
  }

  /** Cancel any in-progress (pending) orders for a user + their PaymentIntents. */
  private async cancelPendingForUser(userId: string): Promise<void> {
    const pendings = await this.orders.find({
      where: { userId, status: 'pending' },
    });
    for (const o of pendings) {
      if (o.stripePaymentIntentId) {
        await this.stripe.cancelPaymentIntent(o.stripePaymentIntentId);
      }
      o.status = 'cancelled';
    }
    if (pendings.length) await this.orders.save(pendings);
  }

  /** Restore stock for a set of order lines. */
  async restock(items: OrderItem[]): Promise<void> {
    for (const item of items) {
      await this.products.incrementStock(item.productId, item.quantity);
    }
  }

  /** Persist an order entity (and its cascaded items). */
  saveEntity(order: Order): Promise<Order> {
    return this.orders.save(order);
  }

  /** Load an order, scoped to a user when userId is provided (else admin). */
  async loadOwned(id: string, userId: string | null): Promise<Order> {
    const order = await this.orders.findOne({
      where: userId ? { id, userId } : { id },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // ---- Queries / admin ------------------------------------------------------

  listForUser(userId: string, page = 1, limit = 20): Promise<Order[]> {
    return this.orders.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: { items: true },
      take: clamp(limit, 1, 100),
      skip: (Math.max(1, page) - 1) * clamp(limit, 1, 100),
    });
  }

  async getForUser(userId: string, id: string): Promise<Order> {
    const order = await this.orders.findOne({
      where: { id, userId },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  listAll(page = 1, limit = 50): Promise<Order[]> {
    return this.orders.find({
      order: { createdAt: 'DESC' },
      relations: { items: true },
      take: clamp(limit, 1, 200),
      skip: (Math.max(1, page) - 1) * clamp(limit, 1, 200),
    });
  }

  /**
   * Admin status change — restricted to the FULFILLMENT track. Money-states
   * (cancelled/refunded) must go through cancel()/refund() so the payment and
   * stock actually move; this endpoint can't be used to fake them.
   */
  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    const allowed: Partial<Record<OrderStatus, OrderStatus[]>> = {
      paid: ['fulfilled', 'shipped'],
      fulfilled: ['shipped'],
      shipped: ['delivered'],
    };
    if (!(allowed[order.status] ?? []).includes(status)) {
      throw new BadRequestException(
        `Cannot move ${order.status} -> ${status} here (use cancel/refund for money changes)`,
      );
    }
    order.status = status;
    const saved = await this.orders.save(order);
    if (status === 'shipped') this.mailOrder(saved, 'shipped');
    return saved;
  }

  /** Admin sets shipment tracking (carrier + number). */
  async setTracking(id: string, carrier: string, trackingNumber: string): Promise<Order> {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    order.carrier = carrier;
    order.trackingNumber = trackingNumber;
    return this.orders.save(order);
  }

  /** Best-effort order email (never blocks the request). */
  private mailOrder(order: Order, kind: 'paid' | 'shipped' | 'refunded' | 'cancelled') {
    if (!order.customerEmail) return;
    void this.mail.sendOrderUpdate(order.customerEmail, {
      orderId: order.id,
      kind,
      totalMinor: order.totalMinor,
      currency: order.currency,
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
    });
  }
}

/** Clamp a number into [min, max]. */
function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
