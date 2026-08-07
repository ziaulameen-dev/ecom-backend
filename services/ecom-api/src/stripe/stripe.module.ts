import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';

/** Stripe SDK wrapper (tax, payment intents, webhook verification). */
@Module({
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
