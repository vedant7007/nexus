// Understand an incident report in any language, then let the engine decide what it
// means. Understanding it (detect language, translate, categorise, draft a protocol)
// is a language problem across 30+ languages — an LLM is genuinely the right tool.
// Deciding it is a life-safety emergency is a safety problem, so the model is never
// asked: the split is enforced by the type system, not convention. TriageProposal
// has no severity field and no team field — there is no shape in which the model
// *can* express a triage decision. engine/severity.classifySeverity decides severity
// and routing from the raw text and translation, and a life-safety keyword overrides
// the model's proposed type outright. The model cannot talk the engine down, because
// the engine is not listening.
import { z } from 'zod';

import { classifySeverity, escalateForZoneRisk } from '../engine/severity';
import type { IncidentType, TriageDecision } from '../engine/types';

import type { AiMode } from './briefing';
import { cachedAi } from './cache';
import { generateJson } from './client';
import { templatedProtocol } from './fallbacks';

/** Incident types the model may propose. Mirrors {@link IncidentType}. */
const INCIDENT_TYPES = [
  'medical',
  'crowd',
  'security',
  'facilities',
  'lost_person',
  'transport',
] as const satisfies readonly IncidentType[];

/**
 * What the model is permitted to return.
 *
 * Note the absence of `severity`, `team`, and any notion of urgency. This is not
 * an oversight — it is the safety interlock. A field that does not exist cannot
 * be wrong, and cannot be trusted by accident in a later refactor.
 */
export const triageProposalSchema = z.object({
  /** BCP-47-ish language name or code the model detected, e.g. "Spanish". */
  detectedLanguage: z.string().min(1).max(40),
  englishText: z.string().min(1).max(600),
  /** The model's proposed category. The engine may override it. */
  proposedType: z.enum(INCIDENT_TYPES),
  /** Suggested response steps. Advisory only; replaced on fallback. */
  protocolSteps: z.array(z.string().min(1).max(240)).min(1).max(6),
});

/** The model's proposal. Contains no safety decision by construction. */
export type TriageProposal = z.infer<typeof triageProposalSchema>;

/** The complete triage result: model understanding plus engine decision. */
export interface TriageResult {
  detectedLanguage: string;
  englishText: string;
  /** The type the engine acted on. */
  type: IncidentType;
  /** Authoritative, rule-derived. Never model-decided. */
  decision: TriageDecision;
  protocol: string[];
  mode: AiMode;
}

/** Longest incident report accepted. Bounds prompt size and cost. */
export const MAX_REPORT_CHARS = 800;

export function triagePrompt(rawText: string): string {
  return `You are the AI incident copilot for a FIFA World Cup stadium control room. Stadium staff and volunteers report incidents to you in any language.

INCIDENT REPORT (verbatim, may be any language):
"""
${rawText}
"""

TASK:
1. Detect the language of the report.
2. Translate it faithfully into English. Translate exactly what was written — do not soften, dramatise, or add detail that is not there.
3. Categorise it as one of: medical, crowd, security, facilities, lost_person, transport.
4. Draft 2 to 5 concrete response steps for the responding team.

RULES:
- Do NOT assign a severity, priority, or urgency level. That is decided elsewhere by a safety engine, not by you.
- Do NOT decide which team responds.
- Translate faithfully. If the report describes a person who is unconscious, fainted, or not breathing, your translation must say so plainly in English.
- If the report is vague, categorise on what is actually stated and keep the steps general.

Return strict JSON only, in exactly this shape and nothing else:
{
  "detectedLanguage": "<language name in English>",
  "englishText": "<faithful English translation>",
  "proposedType": "<one of: medical|crowd|security|facilities|lost_person|transport>",
  "protocolSteps": ["<step>", "<step>"]
}`;
}

/** Inputs the engine needs that the model must not supply. */
export interface TriageContext {
  /** Id of the nearest first-aid point to the reported zone. */
  nearestFirstAidZoneId: string;
  /** Display name of that first-aid point, for the fallback protocol. */
  firstAidName: string;
  /** Whether the reported zone is currently at critical density. */
  zoneIsCritical: boolean;
}

/**
 * Applies the engine's authoritative rules to a report.
 *
 * Called on both the AI path and the fallback path with the same inputs, so the
 * severity and routing an operator sees are identical either way. That equality
 * is asserted by tests: if Gemini is down, triage does not get less safe, only
 * less fluent. `texts` is every text to scan for keywords: the raw report, and
 * the translation when one exists.
 */
export function decide(
  proposedType: IncidentType,
  texts: readonly string[],
  context: TriageContext,
): TriageDecision {
  const base = classifySeverity(proposedType, texts, context.nearestFirstAidZoneId);
  return escalateForZoneRisk(base, context.zoneIsCritical);
}

/** Triages an incident report: AI for language, engine for safety. Never throws; degrades to rule mode. */
export async function triageIncident(
  rawText: string,
  context: TriageContext,
): Promise<TriageResult> {
  // Cache only the AI *understanding* (language, translation, category), keyed
  // by the text. The safety decision below re-runs fresh every time with the
  // live context, so the severity interlock is never served from cache — a
  // repeated report gets a free translation but its own up-to-date triage.
  const result = await cachedAi(
    `triage:${rawText.trim().toLowerCase()}`,
    () => generateJson(triagePrompt(rawText), triageProposalSchema),
    (r) => r.ok,
  );

  if (!result.ok) {
    // No translation available, so the keyword scan runs on the raw text alone.
    // SEV1_KEYWORDS deliberately includes common non-English life-safety terms
    // for exactly this path: the interlock must hold with the AI switched off.
    const decision = decide('medical', [rawText], context);
    return {
      detectedLanguage: 'unknown',
      englishText: rawText,
      type: 'medical',
      decision,
      protocol: templatedProtocol(decision.team, context.firstAidName, decision.severity),
      mode: 'rule',
    };
  }

  const proposal = result.value;
  // Scan the original AND the translation: a faithful translation gives the
  // keyword table its best chance, but the raw text is the ground truth and a
  // mistranslation must not be able to hide a life-safety term.
  const decision = decide(proposal.proposedType, [rawText, proposal.englishText], context);

  return {
    detectedLanguage: proposal.detectedLanguage,
    englishText: proposal.englishText,
    type: proposal.proposedType,
    decision,
    // The model's steps are advisory and it never saw the severity. When the
    // engine says this is life-safety, the rule-based protocol wins outright.
    protocol:
      decision.severity === 'SEV1'
        ? templatedProtocol(decision.team, context.firstAidName, decision.severity)
        : proposal.protocolSteps,
    mode: 'ai',
  };
}
