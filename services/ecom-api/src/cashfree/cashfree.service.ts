import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export interface CreatedCfOrder {
  paymentSessionId: string;
  cfOrderId: string;
}

/**
 * Cashfree (India / INR) payment gateway client. Uses the Orders API: we create
 * a Cashfree order (amount in RUPEES) using OUR order id as its order_id, and
 * the frontend completes payment with the returned payment_session_id via the
 * Cashfree JS SDK. Payment state is confirmed by the webhook (source of truth).
 */
@Injectable()
export class CashfreeService {
  private readonly logger = new Logger(CashfreeService.name);

  constructor(private readonly config: ConfigService) {}

  private headers() {
    return {
      'Content-Type': 'application/json',
      'x-api-version': this.config.get<string>('cashfree.apiVersion')!,
      'x-client-id': this.config.get<string>('cashfree.appId')!,
      'x-client-secret': this.config.get<string>('cashfree.secretKey')!,
    };
  }

  private base() {
    return this.config.get<string>('cashfree.baseUrl')!;
  }

  /** Create a Cashfree order; returns its payment_session_id for the SDK. */
  async createOrder(params: {
    orderId: string;
    amountMinor: number;
    currency: string;
    customerId: string;
    customerEmail: string;
    customerPhone: string;
  }): Promise<CreatedCfOrder> {
    const publicBase = this.config.get<string>('cashfree.publicBaseUrl');
    const res = await fetch(`${this.base()}/orders`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        order_id: params.orderId,
        order_amount: params.amountMinor / 100, // Cashfree wants major units
        order_currency: params.currency.toUpperCase(),
        customer_details: {
          customer_id: params.customerId,
          customer_email: params.customerEmail,
          customer_phone: params.customerPhone,
        },
        order_meta: {
          return_url: `${publicBase}/orders?order_id={order_id}`,
          notify_url: `${publicBase}/api/payments/webhook`,
        },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      this.logger.error(`Cashfree createOrder failed: ${JSON.stringify(json)}`);
      throw new Error(json?.message || 'Cashfree order creation failed');
    }
    return { paymentSessionId: json.payment_session_id, cfOrderId: json.order_id };
  }

  /** Fetch a Cashfree order's status (PAID / ACTIVE / EXPIRED). */
  async getOrderStatus(cfOrderId: string): Promise<string | null> {
    const res = await fetch(`${this.base()}/orders/${cfOrderId}`, {
      headers: this.headers(),
    });
    if (!res.ok) return null;
    return (await res.json()).order_status ?? null;
  }

  /** Initiate a refund (full or partial) for a Cashfree order. */
  async refund(params: {
    cfOrderId: string;
    amountMinor: number;
    refundId: string;
  }): Promise<void> {
    const res = await fetch(`${this.base()}/orders/${params.cfOrderId}/refunds`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        refund_amount: params.amountMinor / 100,
        refund_id: params.refundId,
        refund_note: 'Order refund',
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json?.message || 'Cashfree refund failed');
    }
  }

  /**
   * Verify a Cashfree webhook: signature = base64(HMAC-SHA256(timestamp + rawBody,
   * secretKey)). Compared in constant time.
   */
  verifyWebhook(rawBody: string, signature: string, timestamp: string): boolean {
    if (!signature || !timestamp) return false;
    const expected = createHmac(
      'sha256',
      this.config.get<string>('cashfree.secretKey')!,
    )
      .update(timestamp + rawBody)
      .digest('base64');
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}
