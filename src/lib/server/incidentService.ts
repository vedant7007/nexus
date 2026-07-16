/**
 * @module server/incidentService
 *
 * Responsibility: turn a raw incident report into a triaged, persisted incident.
 *
 * The server owns every safety-critical field. The client sends the words that
 * were typed and the zone they were typed about — nothing else. Severity, team,
 * and first-aid routing are derived here, from the engine, and are never read
 * from the request. A client that posts `severity: 'SEV3'` alongside a report of
 * an unconscious person is ignored: the field does not exist in the schema.
 */
import { type TriageContext, triageIncident } from '../ai/triage';
import { DENSITY_BANDS } from '../engine/thresholds';
import type { IncidentStatus, Snapshot } from '../engine/types';
import { FIRST_AID_POINTS, ZONES, nearestFirstAid } from '../sim/venue';

import { invalidRequest, notFound } from './errors';
import { type Incident, type IncidentRepository, type NewIncident } from './repository';

/** Maximum incidents returned by a list call. */
export const INCIDENT_LIST_LIMIT = 100;

/**
 * Resolves the display name of a first-aid point.
 *
 * @param id - First-aid point id.
 * @returns The display name, or the id when unknown.
 */
export function firstAidName(id: string): string {
  return FIRST_AID_POINTS.find((p) => p.id === id)?.name ?? id;
}

/**
 * Builds the engine inputs for triage from live venue state.
 *
 * These are exactly the inputs the model is not permitted to supply: where the
 * incident is, what is near it, and whether that area is already dangerous.
 *
 * @param zoneId - Zone the incident was reported in.
 * @param snapshot - Current venue state.
 * @returns The triage context.
 */
export function contextFor(zoneId: string, snapshot: Snapshot): TriageContext {
  const firstAidId = nearestFirstAid(zoneId);
  const zone = snapshot.zones.find((z) => z.id === zoneId);

  return {
    nearestFirstAidZoneId: firstAidId,
    firstAidName: firstAidName(firstAidId),
    zoneIsCritical: (zone?.densityPct ?? 0) >= DENSITY_BANDS.critical,
  };
}

/**
 * Validates that a zone exists.
 *
 * @param zoneId - The zone id from the request.
 * @throws {AppError} 400 when the zone is not part of this venue.
 */
export function assertKnownZone(zoneId: string): void {
  if (!ZONES.some((z) => z.id === zoneId)) {
    throw invalidRequest('Request validation failed.', { zoneId: ['Unknown zone.'] });
  }
}

/** What a client may submit. Deliberately minimal. */
export interface ReportInput {
  rawText: string;
  zoneId: string;
}

/**
 * Triages and persists an incident report.
 *
 * @param input - The client's report.
 * @param snapshot - Current venue state, for triage context.
 * @param uid - Firebase uid of the reporter.
 * @param repo - Incident repository.
 * @param now - ISO timestamp for the record.
 * @returns The persisted incident.
 * @throws {AppError} 400 when the zone is unknown.
 */
export async function reportIncident(
  input: ReportInput,
  snapshot: Snapshot,
  uid: string,
  repo: IncidentRepository,
  now: string = new Date().toISOString(),
): Promise<Incident> {
  assertKnownZone(input.zoneId);

  const context = contextFor(input.zoneId, snapshot);
  const triage = await triageIncident(input.rawText, context);

  const record: NewIncident = {
    type: triage.type,
    // Every one of these comes from the engine, not the request and not the model.
    severity: triage.decision.severity,
    team: triage.decision.team,
    nearestFirstAidZoneId: triage.decision.nearestFirstAidZoneId,
    matchedRule: triage.decision.matchedRule,
    zoneId: input.zoneId,
    rawText: input.rawText,
    englishText: triage.englishText,
    language: triage.detectedLanguage,
    protocol: triage.protocol,
    status: 'open',
    mode: triage.mode,
    createdAt: now,
    createdBy: uid,
  };

  return repo.create(record);
}

/**
 * Updates an incident's status.
 *
 * @param id - Incident id.
 * @param status - New status.
 * @param repo - Incident repository.
 * @returns The updated incident.
 * @throws {AppError} 404 when the incident does not exist.
 */
export async function setIncidentStatus(
  id: string,
  status: IncidentStatus,
  repo: IncidentRepository,
): Promise<Incident> {
  const updated = await repo.updateStatus(id, status);
  if (updated === null) throw notFound('Incident not found.');
  return updated;
}
