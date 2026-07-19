// The ordering in every function here is the same and is the point: simulate,
// assess deterministically, then hand the finished facts to the AI. The AI is
// always last and always optional.
import {
  type Recommendation,
  generateBriefing,
  generateReasoning,
  generateSustainabilityInsight,
} from '../ai/briefing';
import type { AiMode } from '../ai/briefing';
import { cachedAi } from '../ai/cache';
import { mitigationsFor } from '../engine/flow';
import { buildSituationReport } from '../engine/situation';
import type { SituationReport } from '../engine/types';
import { type ScenarioId, isScenarioId } from '../sim/scenarios';
import { simulate, tickForElapsed } from '../sim/simulator';

/** Most risks we will spend an AI call on per request. */
const MAX_AI_RECOMMENDATIONS = 3;

/** Default scenario when none is requested. */
export const DEFAULT_SCENARIO: ScenarioId = 'normal';

/** Narrows an untrusted scenario query parameter, defaulting when absent or unknown. */
export function resolveScenario(value: string | null): ScenarioId {
  return value !== null && isScenarioId(value) ? value : DEFAULT_SCENARIO;
}

/**
 * Resolves the tick to render.
 *
 * The client passes its session start time so the feed advances smoothly; an
 * explicit tick overrides it, which is what makes the demo and the E2E suite
 * able to jump straight to an interesting moment.
 */
export function resolveTick(
  tickParam: string | null,
  startedAtParam: string | null,
  now: number = Date.now(),
): number {
  if (tickParam !== null) {
    const parsed = Number.parseInt(tickParam, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (startedAtParam !== null) {
    const startedAt = Number.parseInt(startedAtParam, 10);
    if (Number.isFinite(startedAt)) return tickForElapsed(startedAt, now);
  }
  return 0;
}

/** Produces the deterministic situation report for a scenario and tick. Contains no AI output. */
export function situationFor(
  scenario: ScenarioId,
  tick: number,
  generatedAt: string = new Date().toISOString(),
): SituationReport {
  return buildSituationReport(simulate(scenario, tick), generatedAt);
}

/** Recommendations plus the mode that produced their reasoning. */
export interface RecommendationsResult {
  items: Recommendation[];
  mode: AiMode;
}

/**
 * Builds ranked recommendations for the top risks.
 *
 * The action and the impact come from the engine and are identical in both
 * modes. Only the reasoning prose differs, so a rate-limited or failed AI call
 * costs fluency and nothing else. Reports 'rule' if any reasoning fell back, so
 * the UI badge never overclaims.
 */
export async function recommendationsFor(
  report: SituationReport,
  scenario: ScenarioId,
): Promise<RecommendationsResult> {
  return cachedAi(
    `recs:${scenario}:${report.overall}`,
    () => buildRecommendations(report),
    (result) => result.mode === 'ai',
  );
}

/** Builds recommendations without the cache, so {@link recommendationsFor} can wrap it. */
async function buildRecommendations(report: SituationReport): Promise<RecommendationsResult> {
  const targets = report.risks.slice(0, MAX_AI_RECOMMENDATIONS);

  const built = await Promise.all(
    targets.map(async (risk) => {
      const mitigations = mitigationsFor(risk, report.snapshot);
      const chosen = mitigations[0];
      if (chosen === undefined) return null;

      const { reasoning, mode } = await generateReasoning(risk, chosen, mitigations.slice(1));
      const item: Recommendation = {
        riskId: risk.id,
        subjectName: risk.subjectName,
        level: risk.level,
        action: chosen.action,
        impact: chosen.impact,
        reasoning,
      };
      return { item, mode };
    }),
  );

  const present = built.filter(
    (entry): entry is { item: Recommendation; mode: AiMode } => entry !== null,
  );

  return {
    items: present.map((entry) => entry.item),
    // Honest badge: 'ai' only when every reasoning actually came from the model.
    mode: present.length > 0 && present.every((entry) => entry.mode === 'ai') ? 'ai' : 'rule',
  };
}

/** Produces the AI situational briefing for a report, cached by scenario+level. */
export async function briefingFor(
  report: SituationReport,
  scenario: ScenarioId,
): ReturnType<typeof generateBriefing> {
  return cachedAi(
    `brief:${scenario}:${report.overall}`,
    () => generateBriefing(report),
    (result) => result.mode === 'ai',
  );
}

/** Produces the AI sustainability insight, cached by scenario+level. */
export async function sustainabilityFor(
  report: SituationReport,
  scenario: ScenarioId,
): ReturnType<typeof generateSustainabilityInsight> {
  return cachedAi(
    `sustain:${scenario}:${report.overall}`,
    () => generateSustainabilityInsight(report.snapshot),
    (result) => result.mode === 'ai',
  );
}
