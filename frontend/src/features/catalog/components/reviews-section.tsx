'use client';

import { RatingStars } from '@/components/rating-stars';
import { Skeleton } from '@/components/ui/skeleton';
import { useReviews } from '@/features/catalog/api';
import { formatDate } from '@/lib/utils';

export function ReviewsSection({ productId }: { productId: string }) {
  const { data, isLoading } = useReviews(productId);

  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  const summary = data ?? { average: 0, count: 0, items: [] };

  const buckets = [5, 4, 3, 2, 1].map((r) => ({
    r,
    n: summary.items.filter((x) => x.rating === r).length,
  }));

  return (
    <section className="mt-16">
      <h2 className="text-xl font-semibold">Ratings &amp; reviews</h2>

      {summary.count === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <div className="mt-6 grid gap-10 md:grid-cols-[220px_1fr]">
          {/* Aggregate */}
          <div className="flex flex-col items-center gap-2 rounded-xl border p-6">
            <div className="text-5xl font-bold">{summary.average.toFixed(1)}</div>
            <RatingStars value={summary.average} />
            <div className="text-sm text-muted-foreground">{summary.count} reviews</div>
            <div className="mt-3 w-full space-y-1">
              {buckets.map((b) => (
                <div key={b.r} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-muted-foreground">{b.r}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-brand"
                      style={{ width: `${summary.count ? (b.n / summary.count) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-5 text-right text-muted-foreground">{b.n}</span>
                </div>
              ))}
            </div>
          </div>

          {/* List */}
          <ul className="space-y-6">
            {summary.items.map((rev) => (
              <li key={rev.id} className="border-b pb-6 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{rev.authorName}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(rev.createdAt)}</span>
                </div>
                <RatingStars value={rev.rating} className="mt-1" />
                {rev.title && <div className="mt-2 font-medium">{rev.title}</div>}
                <p className="mt-1 text-sm text-muted-foreground">{rev.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
