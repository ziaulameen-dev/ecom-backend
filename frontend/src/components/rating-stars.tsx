import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Read-only 5-star display; supports halves via rounding. */
export function RatingStars({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-0.5', className)} aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < Math.round(value);
        return (
          <Star
            key={i}
            className={cn('size-4', filled ? 'fill-brand text-brand' : 'text-muted-foreground/40')}
          />
        );
      })}
    </div>
  );
}
