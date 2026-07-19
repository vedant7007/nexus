import { z } from 'zod';

import { MAX_REPORT_CHARS, triageIncident } from '@/lib/ai/triage';
import type { Severity } from '@/lib/engine/types';
import { withRoute } from '@/lib/server/handler';
import { assertKnownZone, contextFor } from '@/lib/server/incidentService';
import { resolveScenario, resolveTick } from '@/lib/server/situationService';
import { simulate } from '@/lib/sim/simulator';

const bodySchema = z.object({
  rawText: z.string().trim().min(3, 'Describe the incident.').max(MAX_REPORT_CHARS),
  zoneId: z.string().trim().min(1, 'Select a zone.'),
  scenario: z.string().optional(),
  tick: z.number().int().min(0).max(200).optional(),
});

/** Preview of how a report would be triaged, without persisting it. */
interface TriagePreview {
  detectedLanguage: string;
  englishText: string;
  type: string;
  severity: Severity;
  team: string;
  matchedRule: string;
  protocol: string[];
  mode: 'ai' | 'rule';
}

/**
 * Lets the incident form show the operator exactly what will be logged — the
 * translation, the rule-decided severity, and which rule fired — before they
 * commit to it.
 */
export const POST = withRoute<z.infer<typeof bodySchema>, TriagePreview>(
  'POST /api/ai/triage',
  { schema: bodySchema, rateLimit: true },
  async ({ body }) => {
    assertKnownZone(body.zoneId);

    const scenario = resolveScenario(body.scenario ?? null);
    const tick = resolveTick(body.tick === undefined ? null : String(body.tick), null);
    const snapshot = simulate(scenario, tick);

    const result = await triageIncident(body.rawText, contextFor(body.zoneId, snapshot));

    return {
      detectedLanguage: result.detectedLanguage,
      englishText: result.englishText,
      type: result.type,
      severity: result.decision.severity,
      team: result.decision.team,
      matchedRule: result.decision.matchedRule,
      protocol: result.protocol,
      mode: result.mode,
    };
  },
);

export const dynamic = 'force-dynamic';
