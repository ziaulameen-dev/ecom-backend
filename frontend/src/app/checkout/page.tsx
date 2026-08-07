'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { get, post } from '@/lib/api';
import { useStore } from '@/lib/store';
import { money } from '@/lib/utils';

interface Address {
  id: string; fullName: string; line1: string; city: string; country: string; isDefault: boolean;
}
interface CheckoutResult {
  orderId: string; currency: string; clientSecret: string; publishableKey: string;
  amounts: { subtotalMinor: number; shippingMinor: number; taxMinor: number; totalMinor: number };
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, country } = useStore();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [checkout, setCheckout] = useState<CheckoutResult | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // New-address form
  const [form, setForm] = useState({ fullName: '', line1: '', city: '', postalCode: '', country });

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
      setForm({ fullName: '', line1: '', city: '', postalCode: '', country });
    } catch (e) { setErr((e as Error).message); }
  }

  async function placeOrder() {
    setErr(''); setBusy(true);
    try {
      setCheckout(await post('/api/checkout', { addressId: selected }));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (checkout ? loadStripe(checkout.publishableKey) : null),
    [checkout],
  );

  if (checkout && stripePromise) {
    return (
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Payment</h1>
        <Card>
          <CardContent className="pt-6">
            <Elements stripe={stripePromise} options={{ clientSecret: checkout.clientSecret }}>
              <PayForm orderId={checkout.orderId} amounts={checkout.amounts} currency={checkout.currency} onDone={() => router.push('/orders')} />
            </Elements>
          </CardContent>
        </Card>
      </div>
    );
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
            <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input className="col-span-2" placeholder="Address line 1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} />
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
        {busy ? 'Preparing…' : 'Continue to payment'}
      </Button>
      {err && <p className="text-sm text-destructive mt-3">{err}</p>}
    </div>
  );
}

function PayForm({
  orderId, amounts, currency, onDone,
}: {
  orderId: string;
  amounts: CheckoutResult['amounts'];
  currency: string;
  onDone: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (!stripe || !elements) return;
    setBusy(true); setStatus('');
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.origin + '/orders' },
      redirect: 'if_required',
    });
    if (error) { setStatus(error.message || 'Payment failed'); setBusy(false); return; }

    // Payment authorized; our order is marked paid by the webhook — poll for it.
    setStatus('Payment received — confirming order…');
    for (let i = 0; i < 12; i++) {
      const o = await get(`/api/orders/${orderId}`).catch(() => null);
      if (o?.status === 'paid') { setStatus('Order confirmed!'); setTimeout(onDone, 800); return; }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setStatus('Payment done; order still confirming — check Orders shortly.');
    setTimeout(onDone, 1500);
  }

  return (
    <div className="space-y-4">
      <div className="text-sm space-y-1">
        <Row label="Subtotal" v={money(amounts.subtotalMinor, currency)} />
        <Row label="Shipping" v={money(amounts.shippingMinor, currency)} />
        <Row label="Tax" v={money(amounts.taxMinor, currency)} />
        <div className="border-t pt-1 flex justify-between font-semibold">
          <span>Total</span><span>{money(amounts.totalMinor, currency)}</span>
        </div>
      </div>
      <PaymentElement />
      <Button className="w-full" size="lg" disabled={!stripe || busy} onClick={pay}>
        {busy ? 'Processing…' : `Pay ${money(amounts.totalMinor, currency)}`}
      </Button>
      <p className="text-xs text-muted-foreground">Test card: 4242 4242 4242 4242 · any future date · any CVC.</p>
      {status && <p className="text-sm">{status}</p>}
    </div>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return <div className="flex justify-between text-muted-foreground"><span>{label}</span><span>{v}</span></div>;
}
