// Re-exported from the wire schemas rather than redeclared, so a component's
// props and the validator that admits the data cannot drift apart.
import type { z } from 'zod';

import type { gateStateSchema, zoneStateSchema } from '../schemas/api';

/** A zone's live state. */
export type ZoneStateDto = z.infer<typeof zoneStateSchema>;

/** A gate's live state. */
export type GateStateDto = z.infer<typeof gateStateSchema>;
