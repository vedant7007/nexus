/**
 * @module schemas/api
 *
 * Responsibility: the wire contract, as runtime-checkable schemas.
 *
 * These are the single source of truth for what crosses the network. The client
 * parses responses with them, which is what lets the UI be typed without a
 * single `any` or `as`: the types below are *inferred from* the schemas, so a
 * type and its validator cannot drift apart.
 */
import { z } from 'zod';

/** Risk levels, mirroring `engine/types`. */
export const riskLevelSchema = z.enum(['normal', 'elevated', 'high', 'critical']);

/** Incident severities. */
export const severitySchema = z.enum(['SEV1', 'SEV2', 'SEV3']);

/** Incident types. */
export const incidentTypeSchema = z.enum([
  'medical',
  'crowd',
  'security',
  'facilities',
  'lost_person',
  'transport',
]);

/** Incident lifecycle states. */
export const incidentStatusSchema = z.enum(['open', 'acknowledged', 'resolved']);

/** Whether a response came from the model or the deterministic fallback. */
export const aiModeSchema = z.enum(['ai', 'rule']);

export const zoneStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  occupancy: z.number(),
  capacity: z.number(),
  densityPct: z.number(),
  netFlowPerMin: z.number(),
});

export const gateStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  inflowPerMin: z.number(),
  throughputPerMin: z.number(),
  queueLen: z.number(),
  utilizationPct: z.number(),
  feedsZoneId: z.string(),
});

export const transitLineSchema = z.object({
  line: z.string(),
  status: z.enum(['ok', 'delayed', 'down']),
  delayMin: z.number(),
  arrivalShare: z.number(),
});

export const snapshotSchema = z.object({
  tMinusKickoffMin: z.number(),
  tick: z.number(),
  zones: z.array(zoneStateSchema),
  gates: z.array(gateStateSchema),
  transit: z.array(transitLineSchema),
  weather: z.object({
    tempC: z.number(),
    condition: z.string(),
    humidityPct: z.number(),
  }),
  resources: z.object({
    energyKwh: z.number(),
    wasteDiversionPct: z.number(),
    waterLitres: z.number(),
    publicTransportSharePct: z.number(),
  }),
});

export const riskSchema = z.object({
  id: z.string(),
  kind: z.enum(['crowd', 'gate', 'transit']),
  subjectId: z.string(),
  subjectName: z.string(),
  level: riskLevelSchema,
  etaToCriticalMin: z.number().optional(),
  detail: z.string(),
  score: z.number(),
});

export const situationReportSchema = z.object({
  overall: riskLevelSchema,
  risks: z.array(riskSchema),
  snapshot: snapshotSchema,
  generatedAt: z.string(),
});

export const briefingResponseSchema = z.object({
  text: z.string(),
  mode: aiModeSchema,
  generatedAt: z.string(),
});

export const recommendationSchema = z.object({
  riskId: z.string(),
  subjectName: z.string(),
  level: riskLevelSchema,
  action: z.string(),
  impact: z.string(),
  reasoning: z.string(),
});

export const recommendationsResponseSchema = z.object({
  items: z.array(recommendationSchema),
  mode: aiModeSchema,
});

export const incidentSchema = z.object({
  id: z.string(),
  type: incidentTypeSchema,
  severity: severitySchema,
  zoneId: z.string(),
  rawText: z.string(),
  englishText: z.string(),
  language: z.string(),
  protocol: z.array(z.string()),
  status: incidentStatusSchema,
  team: z.string(),
  nearestFirstAidZoneId: z.string(),
  matchedRule: z.string(),
  mode: aiModeSchema,
  createdAt: z.string(),
  createdBy: z.string(),
});

export const incidentListSchema = z.object({ incidents: z.array(incidentSchema) });

export const triagePreviewSchema = z.object({
  detectedLanguage: z.string(),
  englishText: z.string(),
  type: z.string(),
  severity: severitySchema,
  team: z.string(),
  matchedRule: z.string(),
  protocol: z.array(z.string()),
  mode: aiModeSchema,
});

/** A live venue snapshot. */
export type SnapshotDto = z.infer<typeof snapshotSchema>;
/** The deterministic situation report. */
export type SituationReportDto = z.infer<typeof situationReportSchema>;
/** An AI or templated briefing. */
export type BriefingDto = z.infer<typeof briefingResponseSchema>;
/** A single decision recommendation. */
export type RecommendationDto = z.infer<typeof recommendationSchema>;
/** Ranked recommendations plus their mode. */
export type RecommendationsDto = z.infer<typeof recommendationsResponseSchema>;
/** A logged incident. */
export type IncidentDto = z.infer<typeof incidentSchema>;
/** A triage preview, before the incident is committed. */
export type TriagePreviewDto = z.infer<typeof triagePreviewSchema>;
/** Whether a response came from the model or the fallback. */
export type AiModeDto = z.infer<typeof aiModeSchema>;
