'use client';

import { ShoppingCart, Store } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';

export function Nav() {
  const { cart, user, isAdmin, logout } = useStore();
  return (
    <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
      <div className="container flex h-14 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Store className="h-5 w-5" /> Ecom
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/"><Button variant="ghost" size="sm">Shop</Button></Link>
          <Link href="/orders"><Button variant="ghost" size="sm">Orders</Button></Link>
          {isAdmin && (
            <Link href="/admin"><Button variant="ghost" size="sm">Admin</Button></Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link href="/cart" className="relative">
            <Button variant="outline" size="icon">
              <ShoppingCart className="h-4 w-4" />
            </Button>
            {!!cart?.itemCount && (
              <Badge className="absolute -right-2 -top-2 h-5 min-w-5 justify-center px-1">
                {cart.itemCount}
              </Badge>
            )}
          </Link>

          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-sm text-muted-foreground">
                {user.name || user.email}
              </span>
              <Button variant="secondary" size="sm" onClick={() => logout()}>
                Logout
              </Button>
            </div>
          ) : (
            <Link href="/login"><Button size="sm">Login</Button></Link>
          )}
        </div>
      </div>
    </header>
  );
}
