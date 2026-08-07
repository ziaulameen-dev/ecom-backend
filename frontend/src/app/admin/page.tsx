'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { get, patch, post, put } from '@/lib/api';
import { useStore } from '@/lib/store';
import { COUNTRIES, money } from '@/lib/utils';

const ORDER_STATUSES = ['pending', 'paid', 'failed', 'cancelled', 'refunded', 'fulfilled', 'shipped', 'delivered'];

export default function AdminPage() {
  const { ready, isAdmin } = useStore();

  if (ready && !isAdmin) {
    return <p className="text-muted-foreground">Admins only. Sign in as an admin (admin@example.com).</p>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <PricesSection />
      <ShippingSection />
      <OrdersSection />
      <ReturnsSection />
    </div>
  );
}

function PricesSection() {
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({ productId: '', country: 'US', currency: 'usd', amountMinor: 0 });
  const [msg, setMsg] = useState('');

  useEffect(() => { get('/api/products?country=US').then((p) => { setProducts(p); if (p[0]) setF((s) => ({ ...s, productId: p[0].id })); }); }, []);

  async function save() {
    setMsg('');
    try {
      await put(`/api/products/${f.productId}/prices`, { country: f.country, currency: f.currency, amountMinor: Number(f.amountMinor) });
      setMsg('Saved ✓');
    } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Product price by country</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-5 items-end">
        <div className="space-y-1 sm:col-span-2">
          <Label>Product</Label>
          <select className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value })}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="space-y-1"><Label>Country</Label>
          <select className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
        <div className="space-y-1"><Label>Currency</Label><Input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} /></div>
        <div className="space-y-1"><Label>Amount (minor)</Label><Input type="number" value={f.amountMinor} onChange={(e) => setF({ ...f, amountMinor: Number(e.target.value) })} /></div>
        <Button onClick={save} className="sm:col-span-5 sm:w-auto">Save price</Button>
        {msg && <p className="text-sm sm:col-span-5">{msg}</p>}
      </CardContent>
    </Card>
  );
}

function ShippingSection() {
  const [rates, setRates] = useState<{ country: string; currency: string; amountMinor: number }[]>([]);
  const [f, setF] = useState({ country: 'US', currency: 'usd', amountMinor: 0 });
  const [msg, setMsg] = useState('');

  const load = () => get('/api/shipping-rates').then(setRates).catch(() => setRates([]));
  useEffect(() => { load(); }, []);

  async function save() {
    setMsg('');
    try {
      await put('/api/shipping-rates', { country: f.country, currency: f.currency, amountMinor: Number(f.amountMinor) });
      setMsg('Saved ✓'); await load();
    } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Delivery charge by country</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-4 items-end">
          <div className="space-y-1"><Label>Country</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label>Currency</Label><Input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} /></div>
          <div className="space-y-1"><Label>Amount (minor)</Label><Input type="number" value={f.amountMinor} onChange={(e) => setF({ ...f, amountMinor: Number(e.target.value) })} /></div>
          <Button onClick={save}>Save rate</Button>
        </div>
        {msg && <p className="text-sm">{msg}</p>}
        <div className="text-sm text-muted-foreground">
          {rates.map((r) => <span key={r.country} className="mr-4">{r.country}: {money(r.amountMinor, r.currency)}</span>)}
        </div>
      </CardContent>
    </Card>
  );
}

function OrdersSection() {
  const [orders, setOrders] = useState<{ id: string; status: string; currency: string; totalMinor: number }[]>([]);
  const load = () => get('/api/admin/orders').then(setOrders).catch(() => {});
  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    await patch(`/api/admin/orders/${id}/status`, { status });
    await load();
  }
  async function refund(id: string) {
    if (!confirm('Full refund this order?')) return;
    await post(`/api/admin/orders/${id}/refund`, {}); // omit amount = full
    await load();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Orders</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {orders.map((o) => (
          <div key={o.id} className="flex items-center gap-3 text-sm border-b py-2">
            <span className="font-mono">#{o.id.slice(0, 8)}</span>
            <span className="text-muted-foreground">{money(o.totalMinor, o.currency)}</span>
            <select className="ml-auto h-9 rounded-md border border-input bg-background px-2" value={o.status} onChange={(e) => setStatus(o.id, e.target.value)}>
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Button
              variant="outline"
              size="sm"
              disabled={['refunded', 'cancelled', 'pending', 'failed'].includes(o.status)}
              onClick={() => refund(o.id)}
            >
              Refund
            </Button>
          </div>
        ))}
        {orders.length === 0 && <p className="text-sm text-muted-foreground">No orders.</p>}
      </CardContent>
    </Card>
  );
}

function ReturnsSection() {
  const [returns, setReturns] = useState<
    { id: string; orderId: string; status: string; reason: string | null; refundMinor: number }[]
  >([]);
  const load = () => get('/api/admin/returns').then(setReturns).catch(() => {});
  useEffect(() => { load(); }, []);

  async function act(id: string, action: 'approve' | 'reject' | 'receive' | 'refund') {
    await patch(`/api/admin/returns/${id}`, { action });
    await load();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Returns (RMA)</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {returns.map((r) => (
          <div key={r.id} className="flex items-center gap-3 text-sm border-b py-2">
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
              <Button variant="outline" size="sm" onClick={() => act(r.id, 'receive')}>Mark received</Button>
            )}
            {r.status === 'received' && (
              <Button size="sm" onClick={() => act(r.id, 'refund')}>Refund + restock</Button>
            )}
          </div>
        ))}
        {returns.length === 0 && <p className="text-sm text-muted-foreground">No returns.</p>}
      </CardContent>
    </Card>
  );
}
