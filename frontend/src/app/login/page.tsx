'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { post, tokens } from '@/lib/api';
import { useStore } from '@/lib/store';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const { refreshUser, refreshCart } = useStore();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestOtp() {
    setErr(''); setBusy(true);
    try {
      const r = await post('/auth/otp', { email }, false);
      setIsNew(!!r.isNewUser);
      setStep('otp');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function verify() {
    setErr(''); setBusy(true);
    try {
      const r = await post('/auth/verify-otp', { email, otp, name: name || undefined }, false);
      tokens.set(r.accessToken, r.refreshToken);
      await post('/api/cart/merge').catch(() => {});
      await Promise.all([refreshUser(), refreshCart()]);
      router.push(next);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="max-w-sm mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Passwordless — we email you a 6-digit code (read it in Mailpit at{' '}
            <a className="underline" href="http://localhost:8028" target="_blank">localhost:8028</a>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'email' ? (
            <>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  placeholder="you@example.com"
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && requestOtp()}
                />
              </div>
              <Button className="w-full" disabled={busy || !email} onClick={requestOtp}>
                {busy ? 'Sending…' : 'Send code'}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Code sent to {email}</Label>
                <Input
                  value={otp}
                  placeholder="123456"
                  onChange={(e) => setOtp(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && verify()}
                />
              </div>
              {isNew && (
                <div className="space-y-2">
                  <Label>Your name (optional)</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              )}
              <Button className="w-full" disabled={busy || !otp} onClick={verify}>
                {busy ? 'Verifying…' : 'Verify & sign in'}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep('email')}>
                Back
              </Button>
            </>
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}
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
