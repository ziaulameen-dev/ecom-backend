'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { authKeys } from '@/features/auth/api';
import type { AdminReturn, Address, Order, OrderItem, User } from '@/lib/types';

export const accountKeys = {
  addresses: ['addresses'] as const,
  orders: ['orders'] as const,
  order: (id: string) => ['order', id] as const,
  returns: ['my-returns'] as const,
};

// ---- Addresses ------------------------------------------------------------

export function useAddresses() {
  return useQuery({ queryKey: accountKeys.addresses, queryFn: () => api.get<Address[]>('/api/addresses') });
}

export interface AddressInput {
  fullName: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  isDefault?: boolean;
}

export function useCreateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddressInput) => api.post<Address>('/api/addresses', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.addresses }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/addresses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.addresses }),
  });
}

// ---- Orders ---------------------------------------------------------------

export function useMyOrders() {
  return useQuery({ queryKey: accountKeys.orders, queryFn: () => api.get<Order[]>('/api/orders') });
}

export function useOrder(id: string, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: accountKeys.order(id),
    queryFn: () => api.get<Order>(`/api/orders/${id}`),
    enabled: !!id,
    refetchInterval: options?.refetchInterval,
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; reason?: string }) =>
      api.post(`/api/orders/${input.id}/cancel`, input.reason ? { reason: input.reason } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.orders }),
  });
}

// ---- Returns (RMA) --------------------------------------------------------

export function useMyReturns() {
  return useQuery({ queryKey: accountKeys.returns, queryFn: () => api.get<AdminReturn[]>('/api/returns') });
}

/** Create a return for the whole order, then upload evidence images (if any). */
export function useRequestReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { orderId: string; reason?: string; items: OrderItem[]; files: File[] }) => {
      const rr = await api.post<{ id: string }>(`/api/orders/${input.orderId}/returns`, {
        reason: input.reason || undefined,
        items: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      if (input.files.length) {
        const fd = new FormData();
        input.files.slice(0, 5).forEach((f) => fd.append('images', f));
        await api.postForm(`/api/returns/${rr.id}/images`, fd);
      }
      return rr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.returns });
      qc.invalidateQueries({ queryKey: accountKeys.orders });
    },
  });
}

// ---- Profile --------------------------------------------------------------

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; mobile?: string }) => api.patch<User>('/auth/profile', input),
    onSuccess: (user) => qc.setQueryData(authKeys.me, user),
  });
}
