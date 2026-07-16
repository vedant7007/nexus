import type { Snapshot } from '@/lib/engine/types';
import { withRoute } from '@/lib/server/handler';
import { resolveScenario, resolveTick } from '@/lib/server/situationService';
import { simulate } from '@/lib/sim/simulator';

/** Live feed: the current simulated venue snapshot. */
export const GET = withRoute<undefined, Snapshot>('GET /api/sim', {}, async ({ request }) => {
  const url = new URL(request.url);
  const scenario = resolveScenario(url.searchParams.get('scenario'));
  const tick = resolveTick(url.searchParams.get('tick'), url.searchParams.get('startedAt'));

  return simulate(scenario, tick);
});

// The snapshot depends on wall-clock time and query params, so it must never be
// cached or statically prerendered.
export const dynamic = 'force-dynamic';
