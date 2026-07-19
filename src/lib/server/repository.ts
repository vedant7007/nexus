// The interface is the real contract — services depend on `IncidentRepository`,
// never on Firestore — so route and service tests run against an in-memory
// double with no emulator, network, or credentials. The double lives beside the
// real implementation on purpose: a shared conformance suite proves they behave
// the same, so a method added here must be satisfied by both.
import type { IncidentStatus, IncidentType, Severity } from '../engine/types';

/** A logged incident. */
export interface Incident {
  id: string;
  type: IncidentType;
  severity: Severity;
  /** Zone the incident was reported in. */
  zoneId: string;
  /** The report exactly as submitted, in the reporter's own language. */
  rawText: string;
  /** English translation. Equals rawText when no translation was possible. */
  englishText: string;
  /** Detected language, or 'unknown' in rule mode. */
  language: string;
  /** Response protocol steps. */
  protocol: string[];
  status: IncidentStatus;
  /** Responding team, decided by rule. */
  team: string;
  /** Nearest first-aid point id, decided by rule. */
  nearestFirstAidZoneId: string;
  /** The severity rule that fired, kept for audit. */
  matchedRule: string;
  /** Whether triage ran with AI or fell back to rules. */
  mode: 'ai' | 'rule';
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** Firebase uid of the reporter. */
  createdBy: string;
}

/** Fields supplied when creating an incident. The server sets the rest. */
export type NewIncident = Omit<Incident, 'id'>;

/** Persistence contract for incidents. */
export interface IncidentRepository {
  /** Returns the stored incident, with its assigned id. */
  create(incident: NewIncident): Promise<Incident>;

  /** Lists incidents, most severe first, then most recent. */
  list(limit: number): Promise<Incident[]>;

  /** Returns the incident, or null when it does not exist. */
  findById(id: string): Promise<Incident | null>;

  /** Returns the updated incident, or null when it does not exist. */
  updateStatus(id: string, status: IncidentStatus): Promise<Incident | null>;
}

/** Severity ordering for listing, most severe first. */
const SEVERITY_RANK: Record<Severity, number> = { SEV1: 0, SEV2: 1, SEV3: 2 };

/**
 * Orders incidents the way a control room reads them: worst first, newest first
 * within a severity. Shared by both implementations so ordering cannot drift.
 */
export function compareIncidents(a: Incident, b: Incident): number {
  return (
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.createdAt.localeCompare(a.createdAt)
  );
}

/**
 * In-memory repository. The test double half of the contract.
 *
 * Not a production fallback and never wired into one: it is constructed
 * explicitly by tests. A silent in-memory fallback in production would turn a
 * misconfigured database into invisible data loss.
 */
export class InMemoryIncidentRepository implements IncidentRepository {
  private readonly items = new Map<string, Incident>();
  private sequence = 0;

  async create(incident: NewIncident): Promise<Incident> {
    this.sequence += 1;
    const stored: Incident = { ...incident, id: `inc-${this.sequence}` };
    this.items.set(stored.id, stored);
    return stored;
  }

  async list(limit: number): Promise<Incident[]> {
    return [...this.items.values()].sort(compareIncidents).slice(0, limit);
  }

  async findById(id: string): Promise<Incident | null> {
    return this.items.get(id) ?? null;
  }

  async updateStatus(id: string, status: IncidentStatus): Promise<Incident | null> {
    const existing = this.items.get(id);
    if (existing === undefined) return null;

    const updated: Incident = { ...existing, status };
    this.items.set(id, updated);
    return updated;
  }

  /** Empties the store. Test-only. */
  clear(): void {
    this.items.clear();
    this.sequence = 0;
  }
}
