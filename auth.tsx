import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useAccount } from '@/features/auth/auth-context';
import { normalizeSouthAfricanPhoneNumber } from '@/features/auth/phone-number';
import { pageHead } from '@/features/customer/metadata';
import '@lovable.dev/cloud-auth-js/styles.css';

export const Route = createFileRoute('/auth')({
  head: () => pageHead('Sign in', 'Sign in to your private Service-Requesta pilot account.'),
  component: AuthPage,
});

type BusyAction = 'email' | 'social' | 'phone' | null;

function AuthPage() {
  const { user } = useAccount();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [sentPhone, setSentPhone] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [resendInSeconds, setResendInSeconds] = useState(0);

  useEffect(() => {
    if (user) navigate({ to: '/requests', replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (resendInSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendInSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendInSeconds]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const credentials = z
        .object({
          email: z.string().trim().email().max(255),
          password: z.string().min(1).max(128),
        })
        .parse({ email: form.get('email'), password: form.get('password') });
      setBusy('email');
      const { error: authError } = await supabase.auth.signInWithPassword(credentials);
      if (authError) throw authError;
    } catch (caught) {
      setError(caught instanceof z.ZodError ? 'Enter a valid email and password.' : 'Sign-in failed. Check your email and password.');
    } finally {
      setBusy(null);
    }
  }

  async function social(provider: 'google' | 'lovable' | 'azure' | 'apple') {
    setError('');
    setBusy('social');
    try {
      const redirectTo = `${window.location.origin}/auth`;
      if (provider === 'google' || provider === 'lovable') {
        const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: redirectTo });
        if (result.error) throw result.error;
      } else {
        const { error: authError } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
            ...(provider === 'azure' ? { scopes: 'email' } : {}),
          },
        });
        if (authError) throw authError;
      }
    } catch {
      setError('That sign-in option is unavailable right now. Please try again or use another method.');
    } finally {
      setBusy(null);
    }
  }

  async function sendPhoneCode(event?: FormEvent<HTMLFormElement>, resend = false) {
    event?.preventDefault();
    setError('');
    setPhoneError('');
    const normalizedPhone = resend && sentPhone ? sentPhone : normalizeSouthAfricanPhoneNumber(phone);
    if (!normalizedPhone) {
      setPhoneError('Enter a South African number, such as 082 123 4567 or +27 82 123 4567.');
      return;
    }

    setBusy('phone');
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({ phone: normalizedPhone });
      if (authError) throw authError;
      setSentPhone(normalizedPhone);
      setPhone(normalizedPhone);
      setOtp('');
      setResendInSeconds(60);
      setPhoneError('');
    } catch {
      setPhoneError('We could not send a code. Check the number and try again in a moment.');
    } finally {
      setBusy(null);
    }
  }

  async function verifyPhoneCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPhoneError('');
    const token = otp.replace(/\s/g, '');
    if (!sentPhone || !/^\d{6}$/.test(token)) {
      setPhoneError('Enter the six-digit code sent to your phone.');
      return;
    }

    setBusy('phone');
    try {
      const { error: authError } = await supabase.auth.verifyOtp({
        phone: sentPhone,
        token,
        type: 'sms',
      });
      if (authError) throw authError;
      navigate({ to: '/requests', replace: true });
    } catch {
      setPhoneError('That code could not be verified. Check it and try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="page-wrap py-12">
      <div className="mx-auto max-w-md">
        <p className="eyebrow">SERVICE-REQUESTA · PRIVATE PILOT</p>
        <h1 className="mt-3 text-3xl font-semibold">Sign in to your pilot account</h1>
        <p className="mt-3 text-muted-foreground">Sign in to save and track demonstration requests.</p>

        <div className="my-6 border-l-4 border-primary bg-accent p-4 text-sm">
          <ShieldCheck className="mb-2 size-5" />
          Before saving requests, you’ll review and accept the{' '}
          <Link to="/privacy" className="underline">pilot privacy notice</Link>. Public bookings and payments are off.
        </div>

        <section aria-label="Sign in with a provider" className="space-y-3">
          <Button
            variant="outline"
            className="google-auth h-11 w-full"
            disabled={busy !== null}
            onClick={() => social('google')}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
              <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
            </svg>
            Continue with Google
          </Button>
          <Button
            className="lovable-auth-button h-11 w-full"
            disabled={busy !== null}
            onClick={() => social('lovable')}
          >
            Continue with Lovable
          </Button>
          <Button variant="outline" className="h-11 w-full" disabled={busy !== null} onClick={() => social('azure')}>
            Continue with Microsoft
          </Button>
          <Button variant="outline" className="h-11 w-full" disabled={busy !== null} onClick={() => social('apple')}>
            Continue with Apple
          </Button>
        </section>

        <div className="my-6 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          OR USE EMAIL OR PHONE
          <span className="h-px flex-1 bg-border" />
        </div>

        {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}

        <form onSubmit={login} className="space-y-4">
          <h2 className="text-base font-medium">Email and password</h2>
          <label className="field-label">
            Email address
            <Input name="email" type="email" required maxLength={255} autoComplete="email" />
          </label>
          <label className="field-label">
            Password
            <Input name="password" type="password" required maxLength={128} autoComplete="current-password" />
          </label>
          <Button disabled={busy !== null} className="h-11 w-full">
            {busy === 'email' ? 'Signing in…' : 'Sign in'}
            <ArrowRight />
          </Button>
        </form>

        <section className="mt-7 border-t border-border pt-6" aria-labelledby="phone-signin-heading">
          <h2 id="phone-signin-heading" className="text-base font-medium">South African phone number</h2>
          <p className="mt-1 text-sm text-muted-foreground">We’ll text you a one-time sign-in code.</p>
          {sentPhone ? (
            <form onSubmit={verifyPhoneCode} className="mt-4 space-y-4">
              <p className="text-sm">Code sent to <span className="font-medium">{sentPhone}</span>.</p>
              <label className="field-label">
                Six-digit code
                <Input
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  aria-describedby={phoneError ? 'phone-signin-error' : undefined}
                />
              </label>
              {phoneError && <p id="phone-signin-error" role="alert" className="text-sm text-destructive">{phoneError}</p>}
              <Button disabled={busy !== null} className="h-11 w-full">
                {busy === 'phone' ? 'Checking code…' : 'Verify code'}
              </Button>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <Button type="button" variant="ghost" className="h-11 px-2" disabled={busy !== null || resendInSeconds > 0} onClick={() => void sendPhoneCode(undefined, true)}>
                  {resendInSeconds > 0 ? `Resend code in ${resendInSeconds}s` : 'Resend code'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 px-2"
                  disabled={busy !== null}
                  onClick={() => { setSentPhone(null); setOtp(''); setPhoneError(''); }}
                >
                  Change number
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={(event) => void sendPhoneCode(event)} className="mt-4 space-y-4">
              <label className="field-label">
                Phone number
                <Input
                  value={phone}
                  onChange={(event) => { setPhone(event.target.value); setPhoneError(''); }}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="082 123 4567"
                  maxLength={24}
                  required
                  aria-describedby={phoneError ? 'phone-signin-error' : 'phone-signin-help'}
                />
              </label>
              <p id="phone-signin-help" className="text-xs text-muted-foreground">Use a local 0… number or an international +27 number.</p>
              {phoneError && <p id="phone-signin-error" role="alert" className="text-sm text-destructive">{phoneError}</p>}
              <Button type="submit" variant="outline" disabled={busy !== null} className="h-11 w-full">
                {busy === 'phone' ? 'Sending code…' : 'Send sign-in code'}
              </Button>
            </form>
          )}
          <p className="mt-3 text-xs text-muted-foreground">SMS sign-in depends on the pilot’s configured messaging provider and may incur mobile network charges.</p>
        </section>

        <p className="mt-6 text-xs text-muted-foreground">
          New pilot participants can continue with Google, Microsoft, Apple, Lovable or phone sign-in. Email invitations and password-reset emails are not enabled in this pre-launch app.
        </p>
      </div>
    </main>
  );
}
