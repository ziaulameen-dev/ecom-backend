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
import { WebhookEventsService } from './webhook-events.service';

/**
 * POST /api/payments/webhook — Stripe's confirmation channel and the source of
 * truth for payment state. PUBLIC + raw body (signature verified against the
 * raw bytes). Events are de-duplicated by id and handlers are idempotent.
 */
@Controller('payments/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly orders: OrdersService,
    private readonly events: WebhookEventsService,
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

    // Skip if we've already processed this event id.
    if (!(await this.events.firstDelivery(event.id))) {
      return { received: true, duplicate: true };
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.orders.markPaidByPaymentIntent(
          (event.data.object as Stripe.PaymentIntent).id,
        );
        break;
      case 'payment_intent.processing':
        await this.orders.markProcessingByPaymentIntent(
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
        // Reconcile only FULL external refunds; partial (returns) handled apart.
        if (charge.payment_intent && charge.refunded) {
          await this.orders.markRefundedByPaymentIntent(
            String(charge.payment_intent),
          );
        }
        break;
      }
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        if (dispute.payment_intent) {
          await this.orders.markDisputedByPaymentIntent(
            String(dispute.payment_intent),
          );
        }
        break;
      }
      default:
        break; // ignore unhandled types (still 200 so Stripe stops retrying)
    }
    return { received: true };
  }
}
