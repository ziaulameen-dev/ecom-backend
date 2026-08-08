'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useAddAttributeValue, useAdminAttributes, useCreateAttributeType,
  useDeleteAttributeType, useDeleteAttributeValue,
} from '@/features/admin/api';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function AdminAttributesPage() {
  const { data: types } = useAdminAttributes();
  const createType = useCreateAttributeType();
  const addValue = useAddAttributeValue();
  const delType = useDeleteAttributeType();
  const delValue = useDeleteAttributeValue();

  const [name, setName] = useState('');
  const [display, setDisplay] = useState<'text' | 'swatch'>('text');
  const [valueDraft, setValueDraft] = useState<Record<string, { value: string; swatch: string }>>({});

  async function newType() {
    try {
      await createType.mutateAsync({ name, slug: slugify(name), display });
      setName('');
      toast.success('Attribute added');
    } catch (e) { toast.error((e as Error).message); }
  }
  async function newValue(typeId: string) {
    const d = valueDraft[typeId];
    if (!d?.value) return;
    try {
      await addValue.mutateAsync({ typeId, body: { value: d.value, swatch: d.swatch || undefined } });
      setValueDraft((s) => ({ ...s, [typeId]: { value: '', swatch: '' } }));
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Variant attributes</h1>

      <Card>
        <CardHeader><CardTitle>Add attribute type</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Name (e.g. Color, Size, Strap)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="w-56" />
          </div>
          <div className="space-y-1.5">
            <Label>Display</Label>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={display} onChange={(e) => setDisplay(e.target.value as 'text' | 'swatch')}>
              <option value="text">Text</option>
              <option value="swatch">Swatch (color)</option>
            </select>
          </div>
          <Button onClick={newType} disabled={name.length < 2 || createType.isPending}>Add</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {types?.map((t) => (
          <Card key={t.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{t.name} <span className="text-xs font-normal text-muted-foreground">({t.display})</span></CardTitle>
              <Button variant="ghost" size="sm" onClick={() => delType.mutate(t.id)}>Delete</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {t.values.map((v) => (
                  <span key={v.id} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs">
                    {v.swatch && <span className="size-3 rounded-full border" style={{ backgroundColor: v.swatch }} />}
                    {v.value}
                    <button onClick={() => delValue.mutate(v.id)} className="text-muted-foreground hover:text-destructive"><X className="size-3" /></button>
                  </span>
                ))}
                {t.values.length === 0 && <span className="text-xs text-muted-foreground">No values yet</span>}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Value"
                  className="h-9"
                  value={valueDraft[t.id]?.value ?? ''}
                  onChange={(e) => setValueDraft((s) => ({ ...s, [t.id]: { ...s[t.id], value: e.target.value } }))}
                />
                {t.display === 'swatch' && (
                  <Input
                    type="color"
                    className="h-9 w-14 p-1"
                    value={valueDraft[t.id]?.swatch ?? '#000000'}
                    onChange={(e) => setValueDraft((s) => ({ ...s, [t.id]: { ...s[t.id], swatch: e.target.value } }))}
                  />
                )}
                <Button size="sm" variant="outline" onClick={() => newValue(t.id)}>Add</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
