import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AddressesService } from '../addresses/addresses.service';
import { CartService } from '../cart/cart.service';
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
  ) {}

  /**
   * Turn the user's cart into a pending order + Stripe PaymentIntent. Prices are
   * snapshotted; the destination country (cart == address) drives price,
   * currency, shipping, and tax. Stock is only decremented once payment is
   * confirmed (webhook), but we validate availability here.
   */
  async checkout(userId: string, addressId: string): Promise<CheckoutResult> {
    const { cart } = await this.carts.resolveOrCreate({
      userId,
      cookieCartId: null,
    });
    const view = await this.carts.view(cart);
    if (view.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

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

    // Persist the pending order first (source of truth), then attach the PI.
    const order = await this.orders.save(
      Object.assign(new Order(), {
        userId,
        status: 'pending' as OrderStatus,
        currency,
        subtotalMinor,
        shippingMinor,
        taxMinor: tax.taxMinor,
        totalMinor,
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

  /** Mark paid + decrement stock + clear the cart. Idempotent. */
  async markPaidByPaymentIntent(paymentIntentId: string): Promise<void> {
    const order = await this.orders.findOne({
      where: { stripePaymentIntentId: paymentIntentId },
      relations: { items: true },
    });
    if (!order || order.status === 'paid') return;

    for (const item of order.items) {
      const ok = await this.products.decrementStock(item.productId, item.quantity);
      if (!ok) {
        this.logger.warn(
          `Order ${order.id}: could not decrement stock for ${item.productId}`,
        );
      }
    }
    order.status = 'paid';
    await this.orders.save(order);

    const { cart } = await this.carts.resolveOrCreate({
      userId: order.userId,
      cookieCartId: null,
    });
    await this.carts.clear(cart);
    this.logger.log(`Order ${order.id} paid`);
  }

  async markFailedByPaymentIntent(paymentIntentId: string): Promise<void> {
    await this.orders.update(
      { stripePaymentIntentId: paymentIntentId },
      { status: 'failed' },
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
    } else if (order.status === 'pending' && order.stripePaymentIntentId) {
      await this.stripe.cancelPaymentIntent(order.stripePaymentIntentId);
    }
    order.status = 'cancelled';
    await this.orders.save(order);
    this.logger.log(`Order ${order.id} cancelled`);
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
    const { fullyRefunded } = await this.stripe.refund(
      order.stripePaymentIntentId,
      amountMinor,
    );
    if (fullyRefunded) {
      await this.restock(order.items);
      order.status = 'refunded';
      await this.orders.save(order);
    }
    this.logger.log(`Order ${order.id} refunded (${fullyRefunded ? 'full' : 'partial'})`);
    return order;
  }

  /** Restore stock for a set of order lines. */
  async restock(items: OrderItem[]): Promise<void> {
    for (const item of items) {
      await this.products.incrementStock(item.productId, item.quantity);
    }
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

  listForUser(userId: string): Promise<Order[]> {
    return this.orders.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: { items: true },
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

  listAll(): Promise<Order[]> {
    return this.orders.find({
      order: { createdAt: 'DESC' },
      relations: { items: true },
    });
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    order.status = status;
    return this.orders.save(order);
  }
}
