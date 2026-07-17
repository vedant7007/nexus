'use client';

/**
 * @module ui/useAuthToken
 *
 * Responsibility: give the data hooks a token provider without dragging the
 * whole auth context through them.
 *
 * Separate from `hooks.ts` so that module has no React-component dependency,
 * which keeps its import graph acyclic.
 */
import { useAuth } from '@/components/AuthProvider';

import type { TokenProvider } from './apiClient';

/**
 * Returns a function that supplies a fresh Firebase ID token.
 *
 * @returns The token provider; resolves to null when signed out.
 */
export function useAuthToken(): TokenProvider {
  return useAuth().getToken;
}
