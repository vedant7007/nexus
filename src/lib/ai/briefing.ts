// Turn the engine's SituationReport into control-room language, and produce the
// reasoning behind each recommendation. The prompts are built to make invention
// *hard* — the model gets a closed set of facts and is told it may not introduce a
// number not in them — but the architecture does not depend on that holding: an LLM
// will still occasionally round "94.2%" to "almost 95%", and nothing the model says
// here feeds back into a safety decision. The AI is load-bearing for *comprehension*
// and carries none of the weight for *correctness*.
import { z } from 'zod';

import { sustainabilitySummary } from '../engine/sustainability';
import type { Mitigation, Risk, SituationReport, Snapshot } from '../engine/types';

import { generateJson, generateText } from './client';
import { templatedBriefing, templatedReasoning, templatedSustainabilityInsight } from './fallbacks';

/** Whether a response came from the model or the deterministic fallback. */
export type AiMode = 'ai' | 'rule';

/** A briefing plus how it was produced. */
export interface Briefing {
  text: string;
  mode: AiMode;
}

/** Bounds on briefing length; a control room needs a paragraph, not an essay. */
const BRIEFING_MIN_CHARS = 40;
const BRIEFING_MAX_CHARS = 1_200;

/**
 * The facts a model is allowed to speak about, and nothing else.
 *
 * Deliberately a projection of the snapshot rather than the snapshot itself:
 * anything not in here cannot be cited, and the smaller the surface, the less
 * there is to hallucinate around.
 */
export function factSheet(report: SituationReport): string {
  const { snapshot, overall, risks } = report;

  const zones = snapshot.zones
    .map((z) => `  - ${z.name}: ${z.densityPct.toFixed(1)}% of safe capacity`)
    .join('\n');

  const gates = snapshot.gates
    .map(
      (g) =>
        `  - ${g.name}: ${g.utilizationPct.toFixed(1)}% utilization, ${Math.round(g.queueLen)} queueing`,
    )
    .join('\n');

  const transit = snapshot.transit
    .map((t) => `  - ${t.line}: ${t.status}${t.delayMin > 0 ? ` +${t.delayMin} min` : ''}`)
    .join('\n');

  const riskLines =
    risks.length === 0
      ? '  (none)'
      : risks.map((r) => `  - [${r.level.toUpperCase()}] ${r.detail}`).join('\n');

  return [
    `OVERALL STATUS (computed): ${overall}`,
    `TIME TO KICKOFF: ${snapshot.tMinusKickoffMin} minutes`,
    `WEATHER: ${snapshot.weather.condition}, ${snapshot.weather.tempC}°C, ${snapshot.weather.humidityPct}% humidity`,
    `\nDETECTED RISKS (computed by the safety engine):\n${riskLines}`,
    `\nZONES:\n${zones}`,
    `\nGATES:\n${gates}`,
    `\nTRANSIT:\n${transit}`,
  ].join('\n');
}

/** Instruction block shared by every prompt in this module. */
const GROUNDING_RULES = `RULES — these are absolute:
- Use ONLY the facts and numbers given above. Do not invent, estimate, round, or extrapolate any number.
- Do not invent a safety threshold. The engine has already decided what is dangerous.
- Do not contradict the computed overall status or any risk level.
- If a fact is not listed above, do not mention it.
- Never speculate about causes that are not stated.`;

export function briefingPrompt(report: SituationReport): string {
  return `You are the AI situational analyst in the control room of a FIFA World Cup stadium. You are speaking to experienced venue operations staff during a live match day.

${factSheet(report)}

${GROUNDING_RULES}

TASK: Write a briefing of 4 to 6 sentences giving the operations team situational awareness right now.
- Open with the overall picture, then the most urgent risk, then what follows from it.
- Where the facts show a causal chain (a transit delay pushing a surge to specific gates), say so.
- Calm, precise, professional. Control-room tone: no alarm, no filler, no headings, no bullet points.
- Plain prose only. Do not use markdown.

Briefing:`;
}

/** Produces a situational briefing, falling back to a templated one. Never throws. */
export async function generateBriefing(report: SituationReport): Promise<Briefing> {
  const result = await generateText(briefingPrompt(report));

  if (!result.ok || !isPlausibleBriefing(result.value)) {
    return { text: templatedBriefing(report), mode: 'rule' };
  }
  return { text: result.value, mode: 'ai' };
}

/**
 * Sanity-checks model prose before it reaches an operator.
 *
 * Length only. This cannot detect a subtly wrong number and does not try to —
 * the defence against that is architectural (the model never decides anything),
 * not a regex. What it does catch is the degenerate output that would look
 * broken on screen: an empty string, a refusal, or a wall of text.
 */
export function isPlausibleBriefing(text: string): boolean {
  return text.length >= BRIEFING_MIN_CHARS && text.length <= BRIEFING_MAX_CHARS;
}

/** A recommendation: engine-chosen action, engine-computed impact, AI reasoning. */
export interface Recommendation {
  riskId: string;
  subjectName: string;
  level: Risk['level'];
  /** Imperative action, chosen by the engine. */
  action: string;
  /** Quantified effect, computed by the engine. Never model-generated. */
  impact: string;
  /** Natural-language rationale and trade-offs. Model-generated or templated. */
  reasoning: string;
}

const reasoningSchema = z.object({
  reasoning: z.string().min(20).max(600),
});

/**
 * Builds the prompt asking for reasoning behind a chosen mitigation.
 *
 * Note what is *not* asked for: which action to take, or what it will achieve.
 * Both are already decided and quantified. The model is given the answer and
 * asked to explain it — that ordering is what makes the output safe to trust.
 */
export function reasoningPrompt(
  risk: Risk,
  chosen: Mitigation,
  alternatives: readonly Mitigation[],
): string {
  const others =
    alternatives.length === 0
      ? '  (none)'
      : alternatives.map((m) => `  - ${m.action} — ${m.impact}`).join('\n');

  return `You are the AI decision-support analyst in a FIFA World Cup stadium control room.

DETECTED RISK (computed by the safety engine):
  [${risk.level.toUpperCase()}] ${risk.detail}
${risk.etaToCriticalMin === undefined ? '' : `  Projected to reach critical in ${risk.etaToCriticalMin} minutes.`}

RECOMMENDED ACTION (already chosen by the engine):
  ${chosen.action}

COMPUTED IMPACT OF THAT ACTION (already calculated by the engine):
  ${chosen.impact}

ALTERNATIVES THE ENGINE CONSIDERED:
${others}

${GROUNDING_RULES}
- Do NOT choose a different action. The action above is the decision.
- Do NOT invent an impact figure. Quote only the computed impact above.

TASK: Explain to the operations team why this action is the right call, in 2 to 3 sentences.
State the rationale, cite the computed impact, and name the main trade-off or the thing to watch.
Plain prose, no markdown, no headings.

Return strict JSON only, in exactly this shape:
{"reasoning": "<your 2-3 sentences>"}`;
}

/** Produces reasoning for a chosen mitigation, falling back to a template. */
export async function generateReasoning(
  risk: Risk,
  chosen: Mitigation,
  alternatives: readonly Mitigation[],
): Promise<{ reasoning: string; mode: AiMode }> {
  const result = await generateJson(reasoningPrompt(risk, chosen, alternatives), reasoningSchema);

  if (!result.ok) {
    return {
      reasoning: templatedReasoning(risk, chosen.action, alternatives.length),
      mode: 'rule',
    };
  }
  return { reasoning: result.value.reasoning, mode: 'ai' };
}

export function sustainabilityPrompt(snapshot: Snapshot): string {
  const summary = sustainabilitySummary(snapshot);

  return `You are the AI operations analyst for a FIFA World Cup stadium, reporting on resource use.

COMPUTED METRICS:
  - Energy this interval: ${summary.energyKwh} kWh (${summary.energyDeltaPct >= 0 ? '+' : ''}${summary.energyDeltaPct}% vs matchday baseline)
  - Waste diversion: ${summary.wasteDiversionPct}%
  - Water: ${summary.waterLitres} litres
  - Public transport modal share: ${summary.publicTransportSharePct}%

COMPUTED FINDINGS:
${summary.drivers.map((d) => `  - ${d}`).join('\n')}

${GROUNDING_RULES}

TASK: Write 2 to 3 sentences summarising the venue's resource position for the operations team.
Lead with whatever is furthest from target. Plain prose, no markdown.

Insight:`;
}

/** Produces a sustainability insight, falling back to a templated one. */
export async function generateSustainabilityInsight(snapshot: Snapshot): Promise<Briefing> {
  const result = await generateText(sustainabilityPrompt(snapshot));

  if (!result.ok || !isPlausibleBriefing(result.value)) {
    return { text: templatedSustainabilityInsight(snapshot), mode: 'rule' };
  }
  return { text: result.value, mode: 'ai' };
}
