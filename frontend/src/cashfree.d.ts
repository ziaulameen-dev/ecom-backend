// The Cashfree JS SDK ships no type declarations — declare the small surface we use.
declare module '@cashfreepayments/cashfree-js' {
  export interface CashfreeCheckoutOptions {
    paymentSessionId: string;
    redirectTarget?: '_self' | '_blank' | '_top' | '_modal';
    returnUrl?: string;
  }
  export interface CashfreeCheckoutResult {
    error?: { message?: string };
    redirect?: boolean;
    paymentDetails?: unknown;
  }
  export interface Cashfree {
    checkout(options: CashfreeCheckoutOptions): Promise<CashfreeCheckoutResult>;
  }
  export function load(options: { mode: 'sandbox' | 'production' }): Promise<Cashfree>;
}
