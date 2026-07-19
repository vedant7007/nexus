// An explicit module-level seam rather than a DI container: routes are the only
// consumers and there is one dependency. See getRepository for why there is no
// automatic in-memory fallback.
import { serverConfig } from '../config';

import { FirestoreIncidentRepository } from './firestoreRepository';
import { type IncidentRepository, InMemoryIncidentRepository } from './repository';

let override: IncidentRepository | null = null;
let cached: IncidentRepository | null = null;

/**
 * Returns the incident repository.
 *
 * There is deliberately no *silent* fallback: a misconfigured production
 * database must fail loudly, not quietly write incidents to a Map that vanishes.
 * The one exception is the explicit `AUTH_BYPASS` build — the self-contained
 * E2E/demo mode that runs with no Firebase project at all — where an in-memory
 * repository is the correct choice rather than a hack, because it is selected by
 * the same named, opt-in flag and never by accident. A real deployment sets
 * neither the flag nor reaches this branch.
 */
export function getRepository(): IncidentRepository {
  if (override !== null) return override;
  cached ??= serverConfig().AUTH_BYPASS
    ? new InMemoryIncidentRepository()
    : new FirestoreIncidentRepository();
  return cached;
}

/** Clears the memoised repository. Test-only seam. */
export function resetRepositoryCache(): void {
  cached = null;
}

/** Substitutes the repository, or null to restore the real one. Test-only seam. */
export function setRepositoryForTests(repo: IncidentRepository | null): void {
  override = repo;
}
