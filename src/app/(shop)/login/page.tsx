'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequestOtp, useVerifyOtp } from '@/features/auth/api';
import { api } from '@/lib/api-client';
import { cartId } from '@/lib/session';

function LoginInner() {
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/account';
  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    try {
      await requestOtp.mutateAsync(email.trim());
      setStep('otp');
      toast.success('Code sent — check your email');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    try {
      await verifyOtp.mutateAsync({ email: email.trim(), otp: otp.trim(), name: name.trim() || undefined });
      // Fold the guest cart into the account, then drop the guest cookie.
      await api.post('/api/cart/merge').catch(() => {});
      cartId.clear();
      toast.success('Welcome!');
      router.push(next);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {step === 'email' ? 'Sign in or create account' : 'Enter your code'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form onSubmit={sendCode} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={requestOtp.isPending}>
                {requestOtp.isPending ? 'Sending…' : 'Send code'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Passwordless — we’ll email you a 6-digit code.
              </p>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="otp">6-digit code</Label>
                <Input id="otp" inputMode="numeric" maxLength={6} required placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Name <span className="text-muted-foreground">(optional, new accounts)</span></Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={verifyOtp.isPending}>
                {verifyOtp.isPending ? 'Verifying…' : 'Verify & continue'}
              </Button>
              <button type="button" onClick={() => setStep('email')} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
                ← Use a different email
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
