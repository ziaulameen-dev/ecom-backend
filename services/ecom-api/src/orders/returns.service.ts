import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductsService } from '../products/products.service';
import { StripeService } from '../stripe/stripe.service';
import { OrdersService } from './orders.service';
import { ReturnLine, ReturnRequest, ReturnStatus } from './return-request.entity';

/** RMA: customer return requests + admin approve/receive → refund + restock. */
@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    @InjectRepository(ReturnRequest)
    private readonly returns: Repository<ReturnRequest>,
    private readonly orders: OrdersService,
    private readonly stripe: StripeService,
    private readonly products: ProductsService,
  ) {}

  /** Customer requests a return on a delivered/shipped order. */
  async create(
    userId: string,
    orderId: string,
    reason: string | undefined,
    items: ReturnLine[],
  ): Promise<ReturnRequest> {
    const order = await this.orders.loadOwned(orderId, userId);
    if (!['shipped', 'delivered', 'fulfilled'].includes(order.status)) {
      throw new BadRequestException('Only shipped/delivered orders can be returned');
    }

    // Validate each returned line against the order (product + quantity).
    for (const line of items) {
      const oi = order.items.find((i) => i.productId === line.productId);
      if (!oi) throw new BadRequestException('Item not in this order');
      if (line.quantity < 1 || line.quantity > oi.quantity) {
        throw new BadRequestException(`Invalid quantity for ${oi.name}`);
      }
    }

    return this.returns.save(
      this.returns.create({
        orderId,
        userId,
        reason: reason ?? null,
        items,
        status: 'requested',
      }),
    );
  }

  listForUser(userId: string): Promise<ReturnRequest[]> {
    return this.returns.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  listAll(): Promise<ReturnRequest[]> {
    return this.returns.find({ order: { createdAt: 'DESC' } });
  }

  /**
   * Admin moves a return through its lifecycle:
   *   requested → approve → approved   (customer may ship the item back)
   *             → reject  → rejected
   *   approved  → receive → received   (the goods have physically arrived)
   *   received  → refund  → refunded   (after inspection: money back + restock)
   *
   * Money and stock only move on the final `refund` step — after the product
   * is confirmed received by the admin.
   */
  async transition(
    id: string,
    action: 'approve' | 'reject' | 'receive' | 'refund',
  ): Promise<ReturnRequest> {
    const rr = await this.returns.findOne({ where: { id } });
    if (!rr) throw new NotFoundException('Return not found');

    const allowed: Record<ReturnStatus, ReturnStatus[]> = {
      requested: ['approved', 'rejected'],
      approved: ['received'],
      received: ['refunded'],
      rejected: [],
      refunded: [],
    };
    const target: Record<string, ReturnStatus> = {
      approve: 'approved',
      reject: 'rejected',
      receive: 'received',
      refund: 'refunded',
    };
    const next = target[action];
    if (!allowed[rr.status].includes(next)) {
      throw new BadRequestException(`Cannot ${action} a ${rr.status} return`);
    }

    // approve / reject / receive are pure status changes (no money/stock yet).
    if (next !== 'refunded') {
      rr.status = next;
      return this.returns.save(rr);
    }

    // refund: only now (goods received + inspected) do we return money + stock.
    const order = await this.orders.loadOwned(rr.orderId, null);
    let refundMinor = 0;
    for (const line of rr.items) {
      const oi = order.items.find((i) => i.productId === line.productId);
      if (oi) refundMinor += oi.unitAmountMinor * line.quantity;
    }
    if (refundMinor > 0 && order.stripePaymentIntentId) {
      await this.stripe.refund(order.stripePaymentIntentId, refundMinor);
    }
    for (const line of rr.items) {
      await this.products.incrementStock(line.productId, line.quantity);
    }
    rr.refundMinor = refundMinor;
    rr.status = 'refunded';
    this.logger.log(`Return ${rr.id} refunded ${refundMinor} + restocked`);
    return this.returns.save(rr);
  }
}
