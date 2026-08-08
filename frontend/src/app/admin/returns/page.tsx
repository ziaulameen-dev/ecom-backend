'use client';

import { toast } from 'sonner';
import { AuthImage } from '@/components/auth-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAdminReturns, useReturnAction } from '@/features/admin/api';

const badge: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'outline'> = {
  requested: 'secondary', approved: 'default', received: 'default', refunded: 'success', rejected: 'destructive',
};

export default function AdminReturnsPage() {
  const { data: returns, isLoading } = useAdminReturns();
  const act = useReturnAction();

  const run = (id: string, action: 'approve' | 'reject' | 'receive' | 'refund') =>
    act.mutateAsync({ id, action }).then(() => toast.success(`Return ${action}d`)).catch((e) => toast.error((e as Error).message));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Returns (RMA)</h1>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          {returns?.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-mono">order #{r.orderId.slice(0, 8)}</span>
                  <Badge variant={badge[r.status] ?? 'secondary'}>{r.status}</Badge>
                  <span className="text-muted-foreground">{r.reason || '—'}</span>
                  {r.refundMinor > 0 && <span className="text-xs text-muted-foreground">refunded ₹{(r.refundMinor / 100).toFixed(0)}</span>}
                  <div className="ml-auto flex gap-1.5">
                    {r.status === 'requested' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => run(r.id, 'approve')}>Approve</Button>
                        <Button size="sm" variant="ghost" onClick={() => run(r.id, 'reject')}>Reject</Button>
                      </>
                    )}
                    {r.status === 'approved' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => run(r.id, 'receive')}>Mark received</Button>
                        <Button size="sm" variant="ghost" onClick={() => run(r.id, 'reject')}>Reject</Button>
                      </>
                    )}
                    {r.status === 'received' && (
                      <>
                        <Button size="sm" onClick={() => run(r.id, 'refund')}>Refund + restock</Button>
                        <Button size="sm" variant="ghost" onClick={() => run(r.id, 'reject')}>Reject (damaged)</Button>
                      </>
                    )}
                  </div>
                </div>
                {r.images?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {r.images.map((key) => (
                      <AuthImage
                        key={key}
                        path={`/api/returns/${r.id}/images/${key.split('/').pop()}`}
                        className="size-20 rounded-lg border object-cover"
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {returns?.length === 0 && <p className="text-sm text-muted-foreground">No returns.</p>}
        </div>
      )}
    </div>
  );
}
