'use client';

import { Loader2, Search, ShoppingCart } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { get } from '@/lib/api';
import { useStore } from '@/lib/store';
import { money } from '@/lib/utils';

interface ProductView {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  stock: number;
  price: { currency: string; amountMinor: number };
}

export default function CatalogPage() {
  const { addItem } = useStore();
  const [products, setProducts] = useState<ProductView[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    const t = setTimeout(() => {
      get(`/api/products?${params}`)
        .then(setProducts)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 200); // debounce search
    return () => clearTimeout(t);
  }, [search, category]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[],
    [products],
  );

  async function add(id: string) {
    setAdding(id);
    try {
      await addItem(id, 1);
    } finally {
      setAdding(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Shop</h1>
        <p className="text-muted-foreground">All prices in INR.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={category === '' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategory('')}
          >
            All
          </Button>
          {categories.map((c) => (
            <Button
              key={c}
              variant={category === c ? 'default' : 'outline'}
              size="sm"
              className="capitalize"
              onClick={() => setCategory(c)}
            >
              {c}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <p className="text-center py-20 text-muted-foreground">No products found.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id} className="overflow-hidden flex flex-col">
              <div className="aspect-[3/2] bg-muted overflow-hidden">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full grid place-items-center text-muted-foreground">
                    <ShoppingCart className="h-8 w-8" />
                  </div>
                )}
              </div>
              <CardContent className="pt-4 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{p.name}</h3>
                  {p.category && (
                    <Badge variant="secondary" className="capitalize shrink-0">{p.category}</Badge>
                  )}
                </div>
                {p.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                )}
                <div className="mt-3 text-xl font-bold">
                  {money(p.price.amountMinor, p.price.currency)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  disabled={p.stock < 1 || adding === p.id}
                  onClick={() => add(p.id)}
                >
                  {adding === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add to cart'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
