'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  AdminOrder,
  AdminProduct,
  AdminReturn,
  AttributeType,
  Category,
  Coupon,
  OrderStatus,
  Review,
} from '@/lib/types';

const k = {
  products: ['admin', 'products'] as const,
  categories: ['admin', 'categories'] as const,
  attributes: ['admin', 'attributes'] as const,
  orders: ['admin', 'orders'] as const,
  returns: ['admin', 'returns'] as const,
  coupons: ['admin', 'coupons'] as const,
  reviews: ['admin', 'reviews'] as const,
  shipping: ['admin', 'shipping'] as const,
};

function useInvalidate(key: readonly unknown[]) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: key });
}

/* ---- Products + variants ------------------------------------------------- */
export const useAdminProducts = () =>
  useQuery({ queryKey: k.products, queryFn: () => api.get<AdminProduct[]>('/api/products/admin/all') });

export function useCreateProduct() {
  const inv = useInvalidate(k.products);
  return useMutation({ mutationFn: (b: Record<string, unknown>) => api.post('/api/products', b), onSuccess: inv });
}
export function useUpdateProduct() {
  const inv = useInvalidate(k.products);
  return useMutation({ mutationFn: (i: { id: string; body: Record<string, unknown> }) => api.patch(`/api/products/${i.id}`, i.body), onSuccess: inv });
}
export function useDeleteProduct() {
  const inv = useInvalidate(k.products);
  return useMutation({ mutationFn: (id: string) => api.del(`/api/products/${id}`), onSuccess: inv });
}
export function useAddVariant() {
  const inv = useInvalidate(k.products);
  return useMutation({ mutationFn: (i: { productId: string; body: Record<string, unknown> }) => api.post(`/api/products/${i.productId}/variants`, i.body), onSuccess: inv });
}
export function useUpdateVariant() {
  const inv = useInvalidate(k.products);
  return useMutation({ mutationFn: (i: { id: string; body: Record<string, unknown> }) => api.patch(`/api/products/variants/${i.id}`, i.body), onSuccess: inv });
}
export function useDeleteVariant() {
  const inv = useInvalidate(k.products);
  return useMutation({ mutationFn: (id: string) => api.del(`/api/products/variants/${id}`), onSuccess: inv });
}

/* ---- Categories ---------------------------------------------------------- */
export const useAdminCategories = () =>
  useQuery({ queryKey: k.categories, queryFn: () => api.get<Category[]>('/api/categories') });
export function useCreateCategory() {
  const inv = useInvalidate(k.categories);
  return useMutation({ mutationFn: (b: Record<string, unknown>) => api.post('/api/categories', b), onSuccess: inv });
}
export function useDeleteCategory() {
  const inv = useInvalidate(k.categories);
  return useMutation({ mutationFn: (id: string) => api.del(`/api/categories/${id}`), onSuccess: inv });
}

/* ---- Attributes ---------------------------------------------------------- */
export const useAdminAttributes = () =>
  useQuery({ queryKey: k.attributes, queryFn: () => api.get<AttributeType[]>('/api/attributes') });
export function useCreateAttributeType() {
  const inv = useInvalidate(k.attributes);
  return useMutation({ mutationFn: (b: Record<string, unknown>) => api.post('/api/attributes', b), onSuccess: inv });
}
export function useAddAttributeValue() {
  const inv = useInvalidate(k.attributes);
  return useMutation({ mutationFn: (i: { typeId: string; body: Record<string, unknown> }) => api.post(`/api/attributes/${i.typeId}/values`, i.body), onSuccess: inv });
}
export function useDeleteAttributeType() {
  const inv = useInvalidate(k.attributes);
  return useMutation({ mutationFn: (id: string) => api.del(`/api/attributes/${id}`), onSuccess: inv });
}
export function useDeleteAttributeValue() {
  const inv = useInvalidate(k.attributes);
  return useMutation({ mutationFn: (id: string) => api.del(`/api/attribute-values/${id}`), onSuccess: inv });
}

/* ---- Orders -------------------------------------------------------------- */
export const useAdminOrders = () =>
  useQuery({ queryKey: k.orders, queryFn: () => api.get<AdminOrder[]>('/api/admin/orders') });
export function useUpdateOrderStatus() {
  const inv = useInvalidate(k.orders);
  return useMutation({ mutationFn: (i: { id: string; status: OrderStatus }) => api.patch(`/api/admin/orders/${i.id}/status`, { status: i.status }), onSuccess: inv });
}
export function useSetTracking() {
  const inv = useInvalidate(k.orders);
  return useMutation({ mutationFn: (i: { id: string; carrier: string; trackingNumber: string }) => api.patch(`/api/admin/orders/${i.id}/tracking`, { carrier: i.carrier, trackingNumber: i.trackingNumber }), onSuccess: inv });
}
export function useAdminCancelOrder() {
  const inv = useInvalidate(k.orders);
  return useMutation({ mutationFn: (i: { id: string; reason?: string }) => api.post(`/api/admin/orders/${i.id}/cancel`, i.reason ? { reason: i.reason } : {}), onSuccess: inv });
}
export function useRefundOrder() {
  const inv = useInvalidate(k.orders);
  return useMutation({ mutationFn: (i: { id: string; amountMinor?: number }) => api.post(`/api/admin/orders/${i.id}/refund`, i.amountMinor ? { amountMinor: i.amountMinor } : {}), onSuccess: inv });
}

/* ---- Returns ------------------------------------------------------------- */
export const useAdminReturns = () =>
  useQuery({ queryKey: k.returns, queryFn: () => api.get<AdminReturn[]>('/api/admin/returns') });
export function useReturnAction() {
  const inv = useInvalidate(k.returns);
  return useMutation({ mutationFn: (i: { id: string; action: 'approve' | 'reject' | 'receive' | 'refund' }) => api.patch(`/api/admin/returns/${i.id}`, { action: i.action }), onSuccess: inv });
}

/* ---- Coupons ------------------------------------------------------------- */
export const useAdminCoupons = () =>
  useQuery({ queryKey: k.coupons, queryFn: () => api.get<Coupon[]>('/api/admin/coupons') });
export function useCreateCoupon() {
  const inv = useInvalidate(k.coupons);
  return useMutation({ mutationFn: (b: Record<string, unknown>) => api.post('/api/admin/coupons', b), onSuccess: inv });
}
export function useDeleteCoupon() {
  const inv = useInvalidate(k.coupons);
  return useMutation({ mutationFn: (id: string) => api.del(`/api/admin/coupons/${id}`), onSuccess: inv });
}

/* ---- Reviews ------------------------------------------------------------- */
export const useAdminReviews = () =>
  useQuery({ queryKey: k.reviews, queryFn: () => api.get<Review[]>('/api/admin/reviews') });
export function useCreateReview() {
  const inv = useInvalidate(k.reviews);
  return useMutation({ mutationFn: (b: Record<string, unknown>) => api.post('/api/reviews', b), onSuccess: inv });
}
export function useDeleteReview() {
  const inv = useInvalidate(k.reviews);
  return useMutation({ mutationFn: (id: string) => api.del(`/api/reviews/${id}`), onSuccess: inv });
}

/* ---- Shipping ------------------------------------------------------------ */
export const useShippingRate = () =>
  useQuery({ queryKey: k.shipping, queryFn: () => api.get<{ amountMinor: number }>('/api/shipping-rate') });
export function useSetShippingRate() {
  const inv = useInvalidate(k.shipping);
  return useMutation({ mutationFn: (amountMinor: number) => api.put('/api/shipping-rate', { amountMinor }), onSuccess: inv });
}

export { k as adminKeys };
