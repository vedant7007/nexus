import { z } from 'zod';

import { MAX_REPORT_CHARS } from '@/lib/ai/triage';
import { withRoute } from '@/lib/server/handler';
import { INCIDENT_LIST_LIMIT, reportIncident } from '@/lib/server/incidentService';
import type { Incident } from '@/lib/server/repository';
import { getRepository } from '@/lib/server/repositoryProvider';
import { resolveScenario, resolveTick } from '@/lib/server/situationService';
import { simulate } from '@/lib/sim/simulator';

/**
 * Note what is absent: severity, team, and routing. They are not optional here
 * — they are unrepresentable. The server derives them from the engine, so a
 * malicious or buggy client cannot under-triage its own report.
 */
const createSchema = z.object({
  rawText: z.string().trim().min(3, 'Describe the incident.').max(MAX_REPORT_CHARS),
  zoneId: z.string().trim().min(1, 'Select a zone.'),
  scenario: z.string().optional(),
  tick: z.number().int().min(0).max(200).optional(),
});

/** Creates an incident. Rate-limited: triage may spend an AI call. */
export const POST = withRoute<z.infer<typeof createSchema>, Incident>(
  'POST /api/incidents',
  { schema: createSchema, rateLimit: true },
  async ({ body, user }) => {
    const scenario = resolveScenario(body.scenario ?? null);
    const tick = resolveTick(body.tick === undefined ? null : String(body.tick), null);
    const snapshot = simulate(scenario, tick);

    return reportIncident(
      { rawText: body.rawText, zoneId: body.zoneId },
      snapshot,
      user.uid,
      getRepository(),
    );
  },
);

/** Lists incidents, most severe first. */
export const GET = withRoute<undefined, { incidents: Incident[] }>(
  'GET /api/incidents',
  {},
  async () => ({ incidents: await getRepository().list(INCIDENT_LIST_LIMIT) }),
);

export const dynamic = 'force-dynamic';
