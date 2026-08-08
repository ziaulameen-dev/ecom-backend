'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  useAddVariant, useAdminAttributes, useAdminCategories, useAdminProducts,
  useCreateProduct, useDeleteProduct, useDeleteVariant, useUpdateProduct,
} from '@/features/admin/api';
import type { AdminProduct, AttributeType } from '@/lib/types';
import { money } from '@/lib/utils';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function AdminProductsPage() {
  const { data: products, isLoading } = useAdminProducts();
  const { data: categories } = useAdminCategories();
  const create = useCreateProduct();
  const [open, setOpen] = useState<string | null>(null);
  const [f, setF] = useState({ name: '', priceMinor: 0, stock: 0, categoryId: '', imageUrl: '', description: '' });

  async function submit() {
    try {
      await create.mutateAsync({
        name: f.name, slug: slugify(f.name), priceMinor: Number(f.priceMinor), stock: Number(f.stock),
        categoryId: f.categoryId || undefined, imageUrl: f.imageUrl || undefined, description: f.description || undefined,
      });
      setF({ name: '', priceMinor: 0, stock: 0, categoryId: '', imageUrl: '', description: '' });
      toast.success('Product created');
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Products</h1>

      <Card>
        <CardHeader><CardTitle>Add product</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-2"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Price (paise)</Label><Input type="number" value={f.priceMinor} onChange={(e) => setF({ ...f, priceMinor: Number(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Stock</Label><Input type="number" value={f.stock} onChange={(e) => setF({ ...f, stock: Number(e.target.value) })} /></div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Category</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
              <option value="">— None —</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.parentId ? '— ' : ''}{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-4"><Label>Image URL</Label><Input value={f.imageUrl} onChange={(e) => setF({ ...f, imageUrl: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-6"><Label>Description</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <Button className="sm:col-span-2" disabled={f.name.length < 2 || create.isPending} onClick={submit}>Create</Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-2">
          {products?.map((p) => (
            <ProductRow key={p.id} product={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductRow({ product, open, onToggle }: { product: AdminProduct; open: boolean; onToggle: () => void }) {
  const del = useDeleteProduct();
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center gap-3 p-4 text-sm">
          <button onClick={onToggle} className="text-muted-foreground">{open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</button>
          <span className="font-medium">{product.name}</span>
          {!product.active && <Badge variant="destructive">inactive</Badge>}
          <span className="text-muted-foreground">{money(product.priceMinor)}</span>
          <span className="text-xs text-muted-foreground">{product.variants.length} variant(s)</span>
          <div className="ml-auto flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => { if (confirm('Delete product?')) del.mutate(product.id); }}>Delete</Button>
          </div>
        </div>
        {open && (
          <div className="border-t p-4">
            <VariantsManager product={product} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VariantsManager({ product }: { product: AdminProduct }) {
  const { data: attributes } = useAdminAttributes();
  const addVariant = useAddVariant();
  const delVariant = useDeleteVariant();
  const update = useUpdateProduct();

  const lookup = useMemo(() => {
    const m = new Map<string, { type: string; value: string; swatch: string | null }>();
    (attributes ?? []).forEach((t: AttributeType) => t.values.forEach((v) => m.set(v.id, { type: t.name, value: v.value, swatch: v.swatch })));
    return m;
  }, [attributes]);

  const [sel, setSel] = useState<Record<string, string>>({});
  const [nv, setNv] = useState({ priceMinor: product.priceMinor, stock: 0, images: '', listedSeparately: false, isDefault: false });

  async function add() {
    const valueIds = Object.values(sel).filter(Boolean);
    if (!valueIds.length) return toast.error('Pick at least one attribute value');
    try {
      await addVariant.mutateAsync({
        productId: product.id,
        body: {
          valueIds, priceMinor: Number(nv.priceMinor), stock: Number(nv.stock),
          images: nv.images ? nv.images.split(',').map((s) => s.trim()).filter(Boolean) : [],
          listedSeparately: nv.listedSeparately, isDefault: nv.isDefault,
        },
      });
      setSel({}); setNv({ priceMinor: product.priceMinor, stock: 0, images: '', listedSeparately: false, isDefault: false });
      toast.success('Variant added');
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={product.active} onChange={(e) => update.mutate({ id: product.id, body: { active: e.target.checked } })} />
        Active (visible in store)
      </label>

      <div>
        <div className="mb-2 text-sm font-medium">Variants</div>
        <div className="space-y-2">
          {product.variants.map((v) => (
            <div key={v.id} className="flex items-center gap-3 rounded-lg border p-2 text-sm">
              <span className="flex flex-wrap gap-1">
                {v.valueIds.map((id) => {
                  const o = lookup.get(id);
                  return <span key={id} className="rounded bg-muted px-1.5 py-0.5 text-xs">{o ? `${o.type}: ${o.value}` : id.slice(0, 6)}</span>;
                })}
              </span>
              <span className="text-muted-foreground">{money(v.priceMinor)}</span>
              <span className="text-xs text-muted-foreground">stock {v.stock}</span>
              {v.isDefault && <Badge variant="secondary">default</Badge>}
              {v.listedSeparately && <Badge>listed</Badge>}
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => delVariant.mutate(v.id)}>Remove</Button>
            </div>
          ))}
          {product.variants.length === 0 && <p className="text-xs text-muted-foreground">No variants — this product sells at its base price/stock.</p>}
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="text-sm font-medium">Add a variant</div>
        <div className="flex flex-wrap gap-3">
          {attributes?.map((t) => (
            <div key={t.id} className="space-y-1">
              <Label className="text-xs">{t.name}</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={sel[t.id] ?? ''}
                onChange={(e) => setSel((s) => ({ ...s, [t.id]: e.target.value }))}
              >
                <option value="">—</option>
                {t.values.map((v) => <option key={v.id} value={v.id}>{v.value}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><Label className="text-xs">Price (paise)</Label><Input type="number" className="h-9 w-32" value={nv.priceMinor} onChange={(e) => setNv({ ...nv, priceMinor: Number(e.target.value) })} /></div>
          <div className="space-y-1"><Label className="text-xs">Stock</Label><Input type="number" className="h-9 w-24" value={nv.stock} onChange={(e) => setNv({ ...nv, stock: Number(e.target.value) })} /></div>
          <div className="space-y-1"><Label className="text-xs">Image URLs (comma-sep)</Label><Input className="h-9 w-64" value={nv.images} onChange={(e) => setNv({ ...nv, images: e.target.value })} /></div>
          <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={nv.listedSeparately} onChange={(e) => setNv({ ...nv, listedSeparately: e.target.checked })} /> List on PLP</label>
          <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={nv.isDefault} onChange={(e) => setNv({ ...nv, isDefault: e.target.checked })} /> Default</label>
          <Button size="sm" onClick={add} disabled={addVariant.isPending}>Add variant</Button>
        </div>
      </div>
    </div>
  );
}
