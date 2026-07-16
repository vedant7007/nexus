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
import { FirestoreIncidentRepository } from './firestoreRepository';
import type { IncidentRepository } from './repository';

let override: IncidentRepository | null = null;
let cached: IncidentRepository | null = null;

/**
 * Returns the incident repository.
 *
 * @returns The test override when set, otherwise the Firestore repository.
 */
export function getRepository(): IncidentRepository {
  if (override !== null) return override;
  cached ??= new FirestoreIncidentRepository();
  return cached;
}

/**
 * Substitutes the repository. Test-only seam.
 *
 * @param repo - The repository to use, or null to restore the real one.
 */
export function setRepositoryForTests(repo: IncidentRepository | null): void {
  override = repo;
}
