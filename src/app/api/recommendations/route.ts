import { withRoute } from '@/lib/server/handler';
import {
  type RecommendationsResult,
  recommendationsFor,
  resolveScenario,
  resolveTick,
  situationFor,
} from '@/lib/server/situationService';

/**
 * Ranked decision recommendations.
 *
 * Rate-limited: each item may cost an AI call for its reasoning. The action and
 * impact are engine-computed and unaffected by the limit, so a 429 costs prose,
 * never correctness.
 */
export const GET = withRoute<undefined, RecommendationsResult>(
  'GET /api/recommendations',
  { rateLimit: true },
  async ({ request }) => {
    const url = new URL(request.url);
    const scenario = resolveScenario(url.searchParams.get('scenario'));
    const tick = resolveTick(url.searchParams.get('tick'), url.searchParams.get('startedAt'));

    return recommendationsFor(situationFor(scenario, tick), scenario);
  },
);

export const dynamic = 'force-dynamic';
