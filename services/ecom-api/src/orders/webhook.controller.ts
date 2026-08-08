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
import { CashfreeService } from '../cashfree/cashfree.service';
import { OrdersService } from './orders.service';
import { WebhookEventsService } from './webhook-events.service';

/**
 * POST /api/payments/webhook — Cashfree's confirmation channel and the source of
 * truth for payment state. PUBLIC + raw body (signature verified against the raw
 * bytes). Events are de-duplicated and handlers are idempotent.
 */
@Controller('payments/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly cashfree: CashfreeService,
    private readonly orders: OrdersService,
    private readonly events: WebhookEventsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-webhook-signature') signature: string,
    @Headers('x-webhook-timestamp') timestamp: string,
  ) {
    const raw = (req.rawBody as Buffer)?.toString('utf8') ?? '';
    if (!this.cashfree.verifyWebhook(raw, signature, timestamp)) {
      this.logger.warn('Bad Cashfree webhook signature');
      throw new BadRequestException('Invalid signature');
    }

    let event: CashfreeWebhook;
    try {
      event = JSON.parse(raw);
    } catch {
      throw new BadRequestException('Invalid payload');
    }

    const orderId = event?.data?.order?.order_id;
    const type = event?.type;
    if (!orderId || !type) return { received: true };

    // Cashfree has no stable event id, so key dedup on the mutation identity:
    // order + type + the payment/refund id (or timestamp as a last resort).
    const dedupId =
      event.data?.payment?.cf_payment_id ??
      event.data?.refund?.cf_refund_id ??
      timestamp;
    if (!(await this.events.firstDelivery(`${type}:${orderId}:${dedupId}`))) {
      return { received: true, duplicate: true };
    }

    switch (type) {
      case 'PAYMENT_SUCCESS_WEBHOOK':
        await this.orders.markPaidByRef(orderId);
        break;
      case 'PAYMENT_FAILED_WEBHOOK':
      case 'PAYMENT_USER_DROPPED_WEBHOOK':
        await this.orders.markFailedByRef(orderId);
        break;
      case 'REFUND_STATUS_WEBHOOK': {
        // Reconcile only when the refund actually settled.
        if (event.data?.refund?.refund_status === 'SUCCESS') {
          await this.orders.markRefundedByRef(orderId);
        }
        break;
      }
      default:
        break; // ignore unhandled types (still 200 so Cashfree stops retrying)
    }
    return { received: true };
  }
}

/** Minimal shape of the Cashfree webhook payloads we consume. */
interface CashfreeWebhook {
  type: string;
  data?: {
    order?: { order_id?: string };
    payment?: { cf_payment_id?: string | number; payment_status?: string };
    refund?: { cf_refund_id?: string | number; refund_status?: string };
  };
}
