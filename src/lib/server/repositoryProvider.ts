/**
 * @module server/repositoryProvider
 *
 * Responsibility: hand routes the repository, and let tests substitute one.
 *
 * The seam is explicit rather than a framework DI container: routes are the only
 * consumers, there is one dependency, and a module-level override is honest
 * about that. Note the absence of any automatic in-memory fallback — if
 * Firestore is misconfigured, the route fails loudly. Silently writing incidents
 * to a Map that vanishes on the next request is the worst possible outcome for a
 * safety log.
 */
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
 *
 * @returns The test override when set; the in-memory repository in the explicit
 *   bypass build; otherwise the Firestore repository.
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

/**
 * Substitutes the repository. Test-only seam.
 *
 * @param repo - The repository to use, or null to restore the real one.
 */
export function setRepositoryForTests(repo: IncidentRepository | null): void {
  override = repo;
}
