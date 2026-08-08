import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import { AddressesService } from '../addresses/addresses.service';
import { CartService } from '../cart/cart.service';
import { CashfreeService } from '../cashfree/cashfree.service';
import { CouponsService } from '../coupons/coupons.service';
import { EventsService } from '../events/events.service';
import { MailService } from '../mail/mail.service';
import { ProductsService } from '../products/products.service';
import { ShippingService } from '../shipping/shipping.service';
import { OrderItem } from './order-item.entity';
import { Order, OrderStatus } from './order.entity';

/** What checkout returns to the client (to complete payment with Cashfree). */
export interface CheckoutResult {
  orderId: string;
  reference: string;
  status: OrderStatus;
  currency: string;
  amounts: {
    subtotalMinor: number;
    discountMinor: number;
    shippingMinor: number;
    taxMinor: number;
    totalMinor: number;
  };
  paymentSessionId: string;
  appId: string;
  mode: string; // 'sandbox' | 'production' — for the Cashfree JS SDK
}

/** Minimum chargeable amount (minor units); Cashfree INR minimum is ~₹1. */
const MIN_CHARGE_MINOR = 100;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly carts: CartService,
    private readonly addresses: AddressesService,
    private readonly shipping: ShippingService,
    private readonly products: ProductsService,
    private readonly cashfree: CashfreeService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly events: EventsService,
    private readonly coupons: CouponsService,
  ) {}

  /**
   * Turn the user's cart into a pending order + Cashfree order. Prices are
   * snapshotted; the destination country (cart == address) drives price,
   * currency, shipping, and tax. Stock is only decremented once payment is
   * confirmed (webhook), but we validate availability here.
   */
  async checkout(
    userId: string,
    email: string,
    addressId: string,
    couponCode?: string,
  ): Promise<CheckoutResult> {
    const { cart } = await this.carts.resolveOrCreate({
      userId,
      cookieCartId: null,
    });
    const view = await this.carts.view(cart);
    if (view.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Idempotency: drop any earlier in-progress orders so a re-checkout doesn't
    // leave duplicate pending orders (unpaid Cashfree orders expire on their own).
    await this.cancelPendingForUser(userId);

    const address = await this.addresses.get(userId, addressId);

    // Validate availability + build snapshotted line items.
    const items: OrderItem[] = [];
    for (const line of view.items) {
      if (!line.available) {
        throw new BadRequestException(`"${line.name}" is not available`);
      }
      if (line.quantity > line.stock) {
        throw new BadRequestException(`Not enough stock for "${line.name}"`);
      }
      items.push(
        Object.assign(new OrderItem(), {
          productId: line.productId,
          variantId: line.variantId,
          name: line.name,
          variantLabel: line.label,
          unitAmountMinor: line.unitAmountMinor,
          quantity: line.quantity,
        }),
      );
    }

    const currency = view.currency; // always 'inr'
    const subtotalMinor = view.subtotalMinor;

    // Optional coupon → discount off the subtotal.
    let discountMinor = 0;
    let appliedCode: string | null = null;
    if (couponCode) {
      const result = await this.coupons.validate(couponCode, subtotalMinor);
      discountMinor = result.discountMinor;
      appliedCode = result.code;
    }

    const rate = await this.shipping.get();
    const shippingMinor = rate?.amountMinor ?? 0;

    // Flat GST on the discounted subtotal (percent from config; 0 by default).
    const taxPercent = this.config.get<number>('taxPercent') ?? 0;
    const taxMinor = Math.round(
      ((subtotalMinor - discountMinor) * taxPercent) / 100,
    );

    const totalMinor = subtotalMinor - discountMinor + shippingMinor + taxMinor;

    if (totalMinor < MIN_CHARGE_MINOR) {
      throw new BadRequestException('Order total is below the minimum chargeable amount');
    }

    // Persist the pending order first (source of truth), then create the
    // Cashfree order (its order_id == our order id).
    const order = await this.orders.save(
      Object.assign(new Order(), {
        reference: await this.generateReference(),
        userId,
        customerEmail: email,
        status: 'pending' as OrderStatus,
        currency,
        subtotalMinor,
        shippingMinor,
        taxMinor,
        discountMinor,
        couponCode: appliedCode,
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

    const cf = await this.cashfree.createOrder({
      orderId: order.id,
      amountMinor: totalMinor,
      currency,
      customerId: userId,
      customerEmail: email,
      customerPhone: (address.phone || '').replace(/\D/g, '') || '9999999999',
    });
    order.paymentRef = cf.cfOrderId;
    await this.orders.save(order);

    return {
      orderId: order.id,
      reference: order.reference!,
      status: order.status,
      currency,
      amounts: { subtotalMinor, discountMinor, shippingMinor, taxMinor, totalMinor },
      paymentSessionId: cf.paymentSessionId,
      appId: this.config.get<string>('cashfree.appId')!,
      mode: this.config.get<string>('cashfree.env')!,
    };
  }

  /**
   * Build a human order reference: {STORE_PREFIX}-{YYYYMMDD}-{RANDOM6}, e.g.
   * SBAZ-20260808-R6T4NW. Uses an unambiguous charset and retries on the rare
   * collision (unique index is the final guard).
   */
  private async generateReference(): Promise<string> {
    const prefix = this.config.get<string>('storePrefix') ?? 'ORD';
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
    const rand = (n: number) =>
      Array.from({ length: n }, () => CHARS[randomInt(CHARS.length)]).join('');
    for (let i = 0; i < 6; i++) {
      const ref = `${prefix}-${ymd}-${rand(6)}`;
      if (!(await this.orders.findOne({ where: { reference: ref } }))) return ref;
    }
    return `${prefix}-${ymd}-${rand(10)}`; // extremely unlikely fallback
  }

  // ---- Payment lifecycle (called by the webhook) ----------------------------

  /**
   * Mark paid: atomically decrement stock for ALL lines. If any line can't be
   * fulfilled (raced to zero after checkout), roll back, AUTO-REFUND the whole
   * payment, and cancel the order — so we never keep money for something we
   * can't ship. On success: record tax, clear the cart. Idempotent.
   */
  async markPaidByRef(ref: string): Promise<void> {
    const order = await this.orders.findOne({
      where: { paymentRef: ref },
      relations: { items: true },
    });
    if (!order || !['pending', 'processing'].includes(order.status)) return;

    const decremented: OrderItem[] = [];
    let oversold = false;
    for (const item of order.items) {
      const ok = await this.products.decrementLineStock(
        item.productId,
        item.variantId,
        item.quantity,
      );
      if (ok) {
        decremented.push(item);
      } else {
        oversold = true;
        break;
      }
    }

    if (oversold) {
      await this.restock(decremented); // roll back partial decrements
      if (order.paymentRef) {
        await this.cashfree.refund({
          cfOrderId: order.paymentRef,
          amountMinor: order.totalMinor,
          refundId: `oversold_${order.id}`,
        });
      }
      order.status = 'cancelled';
      order.refundedMinor = order.totalMinor;
      await this.orders.save(order);
      this.logger.warn(`Order ${order.id} oversold -> auto-refunded + cancelled`);
      this.mailOrder(order, 'cancelled');
      this.events.emit({ type: 'order.updated', orderId: order.id, status: 'cancelled' });
      return;
    }

    order.status = 'paid';
    await this.orders.save(order);
    if (order.couponCode) {
      await this.coupons.redeem(order.couponCode).catch(() => undefined);
    }
    const { cart } = await this.carts.resolveOrCreate({
      userId: order.userId,
      cookieCartId: null,
    });
    await this.carts.clear(cart);
    this.logger.log(`Order ${order.id} paid`);
    this.mailOrder(order, 'paid');
    // A newly paid order is the first time it's visible to the admin panel.
    this.events.emit({ type: 'order.created', orderId: order.id, status: 'paid' });
  }

  async markFailedByRef(ref: string): Promise<void> {
    await this.orders.update({ paymentRef: ref }, { status: 'failed' });
    this.events.emit({ type: 'order.updated', status: 'failed' });
  }

  /**
   * Reconcile a FULL refund that happened outside the app (e.g. the Cashfree
   * dashboard). If the app already handled it (status cancelled/refunded) this
   * is a no-op, so we never double-restock.
   */
  async markRefundedByRef(ref: string): Promise<void> {
    const order = await this.orders.findOne({
      where: { paymentRef: ref },
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
  cancelForUser(userId: string, id: string, reason?: string): Promise<Order> {
    return this.cancel(id, userId, reason);
  }

  /** Admin cancels any order. */
  cancelAsAdmin(id: string, reason?: string): Promise<Order> {
    return this.cancel(id, null, reason);
  }

  private async cancel(
    id: string,
    userId: string | null,
    reason?: string,
  ): Promise<Order> {
    const order = await this.loadOwned(id, userId);
    if (['shipped', 'delivered', 'fulfilled'].includes(order.status)) {
      throw new BadRequestException(
        'Order already shipped — request a return instead',
      );
    }
    if (['cancelled', 'refunded', 'failed'].includes(order.status)) {
      throw new BadRequestException(`Order is ${order.status}`);
    }

    if (order.status === 'paid' && order.paymentRef) {
      // Paid → refund the whole captured amount + restore stock. (Pending orders
      // have no capture; the unpaid Cashfree order simply expires.)
      await this.cashfree.refund({
        cfOrderId: order.paymentRef,
        amountMinor: order.totalMinor,
        refundId: `cancel_${order.id}`,
      });
      await this.restock(order.items);
      order.refundedMinor = order.totalMinor;
    }
    order.status = 'cancelled';
    if (reason) order.cancelReason = reason;
    await this.orders.save(order);
    this.logger.log(`Order ${order.id} cancelled`);
    this.mailOrder(order, 'cancelled');
    this.events.emit({ type: 'order.updated', orderId: order.id, status: 'cancelled' });
    return order;
  }

  /** Admin full/partial refund. Full refunds restore stock + mark refunded. */
  async refund(id: string, amountMinor?: number): Promise<Order> {
    const order = await this.loadOwned(id, null);
    if (!order.paymentRef || order.status === 'pending') {
      throw new BadRequestException('Order has no captured payment to refund');
    }
    if (order.status === 'refunded' || order.status === 'cancelled') {
      throw new BadRequestException(`Order is ${order.status}`);
    }
    const refundAmount = amountMinor ?? order.totalMinor - order.refundedMinor;
    await this.cashfree.refund({
      cfOrderId: order.paymentRef,
      amountMinor: refundAmount,
      refundId: `refund_${order.id}_${order.refundedMinor}`,
    });
    order.refundedMinor = Math.min(
      order.totalMinor,
      order.refundedMinor + refundAmount,
    );
    const fullyRefunded = order.refundedMinor >= order.totalMinor;
    if (fullyRefunded) {
      await this.restock(order.items);
      order.status = 'refunded';
    }
    await this.orders.save(order);
    this.logger.log(`Order ${order.id} refunded (${fullyRefunded ? 'full' : 'partial'})`);
    if (fullyRefunded) this.mailOrder(order, 'refunded');
    this.events.emit({ type: 'order.updated', orderId: order.id, status: order.status });
    return order;
  }

  /** Cancel pending orders older than the cutoff (unpaid Cashfree orders expire). */
  async sweepStalePending(olderThan: Date): Promise<number> {
    const res = await this.orders.update(
      { status: 'pending', createdAt: LessThan(olderThan) },
      { status: 'cancelled' },
    );
    return res.affected ?? 0;
  }

  /** Cancel any in-progress (pending) orders for a user (idempotent checkout). */
  private async cancelPendingForUser(userId: string): Promise<void> {
    await this.orders.update(
      { userId, status: 'pending' },
      { status: 'cancelled' },
    );
  }

  /** Restore stock for a set of order lines (variant-aware). */
  async restock(items: OrderItem[]): Promise<void> {
    for (const item of items) {
      await this.products.incrementLineStock(
        item.productId,
        item.variantId,
        item.quantity,
      );
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
    this.events.emit({ type: 'order.updated', orderId: saved.id, status });
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
      orderId: order.reference ?? order.id,
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
