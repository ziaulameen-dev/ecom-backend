'use client';

import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/api';
import { useAuthModal } from '@/features/auth/auth-modal.store';
import { useCart, useRemoveCartItem, useUpdateCartItem } from '@/features/cart/api';
import { money } from '@/lib/utils';

export default function CartPage() {
  const { data: cart, isLoading } = useCart();
  const { data: me } = useMe();
  const openLogin = useAuthModal((s) => s.openLogin);
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-6 h-24 w-full" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <ShoppingBag className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">Your cart is empty</h1>
        <Link href="/shop"><Button className="mt-6">Continue shopping</Button></Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Your cart</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {cart.items.map((it) => (
            <Card key={it.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
                  {it.imageUrl && <Image src={it.imageUrl} alt={it.name} fill className="object-cover" sizes="80px" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{it.name}</div>
                  {it.label && <div className="text-xs text-muted-foreground">{it.label}</div>}
                  <div className="mt-1 text-sm text-muted-foreground">{money(it.unitAmountMinor, cart.currency)}</div>
                  {!it.available && <div className="text-xs text-destructive">Unavailable</div>}
                </div>
                <div className="flex items-center rounded-md border">
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => update.mutate({ itemId: it.id, quantity: it.quantity - 1 })}><Minus /></Button>
                  <span className="w-8 text-center text-sm tabular-nums">{it.quantity}</span>
                  <Button variant="ghost" size="icon" className="size-8" disabled={it.quantity >= it.stock} onClick={() => update.mutate({ itemId: it.id, quantity: it.quantity + 1 })}><Plus /></Button>
                </div>
                <div className="w-20 text-right font-medium">{money(it.lineTotalMinor, cart.currency)}</div>
                <Button variant="ghost" size="icon" onClick={() => remove.mutate(it.id)}><Trash2 /></Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="h-fit lg:sticky lg:top-20">
          <CardContent className="space-y-4 p-6">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{money(cart.subtotalMinor, cart.currency)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Shipping, tax & discounts calculated at checkout.</p>
            <Separator />
            {me ? (
              <Link href="/checkout" className="block"><Button className="w-full" size="lg">Checkout</Button></Link>
            ) : (
              <Button className="w-full" size="lg" onClick={() => openLogin('/checkout')}>Login to checkout</Button>
            )}
            <Link href="/shop" className="block text-center text-sm text-muted-foreground hover:text-foreground">
              Continue shopping
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
