'use client';

import {
  BadgePercent, Boxes, LayoutDashboard, ListTree, PackageSearch,
  ShoppingCart, Star, Undo2, Settings, Store,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useMe } from '@/features/auth/api';
import { useAuthModal } from '@/features/auth/auth-modal.store';
import { sseUrl } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/products', label: 'Products', icon: PackageSearch },
  { href: '/admin/categories', label: 'Categories', icon: ListTree },
  { href: '/admin/attributes', label: 'Attributes', icon: Boxes },
  { href: '/admin/returns', label: 'Returns', icon: Undo2 },
  { href: '/admin/coupons', label: 'Coupons', icon: BadgePercent },
  { href: '/admin/reviews', label: 'Reviews', icon: Star },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useMe();
  const pathname = usePathname();
  const qc = useQueryClient();
  const openLogin = useAuthModal((s) => s.openLogin);
  const isAdmin = !!me?.roles?.includes('admin');
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!isLoading && !me) openLogin('/admin');
  }, [isLoading, me, openLogin]);

  // Live updates: refresh orders/returns as they change server-side (SSE).
  useEffect(() => {
    if (!isAdmin) return;
    const es = new EventSource(sseUrl('/api/admin/events'));
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = (e) => {
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      qc.invalidateQueries({ queryKey: ['admin', 'returns'] });
      try {
        const ev = JSON.parse(e.data);
        if (ev?.type?.startsWith('order')) toast.info(`Order ${ev.status ?? 'updated'}`);
        if (ev?.type?.startsWith('return')) toast.info('Return updated');
      } catch {}
    };
    return () => es.close();
  }, [isAdmin, qc]);

  if (!isAdmin) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Admins only — redirecting…</div>;
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <Link href="/admin" className="flex items-center gap-2 px-6 py-5 text-lg font-bold">
          <Store className="size-5 text-sidebar-primary" /> Admin
          <span
            className={cn('ml-auto size-2 rounded-full', live ? 'bg-success' : 'bg-muted-foreground/40')}
            title={live ? 'Live' : 'Offline'}
          />
        </Link>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/" className="border-t px-6 py-4 text-sm text-muted-foreground hover:text-foreground">
          ← Back to store
        </Link>
      </aside>

      <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
