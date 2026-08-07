'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { get, post } from '@/lib/api';
import { useStore } from '@/lib/store';
import { money } from '@/lib/utils';

interface ProductView {
  id: string;
  name: string;
  stock: number;
  price: { currency: string; amountMinor: number } | null;
}

export default function CatalogPage() {
  const { country, refreshCart } = useStore();
  const [products, setProducts] = useState<ProductView[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    get(`/api/products?country=${country}`).then(setProducts).catch(() => {});
  }, [country]);

  async function add(id: string) {
    setAdding(id);
    try {
      await post('/api/cart/items', { productId: id, quantity: 1, country }, false);
      await refreshCart();
    } finally {
      setAdding(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Shop</h1>
      <p className="text-muted-foreground mb-6">
        Prices shown for <strong>{country}</strong> — switch country in the top bar.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <div className="text-2xl font-bold">
                {money(p.price?.amountMinor ?? null, p.price?.currency ?? null)}
              </div>
              <div className="text-sm text-muted-foreground">
                {p.price ? `${p.stock} in stock` : 'Not available in this country'}
              </div>
            </CardHeader>
            <CardContent />
            <CardFooter>
              <Button
                className="w-full"
                disabled={!p.price || p.stock < 1 || adding === p.id}
                onClick={() => add(p.id)}
              >
                {adding === p.id ? 'Adding…' : 'Add to cart'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
