import { z } from 'zod';

import { notFound } from '@/lib/server/errors';
import { withRoute } from '@/lib/server/handler';
import { setIncidentStatus } from '@/lib/server/incidentService';
import type { Incident } from '@/lib/server/repository';
import { getRepository } from '@/lib/server/repositoryProvider';

const patchSchema = z.object({
  status: z.enum(['open', 'acknowledged', 'resolved']),
});

// Read the id from the path (not the route's params argument) so the handler
// keeps the plain `(request) => Response` signature that `withRoute` wraps.
function idFrom(request: Request): string {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean);
  const id = segments[segments.length - 1];
  if (id === undefined || id.length === 0) throw notFound('Incident not found.');
  return id;
}

/** Updates an incident's status. */
export const PATCH = withRoute<z.infer<typeof patchSchema>, Incident>(
  'PATCH /api/incidents/[id]',
  { schema: patchSchema },
  async ({ body, request }) => setIncidentStatus(idFrom(request), body.status, getRepository()),
);

export const dynamic = 'force-dynamic';
