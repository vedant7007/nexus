'use client';

/**
 * @module components/LoginForm
 *
 * Responsibility: sign an operator in.
 */
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { FormError, TextField } from '@/components/ui/Field';

import { useAuth } from './AuthProvider';

/** Messages for the Firebase error codes a user can actually cause. */
const ERROR_COPY: Record<string, string> = {
  'auth/invalid-credential': 'That email and password do not match an account.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/user-not-found': 'That email and password do not match an account.',
  'auth/wrong-password': 'That email and password do not match an account.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
};

/**
 * Turns an unknown thrown value into a message worth showing.
 *
 * The wrong-password and user-not-found cases map to the *same* message on
 * purpose: distinguishing them tells an attacker which half of the pair was
 * right, turning the form into an account enumerator.
 *
 * @param error - The caught value.
 * @returns A user-facing message.
 */
export function toLoginMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  return ERROR_COPY[code] ?? 'Could not sign in. Please try again.';
}

/** Shown briefly while the page redirects, in place of the full form. */
function RedirectingNotice() {
  return (
    <div className="flex min-h-[20rem] items-center justify-center" role="status">
      <p className="text-sm text-[var(--color-ink-dim)]">Taking you to the command center…</p>
    </div>
  );
}

/**
 * The sign-in form.
 *
 * @returns The form.
 */
export function LoginForm() {
  const { signInWithEmail, signInWithGoogle, user, configured } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Redirect away when there is nothing to sign into: an already-signed-in
  // user, or a build with no Firebase project (local dev / demo has an implicit
  // identity). Computed during render, not just in the effect, so we never
  // paint the full form only to navigate away a frame later — that flash was a
  // large cumulative layout shift.
  const redirecting = user !== null || !configured;

  useEffect(() => {
    if (redirecting) router.replace('/dashboard');
  }, [redirecting, router]);

  if (redirecting) return <RedirectingNotice />;

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.replace('/dashboard');
    } catch (caught) {
      setError(toLoginMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-bold tracking-tight">Sign in to NEXUS</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
        Venue operations access for matchday control.
      </p>

      <form
        className="mt-8 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => signInWithEmail(email, password));
        }}
      >
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          required
        />

        <FormError message={error} />

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-void)] transition-colors hover:bg-[var(--color-accent-strong)] disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        <span className="text-xs text-[var(--color-ink-dim)]">or</span>
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void run(signInWithGoogle)}
        className="w-full rounded-lg border border-[var(--color-border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-surface-overlay)] disabled:opacity-60"
      >
        Continue with Google
      </button>
    </div>
  );
}
