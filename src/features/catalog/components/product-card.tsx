'use client';

import { ShoppingBag } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RatingStars } from '@/components/rating-stars';
import { Button } from '@/components/ui/button';
import { useAddToCart } from '@/features/cart/api';
import type { ListingItem } from '@/lib/types';
import { money } from '@/lib/utils';

export function productHref(item: Pick<ListingItem, 'slug' | 'productId'>) {
  return `/product/${item.slug ?? item.productId}`;
}

export function ProductCard({ item }: { item: ListingItem }) {
  const add = useAddToCart();
  const router = useRouter();
  const href = productHref(item);

  async function onAdd() {
    // A listed variant card can be added directly; a plain product card may have
    // variants to choose, so send the shopper to the detail page.
    if (item.variantId) {
      try {
        await add.mutateAsync({ productId: item.productId, variantId: item.variantId });
        toast.success('Added to cart');
      } catch (e) {
        toast.error((e as Error).message);
      }
    } else {
      router.push(href);
    }
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
      <Link href={href} className="relative block aspect-square overflow-hidden bg-muted">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="(min-width:1024px) 25vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <ShoppingBag className="size-8" />
          </div>
        )}
        {!item.inStock && (
          <span className="absolute left-2 top-2 rounded-md bg-foreground/80 px-2 py-0.5 text-xs text-background">
            Sold out
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link href={href} className="line-clamp-2 text-sm font-medium hover:underline">
          {item.name}
        </Link>
        {item.ratingCount > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <RatingStars value={item.ratingAvg} />
            <span className="text-xs text-muted-foreground">({item.ratingCount})</span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="font-semibold">{money(item.priceMinor, item.currency)}</span>
        </div>
        <Button
          className="mt-3"
          size="sm"
          variant="outline"
          disabled={!item.inStock || add.isPending}
          onClick={onAdd}
        >
          <ShoppingBag /> {item.variantId ? 'Add to cart' : 'View'}
        </Button>
      </div>
    </div>
  );
}
