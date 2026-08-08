'use client';

import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export interface CheckoutAmounts {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
}
export interface CheckoutResult {
  orderId: string;
  reference: string;
  status: string;
  currency: string;
  amounts: CheckoutAmounts;
  paymentSessionId: string;
  appId: string;
  mode: 'sandbox' | 'production';
}

export interface CouponResult {
  code: string;
  type: 'percent' | 'fixed';
  discountMinor: number;
}

export function useValidateCoupon() {
  return useMutation({
    mutationFn: (input: { code: string; subtotalMinor: number }) =>
      api.post<CouponResult>('/api/coupons/validate', input),
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: (input: { addressId: string; couponCode?: string }) =>
      api.post<CheckoutResult>('/api/checkout', input),
  });
}
