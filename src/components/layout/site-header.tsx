'use client';

import { Heart, Search, ShoppingBag, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from '@/features/cart/api';
import { useMe } from '@/features/auth/api';
import { STORE_NAME } from '@/lib/config';
import { cn } from '@/lib/utils';

const NAV = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/shop' },
  { label: 'Watches', href: '/shop?category=watches' },
  { label: 'Perfumes', href: '/shop?category=perfumes' },
];

export function SiteHeader() {
  const { data: cart } = useCart();
  const { data: me } = useMe();
  const router = useRouter();
  const [q, setQ] = useState('');
  const count = cart?.itemCount ?? 0;

  function search(e: React.FormEvent) {
    e.preventDefault();
    router.push(q.trim() ? `/shop?search=${encodeURIComponent(q.trim())}` : '/shop');
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
        <Link href="/" className="text-xl font-bold tracking-tight">
          {STORE_NAME}
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button variant="ghost" size="sm" className="text-sm">
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>

        <form onSubmit={search} className="relative ml-auto hidden max-w-xs flex-1 lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            className="pl-9"
          />
        </form>

        <div className={cn('flex items-center gap-1', 'lg:ml-2 ml-auto')}>
          <Link href="/account" aria-label="Account">
            <Button variant="ghost" size="icon">
              <User />
            </Button>
          </Link>
          <Link href="/account?tab=wishlist" aria-label="Wishlist" className="hidden sm:inline-flex">
            <Button variant="ghost" size="icon">
              <Heart />
            </Button>
          </Link>
          <Link href="/cart" aria-label="Cart" className="relative">
            <Button variant="ghost" size="icon">
              <ShoppingBag />
            </Button>
            {count > 0 && (
              <Badge
                variant="brand"
                className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 tabular-nums"
              >
                {count}
              </Badge>
            )}
          </Link>
          {!me && (
            <Link href="/login" className="ml-1 hidden sm:inline-flex">
              <Button size="sm">Login</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
