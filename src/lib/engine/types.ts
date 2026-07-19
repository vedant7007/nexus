// These types describe operational facts, never AI output. Anything the LLM
// produces is modelled separately in `lib/ai` and must be validated before it
// is allowed to touch these shapes.

/** Incident severity. SEV1 is life-safety and is never downgradable by AI. */
export type Severity = 'SEV1' | 'SEV2' | 'SEV3';

export type IncidentType =
  | 'medical'
  | 'crowd'
  | 'security'
  | 'facilities'
  | 'lost_person'
  | 'transport';

/** Escalating risk bands, ordered from calm to emergency. */
export type RiskLevel = 'normal' | 'elevated' | 'high' | 'critical';

export type RiskKind = 'crowd' | 'gate' | 'transit';

export type IncidentStatus = 'open' | 'acknowledged' | 'resolved';

export type TransitStatus = 'ok' | 'delayed' | 'down';

export interface ZoneState {
  id: string;
  name: string;
  occupancy: number;
  /** Safe capacity in people (not the fire-code maximum). */
  capacity: number;
  /** Occupancy as a percentage of safe capacity. 0–100+, may exceed 100. */
  densityPct: number;
  /** Net rate of change in people per minute; negative means emptying. */
  netFlowPerMin: number;
}

export interface GateState {
  id: string;
  name: string;
  inflowPerMin: number;
  /** Processing capacity at current staffing. */
  throughputPerMin: number;
  queueLen: number;
  /** Inflow as a percentage of throughput. Above 100 means the queue grows. */
  utilizationPct: number;
  feedsZoneId: string;
}

export interface TransitLine {
  line: string;
  status: TransitStatus;
  /** Delay in minutes; 0 when status is 'ok'. */
  delayMin: number;
  /** Share of arriving spectators using this line, 0–1. */
  arrivalShare: number;
}

export interface Weather {
  tempC: number;
  condition: string;
  /** Relative humidity percentage, 0–100. */
  humidityPct: number;
}

/** Sustainability and resource telemetry for the current tick. */
export interface Resources {
  /** Instantaneous venue draw in kilowatt-hours for this tick. */
  energyKwh: number;
  /** Share of waste diverted from landfill, 0–100. */
  wasteDiversionPct: number;
  /** Potable water consumption in litres for this tick. */
  waterLitres: number;
  /** Share of spectators arriving by public transport, 0–100. */
  publicTransportSharePct: number;
}

/** A complete, self-consistent picture of the venue at one instant. */
export interface Snapshot {
  /** Minutes until kickoff. Negative after kickoff. */
  tMinusKickoffMin: number;
  /** Simulator tick index; monotonically increasing. */
  tick: number;
  zones: ZoneState[];
  gates: GateState[];
  transit: TransitLine[];
  weather: Weather;
  resources: Resources;
}

/** A single detected operational risk. */
export interface Risk {
  /** Stable id derived from kind + subject, so a risk can be tracked over time. */
  id: string;
  kind: RiskKind;
  /** Id of the zone or gate this risk concerns. */
  subjectId: string;
  subjectName: string;
  level: RiskLevel;
  /**
   * Projected minutes until this subject reaches critical at the current rate.
   * Undefined when the trend is flat or improving, or already critical.
   */
  etaToCriticalMin?: number;
  /** Contains only computed numbers, no generated language. */
  detail: string;
  /** Ranking weight; higher is more urgent. Used for deterministic ordering. */
  score: number;
}

/** The deterministic assessment of a snapshot. The source of truth for the UI and the AI. */
export interface SituationReport {
  /** The most severe level across all risks; 'normal' when there are none. */
  overall: RiskLevel;
  risks: Risk[];
  snapshot: Snapshot;
  /** ISO-8601 timestamp. */
  generatedAt: string;
}

/** Result of modelling a reroute between two gates. */
export interface RerouteImpact {
  fromGateId: string;
  toGateId: string;
  /** Share of arrivals moved, 0–1. */
  pctMoved: number;
  fromBeforePct: number;
  fromAfterPct: number;
  toBeforePct: number;
  toAfterPct: number;
  /** Projected minutes to clear the source queue; null if it never clears. */
  clearanceMin: number | null;
}

/** A deterministic mitigation option with its computed effect. */
export interface Mitigation {
  id: string;
  action: string;
  /** Engine-computed effect, phrased with real numbers only. */
  impact: string;
  /** Ranking weight; higher is better. */
  effectiveness: number;
}

/** Rule-based triage outcome. Authoritative — the LLM cannot override this. */
export interface TriageDecision {
  severity: Severity;
  team: string;
  nearestFirstAidZoneId: string;
  /** The rule that fired, for auditability on the methodology page. */
  matchedRule: string;
}

/** Computed sustainability position against the matchday baseline. */
export interface SustainabilitySummary {
  energyKwh: number;
  /** Percent difference from baseline energy; positive means over. */
  energyDeltaPct: number;
  wasteDiversionPct: number;
  waterLitres: number;
  publicTransportSharePct: number;
  /** Plain-language factual drivers, computed not generated. */
  drivers: string[];
  /** True when every tracked metric is within its target band. */
  onTarget: boolean;
}
