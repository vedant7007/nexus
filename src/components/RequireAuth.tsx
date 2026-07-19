'use client';

// A client-side guard for *navigation only*, not the security boundary — every
// API route independently verifies the ID token server-side, so a user who
// defeats this guard sees an empty shell and a wall of 401s. Treating a client
// redirect as protection is how people ship unauthenticated APIs.
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from './AuthProvider';

/** Renders children only for a signed-in user. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();
  const router = useRouter();

  // With Firebase unconfigured there is no sign-in to perform, and the server
  // grants a development identity. Gating here would lock the app out of its
  // own local dev mode.
  const allowed = !configured || user !== null;

  useEffect(() => {
    if (!loading && !allowed) router.replace('/login');
  }, [loading, allowed, router]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status">
        <p className="text-sm text-[var(--color-ink-dim)]">Checking your session…</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status">
        <p className="text-sm text-[var(--color-ink-dim)]">Redirecting to sign in…</p>
      </div>
    );
  }

  return <>{children}</>;
}
