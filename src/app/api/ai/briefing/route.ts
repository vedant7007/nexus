import { z } from 'zod';

import { withRoute } from '@/lib/server/handler';
import {
  briefingFor,
  resolveScenario,
  resolveTick,
  situationFor,
  sustainabilityFor,
} from '@/lib/server/situationService';
import { isScenarioId } from '@/lib/sim/scenarios';

const bodySchema = z.object({
  scenario: z.string().refine(isScenarioId, 'Unknown scenario.'),
  tick: z.number().int().min(0).max(200),
  kind: z.enum(['situation', 'sustainability']).default('situation'),
});

interface BriefingResponse {
  text: string;
  mode: 'ai' | 'rule';
  generatedAt: string;
}

/**
 * AI briefing. Rate-limited because it spends money; always answers because
 * both paths fall back to a deterministic template.
 *
 * POST rather than GET despite being read-only: the scenario and tick are the
 * request's meaning, and a body keeps them out of URLs, logs, and caches.
 */
export const POST = withRoute<z.infer<typeof bodySchema>, BriefingResponse>(
  'POST /api/ai/briefing',
  { schema: bodySchema, rateLimit: true },
  async ({ body }) => {
    const scenario = resolveScenario(body.scenario);
    const tick = resolveTick(String(body.tick), null);
    const report = situationFor(scenario, tick);

    const result =
      body.kind === 'sustainability'
        ? await sustainabilityFor(report, scenario)
        : await briefingFor(report, scenario);

    return { ...result, generatedAt: report.generatedAt };
  },
);

export const dynamic = 'force-dynamic';
