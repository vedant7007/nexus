// A working, factual version of every AI feature, with no AI. These are not error
// messages — they are the product, rendered from the same deterministic
// SituationReport the AI would have been given: less fluent, equally true, so a
// down or rate-limited Gemini never dead-ends a briefing, a recommendation, or a
// triage. Every function is pure and synchronous, which is why they are the floor
// the AI layer falls back to.
import { sustainabilitySummary } from '../engine/sustainability';
import { isHeatStress } from '../engine/thresholds';
import type { Risk, SituationReport, Snapshot } from '../engine/types';

const LEVEL_PHRASE: Record<SituationReport['overall'], string> = {
  normal: 'normal',
  elevated: 'elevated',
  high: 'high',
  critical: 'critical',
};

// tMinusMin is negative after kickoff.
function kickoffClause(tMinusMin: number): string {
  if (tMinusMin > 1) return `with ${tMinusMin} minutes to kickoff`;
  if (tMinusMin === 1) return 'with a minute to kickoff';
  if (tMinusMin === 0) return 'at kickoff';
  const since = Math.abs(tMinusMin);
  return `${since} ${since === 1 ? 'minute' : 'minutes'} into the match`;
}

function remainderSentence(others: readonly Risk[]): string {
  if (others.length === 0) return '';

  // Count criticals among *these* risks only. Counting across the whole report
  // produced "7 further areas are over threshold, 8 of them at critical".
  const criticalCount = others.filter((r) => r.level === 'critical').length;
  const subject =
    others.length === 1 ? 'One further area is' : `${others.length} further areas are`;
  const criticalNote =
    criticalCount === 0
      ? ''
      : criticalCount === others.length
        ? ', all of them at critical,'
        : `, ${criticalCount} of them at critical,`;

  return `${subject} over threshold${criticalNote} and listed in the risk table.`;
}

function weatherSentence(snapshot: Snapshot): string {
  const { condition, tempC, humidityPct } = snapshot.weather;
  const temp = Math.round(tempC);

  if (isHeatStress(tempC, humidityPct)) {
    // Also sidesteps "Conditions are extreme heat at 36°C", which is what
    // splicing a noun phrase into an adjective slot gets you.
    return `It is ${temp}°C with ${Math.round(humidityPct)}% humidity, which is enough to raise every crowd risk by one band.`;
  }
  return `Conditions are ${condition.toLowerCase()} at ${temp}°C.`;
}

function transitSentence(snapshot: Snapshot): string {
  const degraded = snapshot.transit.filter((t) => t.status !== 'ok');
  if (degraded.length === 0) return '';

  const parts = degraded.map((line) =>
    line.status === 'down'
      ? `${line.line} is out of service`
      : `${line.line} is running ${line.delayMin} minutes late`,
  );
  const joined =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

  return `On transit, ${joined}, which will push a later, tighter arrival surge toward the gates it feeds.`;
}

/**
 * Renders a situational briefing without any AI.
 *
 * Written as prose a duty manager would actually speak, not as a template dump:
 * if Gemini is down this *is* the briefing, so reading like a printf would
 * undercut the claim that the rule-based path is a first-class product. Every
 * number is still computed, none of it generated.
 */
export function templatedBriefing(report: SituationReport): string {
  const { overall, risks, snapshot } = report;
  const sentences: string[] = [];

  const lead = risks[0];
  if (lead === undefined) {
    sentences.push(
      `Overall status is normal ${kickoffClause(snapshot.tMinusKickoffMin)}.`,
      'No zone, gate or transit line is over threshold: every area is within safe density and the gates are keeping pace with arrivals.',
    );
  } else {
    sentences.push(
      `Overall status is ${LEVEL_PHRASE[overall]} ${kickoffClause(snapshot.tMinusKickoffMin)}.`,
      // The detail already opens with the subject's name, so naming it again
      // here ("The immediate concern is Gate C. Gate C is taking…") reads like
      // a mail merge.
      `Most pressing right now: ${lead.detail}`,
    );

    const remainder = remainderSentence(risks.slice(1));
    if (remainder !== '') sentences.push(remainder);
  }

  const transit = transitSentence(snapshot);
  if (transit !== '') sentences.push(transit);

  sentences.push(weatherSentence(snapshot));
  return sentences.join(' ');
}

/**
 * Renders reasoning for a recommendation without any AI.
 *
 * Deliberately does *not* restate the impact figures: the recommendation card
 * renders `impact` beside this text, so repeating them would show the same
 * numbers twice. This adds the one thing the numbers cannot say — why this
 * option won over the others the engine scored.
 */
export function templatedReasoning(risk: Risk, action: string, alternativeCount = 0): string {
  const urgency =
    risk.etaToCriticalMin === undefined
      ? `${risk.subjectName} is at ${LEVEL_PHRASE[risk.level]} risk and needs intervention now.`
      : `${risk.subjectName} is on track to reach critical in about ${risk.etaToCriticalMin} minutes, so the window to act is short.`;

  const comparison =
    alternativeCount > 0
      ? ` It scored highest of the ${alternativeCount + 1} options modelled for this risk.`
      : '';

  return `${urgency} The recommended move is to ${lowerFirst(action)}.${comparison} The projected figures come from the current arrival and throughput rates, not an estimate.`;
}

// Lowercases the first character, for splicing a sentence into a clause.
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Renders a factual sustainability insight without any AI. */
export function templatedSustainabilityInsight(snapshot: Snapshot): string {
  return sustainabilitySummary(snapshot).drivers.join(' ');
}

/**
 * Renders a response protocol for an incident without any AI.
 *
 * Severity and routing are already decided by the engine's rules, so a useful
 * protocol needs no model — only the responding team and the destination.
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
