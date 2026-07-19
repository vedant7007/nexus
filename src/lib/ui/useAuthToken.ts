'use client';

// Separate from `hooks.ts` so that module has no React-component dependency,
// which keeps its import graph acyclic.
import { useAuth } from '@/components/AuthProvider';

import type { TokenProvider } from './apiClient';

/** A token provider giving the data hooks a fresh Firebase ID token. */
export function useAuthToken(): TokenProvider {
  return useAuth().getToken;
}
