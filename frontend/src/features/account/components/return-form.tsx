'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRequestReturn } from '@/features/account/api';
import type { Order } from '@/lib/types';

/** Inline "request return" form for a whole order: reason + up to 5 photos. */
export function ReturnForm({ order, onDone }: { order: Order; onDone: () => void }) {
  const request = useRequestReturn();
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    try {
      await request.mutateAsync({ orderId: order.id, reason, items: order.items, files });
      toast.success('Return requested');
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-4">
      <p className="text-sm font-medium">Request a return (whole order)</p>
      <Input placeholder="Reason (e.g. defective, wrong item)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="text-sm"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Up to 5 photos (JPG/PNG/WEBP), 5&nbsp;MB each. {files.length > 0 && `${files.length} selected.`}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={request.isPending} onClick={submit}>
          {request.isPending ? 'Submitting…' : 'Submit return'}
        </Button>
        <Button size="sm" variant="ghost" disabled={request.isPending} onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}
