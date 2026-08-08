import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CartService } from '../cart/cart.service';
import { OrdersService } from '../orders/orders.service';

const GUEST_CART_TTL_DAYS = 30;
const PENDING_ORDER_TTL_MINUTES = 60;

/**
 * Scheduled housekeeping: cancel stale pending orders (unpaid Cashfree orders
 * expire on their own) and delete long-abandoned guest carts.
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly carts: CartService,
    private readonly orders: OrdersService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async run() {
    const now = Date.now();
    const pending = await this.orders.sweepStalePending(
      new Date(now - PENDING_ORDER_TTL_MINUTES * 60_000),
    );
    const carts = await this.carts.purgeAbandonedGuestCarts(
      new Date(now - GUEST_CART_TTL_DAYS * 86_400_000),
    );
    if (pending || carts) {
      this.logger.log(
        `Cleanup: cancelled ${pending} stale pending orders, purged ${carts} guest carts`,
      );
    }
  }
}
