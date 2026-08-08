'use client';

import { useEffect, useState } from 'react';
import { AuthImage } from '@/components/auth-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { del, get, patch, post, put, sseUrl } from '@/lib/api';
import { useStore } from '@/lib/store';
import { money } from '@/lib/utils';

export default function AdminPage() {
  const { ready, isAdmin } = useStore();
  // A live "revision": incremented on every SSE event so sections re-fetch.
  const [rev, setRev] = useState(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    const es = new EventSource(sseUrl('/api/admin/events'));
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = () => setRev((v) => v + 1); // orders/returns changed → reload
    return () => es.close();
  }, [isAdmin]);

  if (ready && !isAdmin) {
    return <p className="text-muted-foreground">Admins only. Sign in as an admin (admin@example.com).</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${live ? 'text-green-600 border-green-600' : 'text-muted-foreground'}`}>
          {live ? '● live' : '○ offline'}
        </span>
      </div>
      <ProductsSection />
      <ShippingSection />
      <OrdersSection rev={rev} />
      <ReturnsSection rev={rev} />
    </div>
  );
}

interface AdminProduct {
  id: string; name: string; stock: number; category: string | null;
  description: string | null; imageUrl: string | null;
  price: { currency: string; amountMinor: number };
}

function ProductsSection() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [stockEdits, setStockEdits] = useState<Record<string, number>>({});
  const [priceEdits, setPriceEdits] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ name: '', stock: 0, priceMinor: 0, category: '', imageUrl: '', description: '' });
  const [msg, setMsg] = useState('');

  const load = () => get('/api/products').then(setProducts).catch(() => {});
  useEffect(() => { load(); }, []);

  async function saveRow(id: string) {
    const body: Record<string, number> = {};
    if (stockEdits[id] != null) body.stock = Number(stockEdits[id]);
    if (priceEdits[id] != null) body.priceMinor = Number(priceEdits[id]);
    if (Object.keys(body).length === 0) return;
    await patch(`/api/products/${id}`, body);
    setStockEdits((s) => { const n = { ...s }; delete n[id]; return n; });
    setPriceEdits((s) => { const n = { ...s }; delete n[id]; return n; });
    await load();
  }
  async function create() {
    setMsg('');
    try {
      await post('/api/products', {
        name: form.name,
        stock: Number(form.stock),
        priceMinor: Number(form.priceMinor),
        category: form.category || undefined,
        imageUrl: form.imageUrl || undefined,
        description: form.description || undefined,
      });
      setForm({ name: '', stock: 0, priceMinor: 0, category: '', imageUrl: '', description: '' });
      setMsg('Created ✓');
      await load();
    } catch (e) { setMsg((e as Error).message); }
  }
  async function remove(id: string) {
    if (!confirm('Delete this product?')) return;
    await del(`/api/products/${id}`);
    await load();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Products, price & stock</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {products.map((p) => {
          const dirty = stockEdits[p.id] != null || priceEdits[p.id] != null;
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 text-sm border-b py-2">
              <span className="font-medium">{p.name}</span>
              {p.category && <span className="text-muted-foreground capitalize">{p.category}</span>}
              <div className="ml-auto flex items-center gap-2">
                <Label className="text-muted-foreground">Price (paise)</Label>
                <Input
                  type="number"
                  className="h-9 w-28"
                  value={priceEdits[p.id] ?? p.price.amountMinor}
                  onChange={(e) => setPriceEdits((s) => ({ ...s, [p.id]: Number(e.target.value) }))}
                />
                <Label className="text-muted-foreground">Stock</Label>
                <Input
                  type="number"
                  className="h-9 w-24"
                  value={stockEdits[p.id] ?? p.stock}
                  onChange={(e) => setStockEdits((s) => ({ ...s, [p.id]: Number(e.target.value) }))}
                />
                <Button variant="outline" size="sm" disabled={!dirty} onClick={() => saveRow(p.id)}>Save</Button>
                <Button variant="ghost" size="sm" onClick={() => remove(p.id)}>Delete</Button>
              </div>
            </div>
          );
        })}

        <div className="pt-2 border-t">
          <p className="text-sm font-medium mb-2">Add product</p>
          <div className="grid gap-2 sm:grid-cols-6 items-end">
            <div className="space-y-1 sm:col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Price (paise)</Label><Input type="number" value={form.priceMinor} onChange={(e) => setForm({ ...form, priceMinor: Number(e.target.value) })} /></div>
            <div className="space-y-1"><Label>Stock</Label><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} /></div>
            <div className="space-y-1"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-3"><Label>Image URL</Label><Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-5"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <Button disabled={form.name.length < 2} onClick={create}>Add</Button>
          </div>
          {msg && <p className="text-sm mt-2">{msg}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function ShippingSection() {
  const [amountMinor, setAmountMinor] = useState(0);
  const [msg, setMsg] = useState('');

  const load = () =>
    get('/api/shipping-rate').then((r) => setAmountMinor(r.amountMinor ?? 0)).catch(() => {});
  useEffect(() => { load(); }, []);

  async function save() {
    setMsg('');
    try {
      await put('/api/shipping-rate', { amountMinor: Number(amountMinor) });
      setMsg('Saved ✓'); await load();
    } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Delivery charge</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-4 items-end">
          <div className="space-y-1"><Label>Amount (paise)</Label><Input type="number" value={amountMinor} onChange={(e) => setAmountMinor(Number(e.target.value))} /></div>
          <Button onClick={save}>Save rate</Button>
        </div>
        {msg && <p className="text-sm">{msg}</p>}
        <p className="text-sm text-muted-foreground">Flat delivery charge: {money(amountMinor)}</p>
      </CardContent>
    </Card>
  );
}

interface AdminOrder {
  id: string; reference: string | null; status: string; currency: string;
  totalMinor: number; refundedMinor: number;
  customerEmail: string | null; carrier: string | null; trackingNumber: string | null;
}

const badgeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  paid: 'default', shipped: 'default', delivered: 'default', fulfilled: 'default',
  pending: 'secondary', processing: 'secondary',
  failed: 'destructive', cancelled: 'destructive', disputed: 'destructive', refunded: 'outline',
};

function OrdersSection({ rev }: { rev: number }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState('all');
  const load = () => get('/api/admin/orders').then(setOrders).catch(() => {});
  useEffect(() => { load(); }, [rev]);

  async function fulfill(id: string) {
    await patch(`/api/admin/orders/${id}/status`, { status: 'fulfilled' });
    await load();
  }
  async function ship(id: string) {
    const carrier = window.prompt('Carrier (e.g. UPS)?');
    if (!carrier) return;
    const trackingNumber = window.prompt('Tracking number?');
    if (!trackingNumber) return;
    await patch(`/api/admin/orders/${id}/tracking`, { carrier, trackingNumber });
    await patch(`/api/admin/orders/${id}/status`, { status: 'shipped' });
    await load();
  }
  async function deliver(id: string) {
    await patch(`/api/admin/orders/${id}/status`, { status: 'delivered' });
    await load();
  }
  async function refund(id: string) {
    if (!confirm('Full refund this order?')) return;
    await post(`/api/admin/orders/${id}/refund`, {});
    await load();
  }

  const counts = orders.reduce<Record<string, number>>((m, o) => {
    m[o.status] = (m[o.status] ?? 0) + 1;
    return m;
  }, {});
  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  return (
    <Card>
      <CardHeader><CardTitle>Orders</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-1 pb-2">
          <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
            All {orders.length}
          </Button>
          {Object.keys(counts).sort().map((s) => (
            <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" className="capitalize" onClick={() => setFilter(s)}>
              {s} {counts[s]}
            </Button>
          ))}
        </div>
        {filtered.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm border-b py-2">
            <span className="font-mono">{o.reference || `#${o.id.slice(0, 8)}`}</span>
            <Badge variant={badgeVariant[o.status] || 'secondary'}>{o.status}</Badge>
            <span className="text-muted-foreground">{money(o.totalMinor, o.currency)}</span>
            {o.customerEmail && <span className="text-muted-foreground hidden md:inline">{o.customerEmail}</span>}
            {o.refundedMinor > 0 && <span className="text-xs text-muted-foreground">refunded {money(o.refundedMinor, o.currency)}</span>}
            {o.trackingNumber && <span className="text-xs">📦 {o.carrier} {o.trackingNumber}</span>}
            <div className="ml-auto flex gap-1">
              {o.status === 'paid' && <Button variant="outline" size="sm" onClick={() => fulfill(o.id)}>Fulfill</Button>}
              {['paid', 'fulfilled'].includes(o.status) && <Button variant="outline" size="sm" onClick={() => ship(o.id)}>Ship</Button>}
              {o.status === 'shipped' && <Button variant="outline" size="sm" onClick={() => deliver(o.id)}>Delivered</Button>}
              {['paid', 'fulfilled', 'shipped', 'delivered'].includes(o.status) && (
                <Button variant="ghost" size="sm" onClick={() => refund(o.id)}>Refund</Button>
              )}
            </div>
          </div>
        ))}
        {orders.length === 0 && <p className="text-sm text-muted-foreground">No orders.</p>}
      </CardContent>
    </Card>
  );
}

interface AdminReturn {
  id: string; orderId: string; status: string; reason: string | null;
  refundMinor: number; images: string[];
}

function ReturnsSection({ rev }: { rev: number }) {
  const [returns, setReturns] = useState<AdminReturn[]>([]);
  const load = () => get('/api/admin/returns').then(setReturns).catch(() => {});
  useEffect(() => { load(); }, [rev]);

  async function act(id: string, action: 'approve' | 'reject' | 'receive' | 'refund') {
    await patch(`/api/admin/returns/${id}`, { action });
    await load();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Returns (RMA)</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {returns.map((r) => (
          <div key={r.id} className="border-b py-2 space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-mono">order #{r.orderId.slice(0, 8)}</span>
              <span className="text-muted-foreground">{r.reason || '—'}</span>
              <span className="ml-auto font-medium">{r.status}</span>
              {r.status === 'requested' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => act(r.id, 'approve')}>Approve</Button>
                  <Button variant="ghost" size="sm" onClick={() => act(r.id, 'reject')}>Reject</Button>
                </>
              )}
              {r.status === 'approved' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => act(r.id, 'receive')}>Mark received</Button>
                  <Button variant="ghost" size="sm" onClick={() => act(r.id, 'reject')}>Reject</Button>
                </>
              )}
              {r.status === 'received' && (
                <>
                  <Button size="sm" onClick={() => act(r.id, 'refund')}>Refund + restock</Button>
                  <Button variant="ghost" size="sm" onClick={() => act(r.id, 'reject')}>Reject (damaged)</Button>
                </>
              )}
            </div>
            {r.images?.length > 0 && (
              <div className="flex gap-2">
                {r.images.map((key) => (
                  <AuthImage
                    key={key}
                    path={`/api/returns/${r.id}/images/${key.split('/').pop()}`}
                    className="h-16 w-16 rounded object-cover border"
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        {returns.length === 0 && <p className="text-sm text-muted-foreground">No returns.</p>}
      </CardContent>
    </Card>
  );
}
