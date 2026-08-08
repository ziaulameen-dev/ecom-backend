'use client';

import { LogOut } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AuthImage } from '@/components/auth-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useLogout, useMe } from '@/features/auth/api';
import {
  useAddresses,
  useCancelOrder,
  useCreateAddress,
  useDeleteAddress,
  useMyOrders,
  useMyReturns,
  useUpdateProfile,
  type AddressInput,
} from '@/features/account/api';
import { AddressForm } from '@/features/account/components/address-form';
import { ReturnForm } from '@/features/account/components/return-form';
import type { AdminReturn, OrderStatus } from '@/lib/types';
import { cn, formatDate, money } from '@/lib/utils';

const TABS = [
  { key: 'profile', label: 'Profile' },
  { key: 'orders', label: 'Orders' },
  { key: 'addresses', label: 'Addresses' },
] as const;

const statusVariant: Record<OrderStatus, 'default' | 'secondary' | 'success' | 'destructive' | 'outline'> = {
  pending: 'secondary', processing: 'secondary', paid: 'success', fulfilled: 'default',
  shipped: 'default', delivered: 'success', cancelled: 'destructive', failed: 'destructive', refunded: 'outline',
};

function AccountInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const tab = (sp.get('tab') ?? 'profile') as (typeof TABS)[number]['key'];
  const { data: me, isLoading } = useMe();

  useEffect(() => {
    if (!isLoading && !me) router.replace('/login?next=/account');
  }, [me, isLoading, router]);

  if (!me) return <div className="mx-auto max-w-5xl px-4 py-24 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">My account</h1>
      <div className="mt-6 flex flex-col gap-8 md:flex-row">
        <nav className="flex gap-1 md:w-48 md:flex-col">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => router.push(`/account?tab=${t.key}`)}
              className={cn(
                'rounded-md px-3 py-2 text-left text-sm hover:bg-accent',
                tab === t.key && 'bg-accent font-medium',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1">
          {tab === 'profile' && <ProfileTab email={me.email} name={me.name} />}
          {tab === 'orders' && <OrdersTab />}
          {tab === 'addresses' && <AddressesTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ email, name }: { email: string; name: string | null }) {
  const update = useUpdateProfile();
  const logout = useLogout();
  const router = useRouter();
  const [form, setForm] = useState({ name: name ?? '', mobile: '' });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({ name: form.name || undefined, mobile: form.mobile || undefined });
      toast.success('Profile updated');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={save} className="max-w-md space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile">Mobile</Label>
            <Input id="mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          </div>
          <Button type="submit" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save changes'}</Button>
        </form>
        <Separator className="my-6" />
        <Button
          variant="outline"
          onClick={async () => { await logout.mutateAsync(); router.push('/'); }}
        >
          <LogOut /> Log out
        </Button>
      </CardContent>
    </Card>
  );
}

const RETURNABLE = ['shipped', 'delivered', 'fulfilled'];
const returnBadge: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'outline'> = {
  requested: 'secondary', approved: 'default', received: 'default', refunded: 'success', rejected: 'destructive',
};

function OrdersTab() {
  const { data: orders, isLoading } = useMyOrders();
  const { data: returns } = useMyReturns();
  const cancel = useCancelOrder();
  const [returningId, setReturningId] = useState<string | null>(null);

  if (isLoading) return <p className="text-muted-foreground">Loading orders…</p>;
  if (!orders?.length) return <p className="text-muted-foreground">No orders yet.</p>;

  const returnFor = (orderId: string): AdminReturn | undefined =>
    returns?.find((r) => r.orderId === orderId);

  return (
    <div className="space-y-4">
      {orders.map((o) => {
        const ret = returnFor(o.id);
        return (
          <Card key={o.id}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{o.reference ?? `#${o.id.slice(0, 8)}`}</span>
                <Badge variant={statusVariant[o.status] ?? 'secondary'}>{o.status}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{formatDate(o.createdAt)}</div>
              <div className="mt-3 space-y-1 text-sm">
                {o.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-muted-foreground">
                    <span>{it.name}{it.variantLabel ? ` · ${it.variantLabel}` : ''} × {it.quantity}</span>
                    <span>{money(it.unitAmountMinor * it.quantity, o.currency)}</span>
                  </div>
                ))}
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{money(o.totalMinor, o.currency)}</span>
                <div className="flex items-center gap-2">
                  {['pending', 'paid'].includes(o.status) && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={cancel.isPending}
                      onClick={() => {
                        const reason = window.prompt('Reason for cancelling? (optional)');
                        if (reason === null) return;
                        cancel.mutate(
                          { id: o.id, reason: reason || undefined },
                          { onSuccess: () => toast.success('Order cancelled'), onError: (e) => toast.error((e as Error).message) },
                        );
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                  {RETURNABLE.includes(o.status) && !ret && returningId !== o.id && (
                    <Button variant="outline" size="sm" onClick={() => setReturningId(o.id)}>Request return</Button>
                  )}
                </div>
              </div>

              {ret && (
                <div className="mt-3 rounded-lg border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Return:</span>
                    <Badge variant={returnBadge[ret.status] ?? 'secondary'}>{ret.status}</Badge>
                    {ret.refundMinor > 0 && <span className="text-xs text-muted-foreground">refunded {money(ret.refundMinor, o.currency)}</span>}
                  </div>
                  {ret.images?.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      {ret.images.map((key) => (
                        <AuthImage key={key} path={`/api/returns/${ret.id}/images/${key.split('/').pop()}`} className="size-14 rounded-md border object-cover" />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {returningId === o.id && (
                <ReturnForm order={o} onDone={() => setReturningId(null)} />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AddressesTab() {
  const { data: addresses, isLoading } = useAddresses();
  const create = useCreateAddress();
  const del = useDeleteAddress();
  const [adding, setAdding] = useState(false);

  async function save(values: AddressInput) {
    try {
      await create.mutateAsync(values);
      setAdding(false);
      toast.success('Address added');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Addresses</CardTitle>
        {!adding && <Button size="sm" variant="outline" onClick={() => setAdding(true)}>+ Add</Button>}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {addresses?.map((a) => (
          <div key={a.id} className="flex items-start justify-between rounded-lg border p-3 text-sm">
            <div>
              <div className="font-medium">{a.fullName} {a.isDefault && <span className="text-xs text-muted-foreground">(default)</span>}</div>
              <div className="text-muted-foreground">{a.line1}, {a.city} {a.postalCode}</div>
              {a.phone && <div className="text-muted-foreground">{a.phone}</div>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => del.mutate(a.id)}>Remove</Button>
          </div>
        ))}
        {adding && (
          <div className="rounded-lg border p-4">
            <AddressForm onSubmit={save} submitting={create.isPending} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountInner />
    </Suspense>
  );
}
