'use client';

// Exposes a token provider rather than the token itself: Firebase ID tokens
// expire hourly, so a cached string eventually goes stale. `getIdToken()`
// refreshes transparently, so callers ask for a token when they need it.
import {
  GoogleAuthProvider,
  type User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { isFirebaseConfigured } from '@/lib/config';
import type { TokenProvider } from '@/lib/ui/apiClient';
import { getAuthClient } from '@/lib/ui/firebaseClient';

export interface AuthState {
  user: User | null;
  /** True until the initial auth check resolves. */
  loading: boolean;
  /** True when Firebase is configured; false means local dev mode. */
  configured: boolean;
  /** Supplies a fresh ID token, or null when signed out. */
  getToken: TokenProvider;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Token used when Firebase is not configured.
 *
 * Pairs with the server's development-only bypass in `server/auth`, which a
 * test pins to non-production. It lets the whole command center run locally
 * with no cloud project at all.
 */
const DEV_TOKEN = 'local-development';

/** Provides authentication state to the tree. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    const auth = getAuthClient();
    if (auth === null) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  const getToken = useCallback<TokenProvider>(async () => {
    if (!configured) return DEV_TOKEN;
    const auth = getAuthClient();
    const current = auth?.currentUser;
    return current === null || current === undefined ? null : current.getIdToken();
  }, [configured]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const auth = getAuthClient();
    if (auth === null) throw new Error('Authentication is not configured.');
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const auth = getAuthClient();
    if (auth === null) throw new Error('Authentication is not configured.');
    await createUserWithEmailAndPassword(auth, email, password);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const auth = getAuthClient();
    if (auth === null) throw new Error('Authentication is not configured.');
    await signInWithPopup(auth, new GoogleAuthProvider());
  }, []);

  const signOut = useCallback(async () => {
    const auth = getAuthClient();
    if (auth !== null) await firebaseSignOut(auth);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      configured,
      getToken,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
    }),
    [
      user,
      loading,
      configured,
      getToken,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Reads authentication state.
 *
 * @throws {Error} When called outside an {@link AuthProvider}.
 */
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context === null) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
