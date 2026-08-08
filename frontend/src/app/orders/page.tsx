'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthImage } from '@/components/auth-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { get, post, postForm } from '@/lib/api';
import { useStore } from '@/lib/store';
import { money } from '@/lib/utils';

interface OrderItem { productId: string; name: string; quantity: number; unitAmountMinor: number }
interface Order {
  id: string; reference: string | null; status: string; currency: string;
  totalMinor: number; createdAt: string; items: OrderItem[];
}
interface ReturnReq {
  id: string; orderId: string; status: string; refundMinor: number; images: string[];
}

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
  const [returningId, setReturningId] = useState<string | null>(null);

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
    const reason = window.prompt('Reason for cancelling? (optional)');
    if (reason === null) return; // dialog dismissed
    setBusy(id);
    try {
      await post(`/api/orders/${id}/cancel`, reason ? { reason } : {});
      await load();
    } finally { setBusy(null); }
  }

  const label = (o: Order) => o.reference || `#${o.id.slice(0, 8)}`;

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
          <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
            All {orders.length}
          </Button>
          {statuses.map((s) => (
            <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" className="capitalize" onClick={() => setFilter(s)}>
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
                <CardTitle className="text-base font-mono">{label(o)}</CardTitle>
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
                  {RETURNABLE.includes(o.status) && !ret && returningId !== o.id && (
                    <Button variant="outline" size="sm" onClick={() => setReturningId(o.id)}>
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

                {ret && ret.images?.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {ret.images.map((key) => (
                      <AuthImage
                        key={key}
                        path={`/api/returns/${ret.id}/images/${key.split('/').pop()}`}
                        className="h-14 w-14 rounded object-cover border"
                      />
                    ))}
                  </div>
                )}

                {returningId === o.id && (
                  <ReturnForm
                    order={o}
                    onCancel={() => setReturningId(null)}
                    onDone={async () => { setReturningId(null); await load(); }}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/** Inline "request return" form: reason + optional evidence images. */
function ReturnForm({ order, onCancel, onDone }: { order: Order; onCancel: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    setBusy(true); setErr('');
    try {
      const rr = await post(`/api/orders/${order.id}/returns`, {
        reason: reason || undefined,
        items: order.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      if (files && files.length) {
        const fd = new FormData();
        Array.from(files).slice(0, 5).forEach((f) => fd.append('images', f));
        await postForm(`/api/returns/${rr.id}/images`, fd);
      }
      onDone();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div className="mt-3 rounded-md border p-3 space-y-2 bg-muted/30">
      <p className="text-sm font-medium">Request a return (whole order)</p>
      <Input placeholder="Reason (e.g. defective, wrong item)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="text-sm"
          onChange={(e) => setFiles(e.target.files)}
        />
        <p className="text-xs text-muted-foreground mt-1">Up to 5 photos (JPG/PNG/WEBP), 5 MB each.</p>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit return'}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
