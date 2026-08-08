'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  AttributeType,
  CategoryNode,
  ListingItem,
  ProductDetail,
  ReviewSummary,
} from '@/lib/types';

/** Query keys — centralized so mutations can invalidate precisely. */
export const catalogKeys = {
  categories: ['categories'] as const,
  attributes: ['attributes'] as const,
  products: (params: ProductQuery) => ['products', params] as const,
  product: (idOrSlug: string) => ['product', idOrSlug] as const,
  reviews: (productId: string) => ['reviews', productId] as const,
};

export interface ProductQuery {
  search?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}

function toQuery(params: ProductQuery): string {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.categoryId) q.set('categoryId', params.categoryId);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function useCategoryTree() {
  return useQuery({
    queryKey: catalogKeys.categories,
    queryFn: () => api.get<CategoryNode[]>('/api/categories?tree=1'),
    staleTime: 5 * 60_000,
  });
}

export function useAttributes() {
  return useQuery({
    queryKey: catalogKeys.attributes,
    queryFn: () => api.get<AttributeType[]>('/api/attributes'),
    staleTime: 5 * 60_000,
  });
}

export function useProducts(params: ProductQuery = {}) {
  return useQuery({
    queryKey: catalogKeys.products(params),
    queryFn: () => api.get<ListingItem[]>(`/api/products${toQuery(params)}`),
  });
}

export function useProduct(idOrSlug: string) {
  return useQuery({
    queryKey: catalogKeys.product(idOrSlug),
    queryFn: () => api.get<ProductDetail>(`/api/products/${idOrSlug}`),
    enabled: !!idOrSlug,
  });
}

export function useReviews(productId: string) {
  return useQuery({
    queryKey: catalogKeys.reviews(productId),
    queryFn: () => api.get<ReviewSummary>(`/api/products/${productId}/reviews`),
    enabled: !!productId,
  });
}
