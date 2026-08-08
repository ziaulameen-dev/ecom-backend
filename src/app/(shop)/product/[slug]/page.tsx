'use client';

import { Minus, Plus, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProduct } from '@/features/catalog/api';
import { ReviewsSection } from '@/features/catalog/components/reviews-section';
import {
  VariantPicker,
  useVariantSelection,
} from '@/features/catalog/components/variant-picker';
import { useAddToCart } from '@/features/cart/api';
import { money } from '@/lib/utils';

export default function ProductPage() {
  const params = useParams<{ slug: string }>();
  const { data: product, isLoading, isError } = useProduct(params.slug);

  if (isLoading) return <ProductSkeleton />;
  if (isError || !product) {
    return <div className="mx-auto max-w-7xl px-4 py-24 text-center text-muted-foreground">Product not found.</div>;
  }
  return <ProductDetailView product={product} />;
}

function ProductDetailView({ product }: { product: NonNullable<ReturnType<typeof useProduct>['data']> }) {
  const add = useAddToCart();
  const { groups, selection, setSelection, active } = useVariantSelection(product.variants);
  const [qty, setQty] = useState(1);

  const priceMinor = product.hasVariants ? active?.priceMinor ?? product.priceFromMinor : product.basePriceMinor;
  const stock = product.hasVariants ? active?.stock ?? 0 : product.baseStock;
  const images = useMemo(() => {
    const imgs = product.hasVariants && active?.images.length ? active.images : [];
    return [...imgs, product.imageUrl].filter(Boolean) as string[];
  }, [product, active]);
  const [mainIdx, setMainIdx] = useState(0);
  useEffect(() => setMainIdx(0), [active?.id]);

  const needsSelection = product.hasVariants && !active;
  const canBuy = stock > 0 && !needsSelection;

  async function onAdd() {
    try {
      await add.mutateAsync({
        productId: product.id,
        variantId: active?.id ?? null,
        quantity: qty,
      });
      toast.success('Added to cart');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-10 md:grid-cols-2">
        {/* Gallery */}
        <div className="flex flex-col gap-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl border bg-muted">
            {images[mainIdx] ? (
              <Image src={images[mainIdx]} alt={product.name} fill className="object-cover" sizes="(min-width:768px) 50vw, 100vw" priority />
            ) : (
              <div className="grid h-full place-items-center text-muted-foreground"><ShoppingBag className="size-10" /></div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-3">
              {images.map((src, i) => (
                <button
                  key={src + i}
                  onClick={() => setMainIdx(i)}
                  className={`relative size-16 overflow-hidden rounded-lg border-2 ${i === mainIdx ? 'border-primary' : 'border-transparent'}`}
                >
                  <Image src={src} alt="" fill className="object-cover" sizes="64px" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <div className="mt-3 text-2xl font-semibold">{money(priceMinor, product.currency)}</div>

          {product.description && (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{product.description}</p>
          )}

          {groups.length > 0 && (
            <div className="mt-6">
              <VariantPicker groups={groups} selection={selection} onChange={setSelection} />
            </div>
          )}

          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center rounded-md border">
              <Button variant="ghost" size="icon" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus /></Button>
              <span className="w-10 text-center tabular-nums">{qty}</span>
              <Button variant="ghost" size="icon" disabled={qty >= stock} onClick={() => setQty((q) => q + 1)}><Plus /></Button>
            </div>
            <span className="text-sm text-muted-foreground">
              {needsSelection ? 'Select options' : stock > 0 ? `${stock} in stock` : 'Out of stock'}
            </span>
          </div>

          <Button className="mt-6 w-full" size="lg" disabled={!canBuy || add.isPending} onClick={onAdd}>
            <ShoppingBag /> {add.isPending ? 'Adding…' : 'Add to cart'}
          </Button>

          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 rounded-lg border p-3"><Truck className="size-4 text-brand" /> Fast delivery</div>
            <div className="flex items-center gap-2 rounded-lg border p-3"><ShieldCheck className="size-4 text-brand" /> Secure checkout</div>
          </div>
        </div>
      </div>

      <ReviewsSection productId={product.id} />
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-8 md:grid-cols-2">
      <Skeleton className="aspect-square w-full rounded-2xl" />
      <div className="space-y-4">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
