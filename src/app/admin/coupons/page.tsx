'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminCoupons, useCreateCoupon, useDeleteCoupon } from '@/features/admin/api';
import { money } from '@/lib/utils';

export default function AdminCouponsPage() {
  const { data: coupons } = useAdminCoupons();
  const create = useCreateCoupon();
  const del = useDeleteCoupon();
  const [f, setF] = useState({ code: '', type: 'percent' as 'percent' | 'fixed', value: 10, minSubtotalMinor: 0, maxRedemptions: '' });

  async function submit() {
    try {
      await create.mutateAsync({
        code: f.code.trim(),
        type: f.type,
        value: Number(f.value),
        minSubtotalMinor: Number(f.minSubtotalMinor) || 0,
        maxRedemptions: f.maxRedemptions ? Number(f.maxRedemptions) : undefined,
      });
      setF({ code: '', type: 'percent', value: 10, minSubtotalMinor: 0, maxRedemptions: '' });
      toast.success('Coupon created');
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Coupons</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader><CardTitle>Active coupons</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {coupons?.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div>
                  <span className="font-mono font-semibold">{c.code}</span>{' '}
                  <Badge variant="secondary">{c.type === 'percent' ? `${c.value}%` : money(c.value)}</Badge>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {c.minSubtotalMinor > 0 && `min ${money(c.minSubtotalMinor)} · `}
                    used {c.timesRedeemed}{c.maxRedemptions ? `/${c.maxRedemptions}` : ''}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => del.mutate(c.id)}>Delete</Button>
              </div>
            ))}
            {coupons?.length === 0 && <p className="text-sm text-muted-foreground">No coupons.</p>}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader><CardTitle>Create coupon</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5"><Label>Code</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="WELCOME10" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as 'percent' | 'fixed' })}>
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed (paise)</option>
                </select>
              </div>
              <div className="space-y-1.5"><Label>{f.type === 'percent' ? 'Percent' : 'Amount (paise)'}</Label><Input type="number" value={f.value} onChange={(e) => setF({ ...f, value: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Min subtotal (paise)</Label><Input type="number" value={f.minSubtotalMinor} onChange={(e) => setF({ ...f, minSubtotalMinor: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label>Max uses</Label><Input type="number" value={f.maxRedemptions} onChange={(e) => setF({ ...f, maxRedemptions: e.target.value })} placeholder="∞" /></div>
            </div>
            <Button onClick={submit} disabled={f.code.length < 3 || create.isPending}>Create</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
