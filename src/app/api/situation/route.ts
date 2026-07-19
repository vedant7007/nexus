import type { SituationReport } from '@/lib/engine/types';
import { withRoute } from '@/lib/server/handler';
import { resolveScenario, resolveTick, situationFor } from '@/lib/server/situationService';

/**
 * Not rate-limited and never AI-backed: this is the authoritative safety
 * assessment, and it must stay available even when the AI budget is exhausted.
 */
export const GET = withRoute<undefined, SituationReport>(
  'GET /api/situation',
  {},
  async ({ request }) => {
    const url = new URL(request.url);
    const scenario = resolveScenario(url.searchParams.get('scenario'));
    const tick = resolveTick(url.searchParams.get('tick'), url.searchParams.get('startedAt'));

    return situationFor(scenario, tick);
  },
);

export const dynamic = 'force-dynamic';
