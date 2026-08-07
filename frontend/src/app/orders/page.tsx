'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { get } from '@/lib/api';
import { useStore } from '@/lib/store';
import { money } from '@/lib/utils';

interface Order {
  id: string; status: string; currency: string; totalMinor: number; createdAt: string;
  items: { name: string; quantity: number; unitAmountMinor: number }[];
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  paid: 'default', shipped: 'default', delivered: 'default', fulfilled: 'default',
  pending: 'secondary', failed: 'destructive', cancelled: 'destructive', refunded: 'outline',
};

export default function OrdersPage() {
  const { ready, user } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) { setLoaded(true); return; }
    get('/api/orders').then(setOrders).catch(() => {}).finally(() => setLoaded(true));
  }, [ready, user]);

  if (loaded && !user) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-semibold mb-2">Please sign in to see your orders</h1>
        <Link href="/login?next=/orders"><Button>Login</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Your orders</h1>
      {orders.length === 0 && loaded && <p className="text-muted-foreground">No orders yet.</p>}
      <div className="space-y-3">
        {orders.map((o) => (
          <Card key={o.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-mono">#{o.id.slice(0, 8)}</CardTitle>
              <Badge variant={statusVariant[o.status] || 'secondary'}>{o.status}</Badge>
            </CardHeader>
            <CardContent className="text-sm">
              {o.items.map((it, i) => (
                <div key={i} className="flex justify-between text-muted-foreground">
                  <span>{it.name} × {it.quantity}</span>
                  <span>{money(it.unitAmountMinor * it.quantity, o.currency)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold border-t mt-2 pt-2">
                <span>Total</span><span>{money(o.totalMinor, o.currency)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
