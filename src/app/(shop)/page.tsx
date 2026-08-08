'use client';

import { Headphones, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategoryTree, useProducts } from '@/features/catalog/api';
import { ProductCard } from '@/features/catalog/components/product-card';

const TRUST = [
  { icon: Truck, title: 'Free shipping', sub: 'On orders over ₹4,999' },
  { icon: ShieldCheck, title: 'Secure payments', sub: 'Cashfree protected' },
  { icon: RotateCcw, title: 'Easy returns', sub: '7-day hassle-free' },
  { icon: Headphones, title: '24/7 support', sub: 'We’re here to help' },
];

export default function HomePage() {
  const { data: tree } = useCategoryTree();
  const { data: products, isLoading } = useProducts({ limit: 8 });

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-8">
        <div className="grid overflow-hidden rounded-2xl bg-primary text-primary-foreground md:grid-cols-2">
          <div className="flex flex-col justify-center gap-5 p-8 md:p-14">
            <span className="w-fit rounded-full bg-brand/15 px-3 py-1 text-xs font-medium text-brand">
              New season · 2025
            </span>
            <h1 className="text-4xl font-bold leading-tight md:text-5xl">
              Discover products you’ll love
            </h1>
            <p className="max-w-md text-primary-foreground/70">
              Curated watches, perfumes and accessories — crafted for modern living.
            </p>
            <div className="flex gap-3">
              <Link href="/shop">
                <Button variant="brand" size="lg">Shop now</Button>
              </Link>
              <Link href="/shop?category=watches">
                <Button variant="outline" size="lg" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                  Explore collection
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative min-h-64 bg-muted/20">
            <Image
              src="https://placehold.co/800x600?text=Featured"
              alt="Featured"
              fill
              className="object-cover"
              sizes="(min-width:768px) 50vw, 100vw"
              priority
            />
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="mx-auto mt-10 grid max-w-7xl grid-cols-2 gap-4 px-4 md:grid-cols-4">
        {TRUST.map((t) => (
          <div key={t.title} className="flex items-center gap-3 rounded-xl border p-4">
            <t.icon className="size-6 text-brand" />
            <div>
              <div className="text-sm font-semibold">{t.title}</div>
              <div className="text-xs text-muted-foreground">{t.sub}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Shop by category */}
      {!!tree?.length && (
        <section className="mx-auto mt-16 max-w-7xl px-4">
          <h2 className="mb-6 text-xl font-semibold">Shop by category</h2>
          <div className="flex flex-wrap gap-8">
            {tree.map((c) => (
              <Link
                key={c.id}
                href={`/shop?category=${c.slug}`}
                className="group flex flex-col items-center gap-2"
              >
                <div className="relative size-20 overflow-hidden rounded-full border bg-muted">
                  <Image
                    src={c.imageUrl ?? `https://placehold.co/200x200?text=${encodeURIComponent(c.name)}`}
                    alt={c.name}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    sizes="80px"
                  />
                </div>
                <span className="text-sm font-medium">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* New arrivals */}
      <section className="mx-auto mt-16 max-w-7xl px-4">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">New arrivals</h2>
          <Link href="/shop" className="text-sm text-muted-foreground hover:text-foreground">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl" />
              ))
            : products?.map((item) => <ProductCard key={item.key} item={item} />)}
        </div>
      </section>

      {/* Promo */}
      <section className="mx-auto mt-16 max-w-7xl px-4">
        <div className="flex flex-col items-start gap-4 rounded-2xl bg-brand p-10 text-brand-foreground md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-2xl font-bold">Festive sale — up to 40% off</div>
            <p className="text-brand-foreground/80">Limited time only. Don’t miss out.</p>
          </div>
          <Link href="/shop">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
              Grab the deals
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
