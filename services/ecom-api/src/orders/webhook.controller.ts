import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import type Stripe from 'stripe';
import { StripeService } from '../stripe/stripe.service';
import { OrdersService } from './orders.service';

/**
 * POST /api/payments/webhook — Stripe calls this to confirm payment. It's the
 * source of truth for marking an order paid. PUBLIC + raw body (the signature
 * is verified against the raw bytes via `req.rawBody`, enabled in main.ts).
 */
@Controller('payments/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly orders: OrdersService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    let event: Stripe.Event;
    try {
      event = this.stripe.constructEvent(req.rawBody as Buffer, signature);
    } catch (err) {
      this.logger.warn(`Bad webhook signature: ${(err as Error).message}`);
      throw new BadRequestException('Invalid signature');
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.orders.markPaidByPaymentIntent(
          (event.data.object as Stripe.PaymentIntent).id,
        );
        break;
      case 'payment_intent.payment_failed':
        await this.orders.markFailedByPaymentIntent(
          (event.data.object as Stripe.PaymentIntent).id,
        );
        break;
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        if (charge.payment_intent) {
          await this.orders.markRefundedByPaymentIntent(
            String(charge.payment_intent),
          );
        }
        break;
      }
      default:
        // Ignore unhandled event types (still 200 so Stripe stops retrying).
        break;
    }
    return { received: true };
  }
}
