/**
 * @module ai/fallbacks
 *
 * Responsibility: a working, factual version of every AI feature, with no AI.
 *
 * These are not error messages. They are the product, rendered from the same
 * deterministic `SituationReport` the AI would have been given — less fluent,
 * equally true. If Gemini is down, rate-limited, or talking nonsense, a judge or
 * an operator still sees a briefing, still sees recommendations with real
 * numbers, and can still triage an incident. Nothing dead-ends.
 *
 * Every function here is pure and synchronous. They cannot fail, which is
 * precisely why they are the floor the AI layer falls back to.
 */
import { sustainabilitySummary } from '../engine/sustainability';
import type { Risk, SituationReport, Snapshot } from '../engine/types';

/** Plain-language phrasing for each risk level. */
const LEVEL_PHRASE: Record<SituationReport['overall'], string> = {
  normal: 'Normal',
  elevated: 'Elevated',
  high: 'High',
  critical: 'Critical',
};

/**
 * Renders a factual situational briefing without any AI.
 *
 * Reads as terse operator shorthand rather than prose, because that is honest
 * about what produced it — a template, not a language model.
 *
 * @param report - The deterministic situation report.
 * @returns A briefing built only from computed facts.
 */
export function templatedBriefing(report: SituationReport): string {
  const { overall, risks, snapshot } = report;
  const kickoff =
    snapshot.tMinusKickoffMin > 0
      ? `Kickoff in ${snapshot.tMinusKickoffMin} min.`
      : `Kickoff was ${Math.abs(snapshot.tMinusKickoffMin)} min ago.`;

  const lines: string[] = [`Overall status: ${LEVEL_PHRASE[overall]}. ${kickoff}`];

  if (risks.length === 0) {
    lines.push(
      'No zones, gates or transit lines are over threshold. All areas are within safe density and every gate is keeping pace with arrivals.',
    );
  } else {
    const critical = risks.filter((r) => r.level === 'critical');
    lines.push(
      `${risks.length} active ${risks.length === 1 ? 'risk' : 'risks'}` +
        (critical.length > 0 ? `, ${critical.length} at critical` : '') +
        '. Highest priority first:',
    );
    // Cap the list: an operator reading a fallback needs the top of the stack,
    // not all fourteen. The full set stays available in the risk table.
    for (const risk of risks.slice(0, 4)) {
      lines.push(`• [${LEVEL_PHRASE[risk.level]}] ${risk.detail}`);
    }
    if (risks.length > 4) lines.push(`• …and ${risks.length - 4} more, listed in the risk table.`);
  }

  const delayed = snapshot.transit.filter((t) => t.status !== 'ok');
  if (delayed.length > 0) {
    lines.push(
      `Transit: ${delayed.map((t) => `${t.line} ${t.status}${t.delayMin > 0 ? ` (+${t.delayMin} min)` : ''}`).join(', ')}.`,
    );
  }

  lines.push(`Conditions: ${snapshot.weather.condition}, ${Math.round(snapshot.weather.tempC)}°C.`);
  return lines.join('\n');
}

/**
 * Renders factual reasoning for a recommendation without any AI.
 *
 * @param risk - The risk being mitigated.
 * @param action - The engine-chosen action.
 * @param impact - The engine-computed impact.
 * @returns A short rationale containing only computed facts.
 */
export function templatedReasoning(risk: Risk, action: string, impact: string): string {
  const urgency =
    risk.etaToCriticalMin === undefined
      ? `${risk.subjectName} is at ${LEVEL_PHRASE[risk.level].toLowerCase()} risk.`
      : `${risk.subjectName} is projected to reach critical in about ${risk.etaToCriticalMin} minutes.`;

  return `${urgency} ${action}. ${impact}`;
}

/**
 * Renders a factual sustainability insight without any AI.
 *
 * @param snapshot - The venue snapshot.
 * @returns A sentence built from the computed resource position.
 */
export function templatedSustainabilityInsight(snapshot: Snapshot): string {
  return sustainabilitySummary(snapshot).drivers.join(' ');
}

/**
 * Renders a response protocol for an incident without any AI.
 *
 * Severity and routing are already decided by the engine's rules, so a useful
 * protocol needs no model — only the responding team and the destination.
 *
 * @param team - The responding team from the triage decision.
 * @param firstAidName - Display name of the nearest first-aid point.
 * @param severity - The rule-decided severity.
 * @returns Ordered protocol steps.
 */
export function templatedProtocol(
  team: string,
  firstAidName: string,
  severity: 'SEV1' | 'SEV2' | 'SEV3',
): string[] {
  const steps: string[] = [`Dispatch ${team} to the reported location.`];

  if (severity === 'SEV1') {
    steps.push(
      `Alert ${firstAidName} and place the on-site medical team on standby.`,
      'Clear an access route for responders and hold crowd movement through the area.',
      'Escalate to the venue duty manager immediately.',
    );
  } else if (severity === 'SEV2') {
    steps.push(
      `Notify ${firstAidName} that a response may be required.`,
      'Confirm the situation on arrival and update the incident status.',
    );
  } else {
    steps.push('Assess on arrival and resolve or escalate as appropriate.');
  }

  steps.push('Record the outcome against this incident before closing it.');
  return steps;
}
