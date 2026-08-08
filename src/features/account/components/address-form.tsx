'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AddressInput } from '@/features/account/api';

const schema = z.object({
  fullName: z.string().min(2, 'Enter a name'),
  phone: z.string().min(6, 'Enter a phone').max(15),
  line1: z.string().min(2, 'Enter an address'),
  city: z.string().min(1, 'Enter a city'),
  state: z.string().optional(),
  postalCode: z.string().min(4, 'Enter a pincode'),
});
type Values = z.infer<typeof schema>;

export function AddressForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (values: AddressInput) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v))} className="grid grid-cols-2 gap-3">
      <Field label="Full name" error={errors.fullName?.message} className="col-span-2">
        <Input {...register('fullName')} />
      </Field>
      <Field label="Phone" error={errors.phone?.message}>
        <Input {...register('phone')} />
      </Field>
      <Field label="Pincode" error={errors.postalCode?.message}>
        <Input {...register('postalCode')} />
      </Field>
      <Field label="Address" error={errors.line1?.message} className="col-span-2">
        <Input {...register('line1')} placeholder="House no, street, area" />
      </Field>
      <Field label="City" error={errors.city?.message}>
        <Input {...register('city')} />
      </Field>
      <Field label="State" error={errors.state?.message}>
        <Input {...register('state')} />
      </Field>
      <Button type="submit" className="col-span-2 mt-1" disabled={submitting}>
        {submitting ? 'Saving…' : 'Save address'}
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
