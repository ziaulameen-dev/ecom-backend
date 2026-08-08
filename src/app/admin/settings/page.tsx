'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSetShippingRate, useShippingRate } from '@/features/admin/api';
import { money } from '@/lib/utils';

export default function AdminSettingsPage() {
  const { data } = useShippingRate();
  const setRate = useSetShippingRate();
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    if (data) setAmount(data.amountMinor);
  }, [data]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card className="max-w-md">
        <CardHeader><CardTitle>Delivery charge</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Flat delivery charge (paise)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            <p className="text-xs text-muted-foreground">Currently {money(amount)} — applied to every order at checkout.</p>
          </div>
          <Button
            onClick={() => setRate.mutate(Number(amount), { onSuccess: () => toast.success('Saved'), onError: (e) => toast.error((e as Error).message) })}
            disabled={setRate.isPending}
          >
            Save
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
