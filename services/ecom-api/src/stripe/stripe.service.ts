import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/** A tax result for an order (0 when Stripe Tax isn't configured). */
export interface TaxResult {
  taxMinor: number;
  calculationId: string | null;
}

/** Thin wrapper around the Stripe SDK: tax, payment intents, webhook verify. */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;

  constructor(private readonly config: ConfigService) {
    this.stripe = new Stripe(this.config.get<string>('stripe.secretKey')!, {
      // Pin so behaviour is stable across SDK upgrades.
      apiVersion: '2025-03-31.basil' as Stripe.LatestApiVersion,
    });
  }

  /**
   * Compute destination tax via Stripe Tax. Falls back to 0 (and logs) if Stripe
   * Tax isn't enabled/configured, so checkout is never blocked by tax setup.
   */
  async calculateTax(params: {
    currency: string;
    lineItems: { amount: number; reference: string; quantity: number }[];
    shippingMinor: number;
    country: string;
    postalCode?: string | null;
    state?: string | null;
    city?: string | null;
    line1?: string | null;
  }): Promise<TaxResult> {
    try {
      const calc = await this.stripe.tax.calculations.create({
        currency: params.currency,
        line_items: params.lineItems.map((li) => ({
          amount: li.amount,
          reference: li.reference,
          quantity: li.quantity,
        })),
        shipping_cost: { amount: params.shippingMinor },
        customer_details: {
          address: {
            country: params.country,
            postal_code: params.postalCode ?? undefined,
            state: params.state ?? undefined,
            city: params.city ?? undefined,
            line1: params.line1 ?? undefined,
          },
          address_source: 'shipping',
        },
      });
      return { taxMinor: calc.tax_amount_exclusive, calculationId: calc.id };
    } catch (err) {
      this.logger.warn(
        `Stripe Tax unavailable (${(err as Error).message}); tax = 0`,
      );
      return { taxMinor: 0, calculationId: null };
    }
  }

  /** Create a PaymentIntent for an order and return it (with client_secret). */
  createPaymentIntent(params: {
    amountMinor: number;
    currency: string;
    orderId: string;
    idempotencyKey: string;
  }): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create(
      {
        amount: params.amountMinor,
        currency: params.currency,
        metadata: { orderId: params.orderId },
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey: params.idempotencyKey },
    );
  }

  /** Verify + parse a webhook payload against the signing secret. */
  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.config.get<string>('stripe.webhookSecret')!,
    );
  }
}
