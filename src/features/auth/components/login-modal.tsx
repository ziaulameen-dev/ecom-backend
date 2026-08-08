'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequestOtp, useVerifyOtp } from '@/features/auth/api';
import { useAuthModal } from '@/features/auth/auth-modal.store';
import { api } from '@/lib/api-client';
import { cartId } from '@/lib/session';

/** Global passwordless-login modal (mounted once in Providers). */
export function LoginModal() {
  const { open, next, close } = useAuthModal();
  const router = useRouter();
  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');

  function reset() {
    setStep('email'); setEmail(''); setOtp(''); setName('');
  }

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
      await api.post('/api/cart/merge').catch(() => {});
      cartId.clear();
      toast.success('Welcome!');
      const dest = next;
      close();
      reset();
      if (dest) router.push(dest);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { close(); reset(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step === 'email' ? 'Sign in or create account' : 'Enter your code'}</DialogTitle>
        </DialogHeader>

        {step === 'email' ? (
          <form onSubmit={sendCode} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="m-email">Email</Label>
              <Input id="m-email" type="email" required autoFocus placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={requestOtp.isPending}>
              {requestOtp.isPending ? 'Sending…' : 'Send code'}
            </Button>
            <p className="text-center text-xs text-muted-foreground">Passwordless — we’ll email you a 6-digit code.</p>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="m-otp">6-digit code</Label>
              <Input id="m-otp" inputMode="numeric" maxLength={6} required autoFocus placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-name">Name <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={verifyOtp.isPending}>
              {verifyOtp.isPending ? 'Verifying…' : 'Verify & continue'}
            </Button>
            <button type="button" onClick={() => setStep('email')} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
              ← Use a different email
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
