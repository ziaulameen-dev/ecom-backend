'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RatingStars } from '@/components/rating-stars';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useAdminProducts, useAdminReviews, useCreateReview, useDeleteReview,
} from '@/features/admin/api';

export default function AdminReviewsPage() {
  const { data: products } = useAdminProducts();
  const { data: reviews } = useAdminReviews();
  const create = useCreateReview();
  const del = useDeleteReview();

  const [f, setF] = useState({ productId: '', rating: 5, title: '', body: '', authorName: '' });
  useEffect(() => {
    if (products?.length && !f.productId) setF((s) => ({ ...s, productId: products[0].id }));
  }, [products, f.productId]);

  const nameOf = (id: string) => products?.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  async function submit() {
    try {
      await create.mutateAsync({
        productId: f.productId, rating: Number(f.rating),
        title: f.title || undefined, body: f.body, authorName: f.authorName,
      });
      setF((s) => ({ ...s, title: '', body: '', authorName: '' }));
      toast.success('Review added');
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reviews</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader><CardTitle>All reviews</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {reviews?.map((r) => (
              <div key={r.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{nameOf(r.productId)}</span>
                  <Button variant="ghost" size="sm" onClick={() => del.mutate(r.id)}>Delete</Button>
                </div>
                <RatingStars value={r.rating} className="mt-1" />
                {r.title && <div className="mt-1 font-medium">{r.title}</div>}
                <p className="text-muted-foreground">{r.body}</p>
                <div className="mt-1 text-xs text-muted-foreground">— {r.authorName}</div>
              </div>
            ))}
            {reviews?.length === 0 && <p className="text-sm text-muted-foreground">No reviews.</p>}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader><CardTitle>Add review</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Product</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value })}>
                {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Rating</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.rating} onChange={(e) => setF({ ...f, rating: Number(e.target.value) })}>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label>Author</Label><Input value={f.authorName} onChange={(e) => setF({ ...f, authorName: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Title (optional)</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Review</Label><textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
            <Button onClick={submit} disabled={!f.productId || f.body.length < 2 || f.authorName.length < 2 || create.isPending}>Add review</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
