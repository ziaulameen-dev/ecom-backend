'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminCategories, useCreateCategory, useDeleteCategory } from '@/features/admin/api';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function AdminCategoriesPage() {
  const { data: cats } = useAdminCategories();
  const create = useCreateCategory();
  const del = useDeleteCategory();
  const [form, setForm] = useState({ name: '', slug: '', parentId: '' });

  const tops = (cats ?? []).filter((c) => !c.parentId);
  const nameOf = (id: string | null) => cats?.find((c) => c.id === id)?.name;

  async function submit() {
    try {
      await create.mutateAsync({
        name: form.name,
        slug: form.slug || slugify(form.name),
        parentId: form.parentId || undefined,
      });
      setForm({ name: '', slug: '', parentId: '' });
      toast.success('Category created');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Categories</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader><CardTitle>All categories</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(cats ?? []).map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <span>
                  {c.name} <span className="text-muted-foreground">/{c.slug}</span>
                  {c.parentId && <span className="ml-2 text-xs text-muted-foreground">↳ {nameOf(c.parentId)}</span>}
                </span>
                <Button variant="ghost" size="sm" onClick={() => del.mutate(c.id, { onError: (e) => toast.error((e as Error).message) })}>Delete</Button>
              </div>
            ))}
            {cats?.length === 0 && <p className="text-sm text-muted-foreground">No categories.</p>}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader><CardTitle>Add category</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Slug <span className="text-muted-foreground">(auto if blank)</span></Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder={slugify(form.name)} />
            </div>
            <div className="space-y-1.5">
              <Label>Parent</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                <option value="">— Top level —</option>
                {tops.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <Button onClick={submit} disabled={form.name.length < 2 || create.isPending}>Create</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
