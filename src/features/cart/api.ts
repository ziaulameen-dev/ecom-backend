'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { cartId } from '@/lib/session';
import type { CartView } from '@/lib/types';

const cartKey = ['cart'] as const;

/** Persist the returned cart id (for guests) and prime the cache. */
function useApplyCart() {
  const qc = useQueryClient();
  return (cart: CartView) => {
    if (cart?.id) cartId.set(cart.id);
    qc.setQueryData(cartKey, cart);
  };
}

export function useCart() {
  return useQuery({
    queryKey: cartKey,
    queryFn: () => api.get<CartView>('/api/cart'),
  });
}

export function useAddToCart() {
  const apply = useApplyCart();
  return useMutation({
    mutationFn: (input: { productId: string; variantId?: string | null; quantity?: number }) =>
      api.post<CartView>('/api/cart/items', {
        productId: input.productId,
        variantId: input.variantId ?? undefined,
        quantity: input.quantity ?? 1,
      }),
    onSuccess: apply,
  });
}

export function useUpdateCartItem() {
  const apply = useApplyCart();
  return useMutation({
    mutationFn: (input: { itemId: string; quantity: number }) =>
      api.patch<CartView>(`/api/cart/items/${input.itemId}`, { quantity: input.quantity }),
    onSuccess: apply,
  });
}

export function useRemoveCartItem() {
  const apply = useApplyCart();
  return useMutation({
    mutationFn: (itemId: string) => api.del<CartView>(`/api/cart/items/${itemId}`),
    onSuccess: apply,
  });
}
