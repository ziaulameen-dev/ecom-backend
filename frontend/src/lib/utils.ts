import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn's classnames helper. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format minor units (e.g. cents) in a currency. */
export function money(amountMinor: number | null, currency: string | null) {
  if (amountMinor == null || !currency) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

// India-only storefront (Cashfree / INR).
export const COUNTRIES = [{ code: 'IN', label: 'India' }];
