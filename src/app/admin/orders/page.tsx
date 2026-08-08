'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  useAdminCancelOrder, useAdminOrders, useRefundOrder, useSetTracking, useUpdateOrderStatus,
} from '@/features/admin/api';
import type { OrderStatus } from '@/lib/types';
import { cn, money } from '@/lib/utils';

const badge: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'outline'> = {
  pending: 'secondary', processing: 'secondary', paid: 'success', fulfilled: 'default',
  shipped: 'default', delivered: 'success', cancelled: 'destructive', failed: 'destructive', refunded: 'outline',
};

export default function AdminOrdersPage() {
  const { data: orders, isLoading } = useAdminOrders();
  const setStatus = useUpdateOrderStatus();
  const setTracking = useSetTracking();
  const cancel = useAdminCancelOrder();
  const refund = useRefundOrder();
  const [filter, setFilter] = useState('all');

  const run = (p: Promise<unknown>, msg: string) =>
    p.then(() => toast.success(msg)).catch((e) => toast.error((e as Error).message));

  const counts = (orders ?? []).reduce<Record<string, number>>((m, o) => ((m[o.status] = (m[o.status] ?? 0) + 1), m), {});
  const list = filter === 'all' ? orders ?? [] : (orders ?? []).filter((o) => o.status === filter);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Orders</h1>

      <div className="flex flex-wrap gap-1.5">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All {orders?.length ?? 0}</Chip>
        {Object.keys(counts).sort().map((s) => (
          <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>{s} {counts[s]}</Chip>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          {list.map((o) => (
            <Card key={o.id}>
              <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
                <span className="font-mono">{o.reference ?? `#${o.id.slice(0, 8)}`}</span>
                <Badge variant={badge[o.status] ?? 'secondary'}>{o.status}</Badge>
                <span className="text-muted-foreground">{money(o.totalMinor, o.currency)}</span>
                {o.customerEmail && <span className="hidden text-muted-foreground md:inline">{o.customerEmail}</span>}
                {o.refundedMinor > 0 && <span className="text-xs text-muted-foreground">refunded {money(o.refundedMinor, o.currency)}</span>}
                {o.trackingNumber && <span className="text-xs">📦 {o.carrier} {o.trackingNumber}</span>}

                <div className="ml-auto flex flex-wrap gap-1.5">
                  {o.status === 'paid' && (
                    <Button size="sm" variant="outline" onClick={() => run(setStatus.mutateAsync({ id: o.id, status: 'fulfilled' as OrderStatus }), 'Marked fulfilled')}>Fulfil</Button>
                  )}
                  {['paid', 'fulfilled'].includes(o.status) && (
                    <Button size="sm" variant="outline" onClick={() => {
                      const carrier = window.prompt('Carrier?'); if (!carrier) return;
                      const trackingNumber = window.prompt('Tracking number?'); if (!trackingNumber) return;
                      run(setTracking.mutateAsync({ id: o.id, carrier, trackingNumber }).then(() => setStatus.mutateAsync({ id: o.id, status: 'shipped' as OrderStatus })), 'Shipped');
                    }}>Ship</Button>
                  )}
                  {o.status === 'shipped' && (
                    <Button size="sm" variant="outline" onClick={() => run(setStatus.mutateAsync({ id: o.id, status: 'delivered' as OrderStatus }), 'Marked delivered')}>Delivered</Button>
                  )}
                  {['paid', 'fulfilled', 'shipped', 'delivered'].includes(o.status) && (
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm('Full refund this order?')) run(refund.mutateAsync({ id: o.id }), 'Refunded'); }}>Refund</Button>
                  )}
                  {['pending', 'paid'].includes(o.status) && (
                    <Button size="sm" variant="ghost" onClick={() => { const reason = window.prompt('Cancel reason? (optional)'); if (reason === null) return; run(cancel.mutateAsync({ id: o.id, reason: reason || undefined }), 'Cancelled'); }}>Cancel</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {list.length === 0 && <p className="text-sm text-muted-foreground">No orders.</p>}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn('rounded-full border px-3 py-1 text-xs capitalize transition-colors', active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
    >
      {children}
    </button>
  );
}
