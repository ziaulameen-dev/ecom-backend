'use client';

import { load } from '@cashfreepayments/cashfree-js';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useMe } from '@/features/auth/api';
import { useCart } from '@/features/cart/api';
import {
  useAddresses,
  useCreateAddress,
  type AddressInput,
} from '@/features/account/api';
import { AddressForm } from '@/features/account/components/address-form';
import { useCheckout, useValidateCoupon } from '@/features/checkout/api';
import { api } from '@/lib/api-client';
import { cn, money } from '@/lib/utils';

type Phase = 'form' | 'paying' | 'confirming' | 'done';

export default function CheckoutPage() {
  const router = useRouter();
  const { data: me, isLoading: meLoading } = useMe();
  const { data: cart } = useCart();
  const { data: addresses } = useAddresses();
  const createAddress = useCreateAddress();
  const validateCoupon = useValidateCoupon();
  const checkout = useCheckout();

  const [selected, setSelected] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discountMinor: number } | null>(null);
  const [phase, setPhase] = useState<Phase>('form');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!meLoading && !me) router.replace('/login?next=/checkout');
  }, [me, meLoading, router]);

  useEffect(() => {
    if (addresses?.length && !selected) {
      setSelected(addresses.find((a) => a.isDefault)?.id ?? addresses[0].id);
    }
  }, [addresses, selected]);

  const subtotal = cart?.subtotalMinor ?? 0;
  const discount = coupon?.discountMinor ?? 0;

  async function saveAddress(values: AddressInput) {
    try {
      const a = await createAddress.mutateAsync(values);
      setSelected(a.id);
      setAdding(false);
      toast.success('Address saved');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    try {
      const res = await validateCoupon.mutateAsync({ code: couponInput.trim(), subtotalMinor: subtotal });
      setCoupon({ code: res.code, discountMinor: res.discountMinor });
      toast.success(`Coupon ${res.code} applied`);
    } catch (e) {
      setCoupon(null);
      toast.error((e as Error).message);
    }
  }

  async function pollOrder(orderId: string) {
    setPhase('confirming');
    setStatus('Confirming your order…');
    for (let i = 0; i < 20; i++) {
      const o = await api.get<{ status: string }>(`/api/orders/${orderId}`).catch(() => null);
      if (o?.status === 'paid') {
        setPhase('done');
        setStatus('Payment successful!');
        setTimeout(() => router.push('/account?tab=orders'), 1200);
        return;
      }
      if (o?.status === 'cancelled' || o?.status === 'failed') {
        setPhase('form');
        toast.error('Payment did not complete.');
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setStatus('Payment received — your order will appear shortly.');
    setTimeout(() => router.push('/account?tab=orders'), 1500);
  }

  async function pay() {
    if (!selected) return toast.error('Select an address');
    setPhase('paying');
    try {
      const result = await checkout.mutateAsync({ addressId: selected, couponCode: coupon?.code });
      const cashfree = await load({ mode: result.mode === 'production' ? 'production' : 'sandbox' });
      const res = await cashfree.checkout({ paymentSessionId: result.paymentSessionId, redirectTarget: '_modal' });
      if (res.error) {
        setPhase('form');
        toast.error(res.error.message ?? 'Payment cancelled');
        return;
      }
      await pollOrder(result.orderId);
    } catch (e) {
      setPhase('form');
      toast.error((e as Error).message);
    }
  }

  if (phase === 'confirming' || phase === 'done') {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        {phase === 'done' ? (
          <CheckCircle2 className="mx-auto size-12 text-success" />
        ) : (
          <Loader2 className="mx-auto size-12 animate-spin text-muted-foreground" />
        )}
        <p className="mt-4 text-lg font-medium">{status}</p>
      </div>
    );
  }

  const empty = !cart || cart.items.length === 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Checkout</h1>

      {empty ? (
        <p className="mt-6 text-muted-foreground">Your cart is empty.</p>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* Address */}
          <Card>
            <CardHeader><CardTitle>Shipping address</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {addresses?.map((a) => (
                <label
                  key={a.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3',
                    selected === a.id && 'border-primary ring-1 ring-ring',
                  )}
                >
                  <input type="radio" name="addr" checked={selected === a.id} onChange={() => setSelected(a.id)} className="mt-1" />
                  <div className="text-sm">
                    <div className="font-medium">{a.fullName} {a.isDefault && <span className="text-xs text-muted-foreground">(default)</span>}</div>
                    <div className="text-muted-foreground">{a.line1}, {a.city} {a.postalCode}</div>
                    {a.phone && <div className="text-muted-foreground">{a.phone}</div>}
                  </div>
                </label>
              ))}

              {adding ? (
                <div className="rounded-lg border p-4">
                  <AddressForm onSubmit={saveAddress} submitting={createAddress.isPending} />
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setAdding(true)}>+ Add new address</Button>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="h-fit lg:sticky lg:top-20">
            <CardHeader><CardTitle>Order summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5 text-sm">
                <Row label="Subtotal" value={money(subtotal, cart!.currency)} />
                {discount > 0 && <Row label={`Discount (${coupon?.code})`} value={`− ${money(discount, cart!.currency)}`} />}
                <Row label="Shipping & tax" value="At payment" muted />
              </div>

              <div className="flex gap-2">
                <Input placeholder="Coupon code" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} className="h-9" />
                <Button variant="outline" size="sm" onClick={applyCoupon} disabled={validateCoupon.isPending}>Apply</Button>
              </div>

              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Estimated total</span>
                <span>{money(subtotal - discount, cart!.currency)}</span>
              </div>

              <Button className="w-full" size="lg" disabled={!selected || phase === 'paying'} onClick={pay}>
                {phase === 'paying' ? 'Starting payment…' : 'Pay now'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Test UPI <strong>success@upi</strong> · card 4111 1111 1111 1111
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={muted ? 'text-muted-foreground' : ''}>{value}</span>
    </div>
  );
}
