'use client';

import { useMemo, useState } from 'react';
import type { Variant } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TypeGroup {
  typeId: string;
  type: string;
  display: 'text' | 'swatch';
  values: { value: string; swatch: string | null }[];
}

/** Selection state: typeId -> chosen value. */
export type Selection = Record<string, string>;

/** Find the variant that matches the full selection (all types satisfied). */
export function matchVariant(variants: Variant[], sel: Selection): Variant | undefined {
  return variants.find((v) =>
    v.options.every((o) => sel[o.typeId] === o.value),
  );
}

function buildGroups(variants: Variant[]): TypeGroup[] {
  const map = new Map<string, TypeGroup>();
  for (const v of variants) {
    for (const o of v.options) {
      const g = map.get(o.typeId) ?? {
        typeId: o.typeId,
        type: o.type,
        display: o.swatch ? 'swatch' : 'text',
        values: [],
      };
      if (!g.values.some((x) => x.value === o.value)) {
        g.values.push({ value: o.value, swatch: o.swatch });
      }
      map.set(o.typeId, g);
    }
  }
  return [...map.values()];
}

export function useVariantSelection(variants: Variant[]) {
  const groups = useMemo(() => buildGroups(variants), [variants]);
  const initial = useMemo<Selection>(() => {
    const def = variants.find((v) => v.isDefault) ?? variants[0];
    const sel: Selection = {};
    def?.options.forEach((o) => (sel[o.typeId] = o.value));
    return sel;
  }, [variants]);

  const [selection, setSelection] = useState<Selection>(initial);
  const active = useMemo(() => matchVariant(variants, selection), [variants, selection]);
  return { groups, selection, setSelection, active };
}

export function VariantPicker({
  groups,
  selection,
  onChange,
}: {
  groups: TypeGroup[];
  selection: Selection;
  onChange: (sel: Selection) => void;
}) {
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.typeId}>
          <div className="mb-2 text-sm font-medium">
            {g.type}: <span className="text-muted-foreground">{selection[g.typeId]}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {g.values.map((val) => {
              const selected = selection[g.typeId] === val.value;
              if (g.display === 'swatch' && val.swatch) {
                return (
                  <button
                    key={val.value}
                    type="button"
                    aria-label={val.value}
                    onClick={() => onChange({ ...selection, [g.typeId]: val.value })}
                    className={cn(
                      'size-8 rounded-full border-2 transition',
                      selected ? 'border-primary ring-2 ring-ring ring-offset-2 ring-offset-background' : 'border-border',
                    )}
                    style={{ backgroundColor: val.swatch }}
                  />
                );
              }
              return (
                <button
                  key={val.value}
                  type="button"
                  onClick={() => onChange({ ...selection, [g.typeId]: val.value })}
                  className={cn(
                    'min-w-12 rounded-md border px-3 py-2 text-sm transition',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input hover:bg-accent',
                  )}
                >
                  {val.value}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
