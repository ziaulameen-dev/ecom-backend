import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductsService } from '../products/products.service';
import { CashfreeService } from '../cashfree/cashfree.service';
import { EventsService } from '../events/events.service';
import { StorageService } from '../storage/storage.service';
import { OrdersService } from './orders.service';
import { ReturnLine, ReturnRequest, ReturnStatus } from './return-request.entity';
import { Readable } from 'stream';

/** Allowed image types + limits for return evidence uploads. */
const MAX_IMAGES = 5;
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/** RMA: customer return requests + admin approve/receive → refund + restock. */
@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    @InjectRepository(ReturnRequest)
    private readonly returns: Repository<ReturnRequest>,
    private readonly orders: OrdersService,
    private readonly cashfree: CashfreeService,
    private readonly products: ProductsService,
    private readonly storage: StorageService,
    private readonly events: EventsService,
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

    // How much of each product is already claimed by other open/settled returns.
    const existing = await this.returns.find({ where: { orderId } });
    const claimed = new Map<string, number>();
    for (const r of existing) {
      if (r.status === 'rejected') continue;
      for (const l of r.items) {
        claimed.set(l.productId, (claimed.get(l.productId) ?? 0) + l.quantity);
      }
    }

    // Validate each line against the remaining returnable quantity.
    for (const line of items) {
      const oi = order.items.find((i) => i.productId === line.productId);
      if (!oi) throw new BadRequestException('Item not in this order');
      const remaining = oi.quantity - (claimed.get(line.productId) ?? 0);
      if (line.quantity < 1 || line.quantity > remaining) {
        throw new BadRequestException(
          `Can return at most ${remaining} of "${oi.name}"`,
        );
      }
    }

    const saved = await this.returns.save(
      this.returns.create({
        orderId,
        userId,
        reason: reason ?? null,
        items,
        images: [],
        status: 'requested',
      }),
    );
    this.events.emit({ type: 'return.created', returnId: saved.id, orderId });
    return saved;
  }

  /** Attach customer-uploaded evidence images to a return (owner only). */
  async addImages(
    userId: string,
    returnId: string,
    files: { buffer: Buffer; mimetype: string }[],
  ): Promise<ReturnRequest> {
    const rr = await this.returns.findOne({ where: { id: returnId, userId } });
    if (!rr) throw new NotFoundException('Return not found');
    if (!files?.length) throw new BadRequestException('No images uploaded');
    if ((rr.images?.length ?? 0) + files.length > MAX_IMAGES) {
      throw new BadRequestException(`At most ${MAX_IMAGES} images per return`);
    }
    for (const f of files) {
      const ext = EXT_BY_MIME[f.mimetype];
      if (!ext) throw new BadRequestException('Only JP/PNG/WEBP/GIF images allowed');
      const key = await this.storage.put(`returns/${returnId}`, f.buffer, f.mimetype, ext);
      rr.images = [...(rr.images ?? []), key];
    }
    const saved = await this.returns.save(rr);
    this.events.emit({ type: 'return.updated', returnId: rr.id, orderId: rr.orderId });
    return saved;
  }

  /** Stream one of a return's images. Owner (by userId) or admin (userId=null). */
  async getImage(
    returnId: string,
    key: string,
    userId: string | null,
  ): Promise<{ stream: Readable; contentType: string }> {
    const where = userId ? { id: returnId, userId } : { id: returnId };
    const rr = await this.returns.findOne({ where });
    if (!rr || !rr.images?.includes(key)) {
      throw new NotFoundException('Image not found');
    }
    return this.storage.get(key);
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
      approved: ['received', 'rejected'],
      received: ['refunded', 'rejected'], // reject-after-receipt (e.g. damaged)
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
      const saved = await this.returns.save(rr);
      this.events.emit({ type: 'return.updated', returnId: rr.id, orderId: rr.orderId, status: next });
      return saved;
    }

    // refund: only now (goods received + inspected) do we return money + stock.
    const order = await this.orders.loadOwned(rr.orderId, null);
    let refundMinor = 0;
    for (const line of rr.items) {
      const oi = order.items.find((i) => i.productId === line.productId);
      if (oi) {
        refundMinor += oi.unitAmountMinor * line.quantity;
        oi.returnedQuantity += line.quantity; // track to prevent over-returns
      }
    }
    if (refundMinor > 0 && order.paymentRef) {
      await this.cashfree.refund({
        cfOrderId: order.paymentRef,
        amountMinor: refundMinor,
        refundId: `return_${rr.id}`,
      });
    }
    for (const line of rr.items) {
      const oi = order.items.find((i) => i.productId === line.productId);
      await this.products.incrementLineStock(
        line.productId,
        oi?.variantId ?? null,
        line.quantity,
      );
    }
    order.refundedMinor = Math.min(order.totalMinor, order.refundedMinor + refundMinor);
    await this.orders.saveEntity(order); // persists returnedQuantity + refundedMinor

    rr.refundMinor = refundMinor;
    rr.status = 'refunded';
    this.logger.log(`Return ${rr.id} refunded ${refundMinor} + restocked`);
    const saved = await this.returns.save(rr);
    this.events.emit({ type: 'return.updated', returnId: rr.id, orderId: rr.orderId, status: 'refunded' });
    return saved;
  }
}
