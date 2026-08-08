import { Module } from '@nestjs/common';
import { CashfreeService } from './cashfree.service';

/** Cashfree payment gateway client (orders, refunds, webhook verification). */
@Module({
  providers: [CashfreeService],
  exports: [CashfreeService],
})
export class CashfreeModule {}
