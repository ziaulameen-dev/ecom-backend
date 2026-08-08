import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { OrdersModule } from '../orders/orders.module';
import { CleanupService } from './cleanup.service';

/** Scheduled background jobs (stale orders + abandoned carts). */
@Module({
  imports: [CartModule, OrdersModule],
  providers: [CleanupService],
})
export class JobsModule {}
