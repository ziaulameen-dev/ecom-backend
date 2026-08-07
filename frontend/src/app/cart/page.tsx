'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { money } from '@/lib/utils';

export default function CartPage() {
  const { cart, user, setItemQty, removeItem } = useStore();

  const setQty = (productId: string, quantity: number) => setItemQty(productId, quantity);
  const remove = (productId: string) => removeItem(productId);

  if (!cart || cart.items.length === 0) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-semibold mb-2">Your cart is empty</h1>
        <Link href="/"><Button>Continue shopping</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Cart ({cart.country})</h1>
      <div className="space-y-3">
        {cart.items.map((it) => (
          <Card key={it.productId}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex-1">
                <div className="font-medium">{it.name}</div>
                <div className="text-sm text-muted-foreground">
                  {money(it.unitAmountMinor, cart.currency)}
                  {!it.available && ' · unavailable here'}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={() => setQty(it.productId, it.quantity - 1)}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center">{it.quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={it.quantity >= it.stock}
                  onClick={() => setQty(it.productId, it.quantity + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="w-24 text-right font-medium">
                {money(it.lineTotalMinor, cart.currency)}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(it.productId)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between border-t pt-4">
        <span className="text-lg">Subtotal</span>
        <span className="text-xl font-bold">
          {money(cart.subtotalMinor, cart.currency)}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        Shipping & tax are calculated at checkout.
      </p>

      <div className="mt-6">
        {user ? (
          <Link href="/checkout"><Button className="w-full" size="lg">Checkout</Button></Link>
        ) : (
          <Link href="/login?next=/checkout">
            <Button className="w-full" size="lg">Login to checkout</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
