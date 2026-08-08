'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { get, post } from '@/lib/api';
import { useStore } from '@/lib/store';
import { money } from '@/lib/utils';

interface OrderItem { productId: string; name: string; quantity: number; unitAmountMinor: number }
interface Order {
  id: string; status: string; currency: string; totalMinor: number; createdAt: string;
  items: OrderItem[];
}
interface ReturnReq { id: string; orderId: string; status: string; refundMinor: number }

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  paid: 'default', shipped: 'default', delivered: 'default', fulfilled: 'default',
  pending: 'secondary', failed: 'destructive', cancelled: 'destructive', refunded: 'outline',
};

const CANCELABLE = ['pending', 'paid'];
const RETURNABLE = ['shipped', 'delivered', 'fulfilled'];

export default function OrdersPage() {
  const { ready, user } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnReq[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    const [o, r] = await Promise.all([
      get('/api/orders').catch(() => []),
      get('/api/returns').catch(() => []),
    ]);
    setOrders(o); setReturns(r); setLoaded(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user) { setLoaded(true); return; }
    load();
  }, [ready, user, load]);

  async function cancel(id: string) {
    setBusy(id);
    try { await post(`/api/orders/${id}/cancel`); await load(); } finally { setBusy(null); }
  }

  async function requestReturn(o: Order) {
    const reason = window.prompt('Reason for return? (returns the whole order)') ?? undefined;
    if (reason === undefined) return;
    setBusy(o.id);
    try {
      await post(`/api/orders/${o.id}/returns`, {
        reason,
        items: o.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      await load();
    } finally { setBusy(null); }
  }

  if (loaded && !user) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-semibold mb-2">Please sign in to see your orders</h1>
        <Link href="/login?next=/orders"><Button>Login</Button></Link>
      </div>
    );
  }

  const returnFor = (orderId: string) => returns.find((r) => r.orderId === orderId);

  const counts = orders.reduce<Record<string, number>>((m, o) => {
    m[o.status] = (m[o.status] ?? 0) + 1;
    return m;
  }, {});
  const statuses = Object.keys(counts).sort();
  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-4">Your orders</h1>
      {orders.length === 0 && loaded && <p className="text-muted-foreground">No orders yet.</p>}

      {orders.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-6">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All {orders.length}
          </Button>
          {statuses.map((s) => (
            <Button
              key={s}
              variant={filter === s ? 'default' : 'outline'}
              size="sm"
              className="capitalize"
              onClick={() => setFilter(s)}
            >
              {s} {counts[s]}
            </Button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((o) => {
          const ret = returnFor(o.id);
          return (
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

                <div className="flex items-center gap-2 mt-3">
                  {CANCELABLE.includes(o.status) && (
                    <Button variant="outline" size="sm" disabled={busy === o.id} onClick={() => cancel(o.id)}>
                      Cancel
                    </Button>
                  )}
                  {RETURNABLE.includes(o.status) && !ret && (
                    <Button variant="outline" size="sm" disabled={busy === o.id} onClick={() => requestReturn(o)}>
                      Request return
                    </Button>
                  )}
                  {ret && (
                    <span className="text-xs text-muted-foreground">
                      Return: <strong>{ret.status}</strong>
                      {ret.refundMinor > 0 && ` · refunded ${money(ret.refundMinor, o.currency)}`}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
