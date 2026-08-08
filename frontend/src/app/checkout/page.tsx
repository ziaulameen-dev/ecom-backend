'use client';

import { load } from '@cashfreepayments/cashfree-js';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { get, post } from '@/lib/api';
import { useStore } from '@/lib/store';
import { money } from '@/lib/utils';

interface Address {
  id: string; fullName: string; line1: string; city: string; country: string; isDefault: boolean;
}
interface CheckoutResult {
  orderId: string; currency: string; paymentSessionId: string; appId: string; mode: string;
  amounts: { subtotalMinor: number; shippingMinor: number; taxMinor: number; totalMinor: number };
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, country } = useStore();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  // New-address form
  const [form, setForm] = useState({ fullName: '', phone: '', line1: '', city: '', postalCode: '', country });

  const loadAddresses = () =>
    get('/api/addresses').then((a: Address[]) => {
      setAddresses(a);
      const match = a.find((x) => x.country === country && x.isDefault) || a.find((x) => x.country === country);
      if (match) setSelected(match.id);
    });

  useEffect(() => { loadAddresses().catch((e) => setErr(e.message)); }, [country]);

  async function addAddress() {
    setErr('');
    try {
      const a = await post('/api/addresses', { ...form, country });
      await loadAddresses();
      setSelected(a.id);
      setForm({ fullName: '', phone: '', line1: '', city: '', postalCode: '', country });
    } catch (e) { setErr((e as Error).message); }
  }

  // Poll our order until the webhook flips it to paid (source of truth).
  async function confirmOrder(orderId: string) {
    setStatus('Confirming your order…');
    for (let i = 0; i < 15; i++) {
      const o = await get(`/api/orders/${orderId}`).catch(() => null);
      if (o?.status === 'paid') { setStatus('Order confirmed!'); setTimeout(() => router.push('/orders'), 800); return; }
      if (o?.status === 'cancelled' || o?.status === 'failed') { setStatus('Payment did not complete.'); setBusy(false); return; }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setStatus('Payment done; order still confirming — check Orders shortly.');
    setTimeout(() => router.push('/orders'), 1500);
  }

  async function placeOrder() {
    setErr(''); setBusy(true); setStatus('');
    try {
      const result: CheckoutResult = await post('/api/checkout', { addressId: selected });
      const cashfree = await load({ mode: result.mode === 'production' ? 'production' : 'sandbox' });
      const res = await cashfree.checkout({
        paymentSessionId: result.paymentSessionId,
        redirectTarget: '_modal',
      });
      if (res.error) { setStatus(res.error.message || 'Payment cancelled.'); setBusy(false); return; }
      await confirmOrder(result.orderId);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Checkout</h1>
      <p className="text-muted-foreground mb-6">Shipping to <strong>{country}</strong>.</p>

      <Card className="mb-4">
        <CardHeader><CardTitle>Shipping address</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {addresses.filter((a) => a.country === country).map((a) => (
            <label key={a.id} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer">
              <input type="radio" name="addr" checked={selected === a.id} onChange={() => setSelected(a.id)} />
              <span className="text-sm">
                <strong>{a.fullName}</strong> — {a.line1}, {a.city}, {a.country}
                {a.isDefault && ' (default)'}
              </span>
            </label>
          ))}
          {addresses.filter((a) => a.country === country).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No address in {country} yet — add one below.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Input placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input className="col-span-2" placeholder="Address line 1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} />
            <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input placeholder="Postal code" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
            <Input placeholder="Country" value={country} disabled />
          </div>
          <Button variant="secondary" size="sm" onClick={addAddress} disabled={!form.fullName || !form.line1 || !form.city}>
            Save address ({country})
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mb-4">
        <span>Subtotal</span>
        <span className="font-medium">{money(cart?.subtotalMinor ?? 0, cart?.currency ?? country)}</span>
      </div>

      <Button className="w-full" size="lg" disabled={!selected || busy} onClick={placeOrder}>
        {busy ? 'Processing…' : 'Pay now'}
      </Button>
      <p className="text-xs text-muted-foreground mt-3">
        Test UPI: <strong>success@upi</strong> · test card 4111 1111 1111 1111, any future date / CVC.
      </p>
      {status && <p className="text-sm mt-3">{status}</p>}
      {err && <p className="text-sm text-destructive mt-3">{err}</p>}
    </div>
  );
}
