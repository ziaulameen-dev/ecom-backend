'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useCategoryTree, useProducts } from '@/features/catalog/api';
import { ProductGrid } from '@/features/catalog/components/product-grid';
import type { CategoryNode } from '@/lib/types';
import { cn } from '@/lib/utils';

type Sort = 'featured' | 'price-asc' | 'price-desc';

function resolveCategory(tree: CategoryNode[] | undefined, slug: string | null) {
  if (!tree || !slug) return { id: undefined as string | undefined, name: 'All products' };
  for (const top of tree) {
    if (top.slug === slug) return { id: top.id, name: top.name };
    const child = top.children.find((c) => c.slug === slug);
    if (child) return { id: child.id, name: `${top.name} · ${child.name}` };
  }
  return { id: undefined, name: 'All products' };
}

function ShopInner() {
  const sp = useSearchParams();
  const categorySlug = sp.get('category');
  const search = sp.get('search') ?? '';

  const { data: tree } = useCategoryTree();
  const { id: categoryId, name: title } = useMemo(
    () => resolveCategory(tree, categorySlug),
    [tree, categorySlug],
  );

  const { data: products, isLoading } = useProducts({ categoryId, search, limit: 60 });

  const [sort, setSort] = useState<Sort>('featured');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const items = useMemo(() => {
    let list = products ? [...products] : [];
    const min = minPrice ? Number(minPrice) * 100 : 0;
    const max = maxPrice ? Number(maxPrice) * 100 : Infinity;
    list = list.filter((p) => p.priceMinor >= min && p.priceMinor <= max);
    if (sort === 'price-asc') list.sort((a, b) => a.priceMinor - b.priceMinor);
    if (sort === 'price-desc') list.sort((a, b) => b.priceMinor - a.priceMinor);
    return list;
  }, [products, sort, minPrice, maxPrice]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{search ? `Results for “${search}”` : title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isLoading ? 'Loading…' : `${items.length} product${items.length === 1 ? '' : 's'}`}
      </p>

      <div className="mt-6 flex flex-col gap-8 lg:flex-row">
        {/* Filters */}
        <aside className="w-full shrink-0 lg:w-60">
          <div className="space-y-6 lg:sticky lg:top-20">
            <div>
              <div className="mb-2 text-sm font-semibold">Categories</div>
              <ul className="space-y-1 text-sm">
                <li>
                  <Link
                    href="/shop"
                    className={cn('block rounded px-2 py-1 hover:bg-accent', !categorySlug && 'bg-accent font-medium')}
                  >
                    All products
                  </Link>
                </li>
                {tree?.map((top) => (
                  <li key={top.id}>
                    <Link
                      href={`/shop?category=${top.slug}`}
                      className={cn('block rounded px-2 py-1 hover:bg-accent', categorySlug === top.slug && 'bg-accent font-medium')}
                    >
                      {top.name}
                    </Link>
                    {top.children.length > 0 && (
                      <ul className="ml-3 mt-1 space-y-1 border-l pl-2">
                        {top.children.map((child) => (
                          <li key={child.id}>
                            <Link
                              href={`/shop?category=${child.slug}`}
                              className={cn(
                                'block rounded px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground',
                                categorySlug === child.slug && 'bg-accent font-medium text-foreground',
                              )}
                            >
                              {child.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            <div>
              <div className="mb-2 text-sm font-semibold">Price (₹)</div>
              <div className="flex items-center gap-2">
                <Input type="number" inputMode="numeric" placeholder="Min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="h-9" />
                <span className="text-muted-foreground">–</span>
                <Input type="number" inputMode="numeric" placeholder="Max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="h-9" />
              </div>
            </div>

            <Separator />

            <div>
              <Label htmlFor="sort" className="mb-2 block text-sm font-semibold">Sort by</Label>
              <select
                id="sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="featured">Featured</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
              </select>
            </div>
          </div>
        </aside>

        {/* Grid */}
        <div className="flex-1">
          <ProductGrid items={items} loading={isLoading} skeletonCount={9} />
        </div>
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-16 text-muted-foreground">Loading…</div>}>
      <ShopInner />
    </Suspense>
  );
}
