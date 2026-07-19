/**
 * Decides incident severity and routing by rule, never by model.
 *
 * This module is the safety interlock of the whole product. An LLM *proposes* an
 * incident type; this module *decides* the severity and the responding team. The
 * reason is blunt: a language model that mistranslates "desmayada" or hedges on
 * "not breathing" would silently under-triage a life-safety call. A keyword
 * table cannot hedge.
 *
 * Two consequences follow, and both are enforced below and covered by tests:
 *
 *  1. Life-safety keywords escalate to SEV1 *regardless* of the type the model
 *     proposed. A model can never talk the engine down.
 *  2. The engine never trusts the model's severity, because it is never asked
 *     for one — `TriageProposal` has no severity field at all.
 */
import type { IncidentType, Severity, TriageDecision } from './types';

/** Responding teams, keyed for reuse in the methodology page. */
export const TEAMS = {
  medical: 'Medical Response',
  crowdSafety: 'Crowd Safety',
  security: 'Security',
  facilities: 'Facilities',
  guestServices: 'Guest Services',
  transport: 'Transport Liaison',
} as const;

/**
 * Life-safety phrases that force SEV1 in any language we translate into English.
 *
 * Matched against the English translation *and* the original raw text, so an
 * untranslated report still trips the interlock. Kept lowercase; matching is
 * case-insensitive and substring-based, which deliberately over-triggers —
 * over-triaging costs a wasted dispatch, under-triaging costs a life.
 */
export const SEV1_KEYWORDS: readonly string[] = [
  'unconscious',
  'not breathing',
  'no pulse',
  'cardiac',
  'heart attack',
  'seizure',
  'stroke',
  'severe bleeding',
  'bleeding heavily',
  'haemorrhage',
  'hemorrhage',
  'collapsed',
  'crush',
  'crushing',
  'trampl',
  'stampede',
  'fire',
  'smoke',
  'explosion',
  'weapon',
  'gun',
  'knife',
  'anaphyla',
  'choking',
  'drowning',
  'overdose',
  // Common non-English forms, matched pre-translation as a safety net.
  'desmayad', // es: fainted
  'inconsciente', // es
  'sin pulso', // es
  'incendio', // es: fire
  'évanoui', // fr
  'inconscient', // fr
  'bewusstlos', // de
  'ohnmächtig', // de
  'incendie', // fr
  'অজ্ঞান', // bn: unconscious
  'बेहोश', // hi: unconscious
  'आग', // hi: fire
];

/** Phrases indicating a vulnerable person, which floors severity at SEV2. */
export const SEV2_KEYWORDS: readonly string[] = [
  'child',
  'kid',
  'minor',
  'elderly',
  'wheelchair',
  'disabled',
  'pregnant',
  'niño',
  'niña',
  'enfant',
  'kind',
  'শিশু',
  'बच्चा',
];

/** Default severity floor per incident type when no keyword rule fires. */
const TYPE_BASE_SEVERITY: Record<IncidentType, Severity> = {
  medical: 'SEV2',
  crowd: 'SEV2',
  security: 'SEV2',
  lost_person: 'SEV2',
  transport: 'SEV3',
  facilities: 'SEV3',
};

/** Responding team per incident type. */
const TYPE_TEAM: Record<IncidentType, string> = {
  medical: TEAMS.medical,
  crowd: TEAMS.crowdSafety,
  security: TEAMS.security,
  facilities: TEAMS.facilities,
  lost_person: TEAMS.guestServices,
  transport: TEAMS.transport,
};

/** Severity ordering, most severe first. */
const SEVERITY_RANK: Record<Severity, number> = { SEV1: 3, SEV2: 2, SEV3: 1 };

/** Returns the more severe of two severities. */
export function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/** Finds which keywords appear in the text (case-insensitive), in list order. */
export function matchKeywords(text: string, keywords: readonly string[]): string[] {
  const haystack = text.toLowerCase();
  return keywords.filter((keyword) => haystack.includes(keyword));
}

/**
 * Decides severity and routing for an incident. Authoritative and rule-based.
 *
 * The `proposedType` may originate from an LLM, but it only ever selects which
 * *floor* applies — it can never lower the outcome below what the keyword rules
 * demand. A medical report containing "unconscious" returns SEV1 even if the
 * model proposed `facilities`.
 *
 * `texts` should include both the raw report and any translation, so an
 * untranslated report still trips the keyword interlock.
 */
export function classifySeverity(
  proposedType: IncidentType,
  texts: readonly string[],
  nearestFirstAidZoneId: string,
): TriageDecision {
  const combined = texts.join(' \n ');

  const sev1Hits = matchKeywords(combined, SEV1_KEYWORDS);
  const sev2Hits = matchKeywords(combined, SEV2_KEYWORDS);
  const base = TYPE_BASE_SEVERITY[proposedType];

  // Keyword rules can only ever raise severity above the type's floor.
  let severity = base;
  let matchedRule = `type:${proposedType} floor ${base}`;

  if (sev2Hits.length > 0) {
    severity = maxSeverity(severity, 'SEV2');
    matchedRule = `vulnerable-person keyword "${sev2Hits[0]}" → SEV2 floor`;
  }
  if (sev1Hits.length > 0) {
    severity = 'SEV1';
    matchedRule = `life-safety keyword "${sev1Hits[0]}" → SEV1 (overrides proposed type "${proposedType}")`;
  }

  // A life-safety incident always gets medical alongside the type's own team,
  // because the keyword that fired implies a casualty regardless of category.
  const typeTeam = TYPE_TEAM[proposedType];
  const team =
    severity === 'SEV1' && proposedType !== 'medical' ? `${typeTeam} + ${TEAMS.medical}` : typeTeam;

  return { severity, team, nearestFirstAidZoneId, matchedRule };
}

/**
 * Escalates an incident to SEV1 when the zone it occurred in is already critical.
 *
 * A minor report inside a zone under crowd pressure is not minor: it is a
 * potential trigger for a much larger event.
 */
export function escalateForZoneRisk(
  decision: TriageDecision,
  zoneIsCritical: boolean,
): TriageDecision {
  if (!zoneIsCritical || decision.severity === 'SEV1') return decision;
  return {
    ...decision,
    severity: 'SEV1',
    matchedRule: `${decision.matchedRule}; escalated to SEV1 because the zone is at critical density`,
  };
}
