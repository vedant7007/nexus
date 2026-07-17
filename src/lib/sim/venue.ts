/**
 * @module sim/venue
 *
 * Responsibility: the static physical configuration of the demo venue.
 *
 * A fictional ~82,500-seat World Cup stadium: 8 zones, 6 gates, 4 transit lines.
 * Capacities are *safe* capacities, set so that 100% density corresponds to the
 * ~4 people/m² high-risk onset documented in engine/thresholds.
 */

/** Static definition of a zone. */
export interface ZoneConfig {
  id: string;
  name: string;
  /** Safe capacity in people. */
  capacity: number;
  /** Id of the nearest first-aid point serving this zone. */
  firstAidZoneId: string;
}

/** Static definition of a gate. */
export interface GateConfig {
  id: string;
  name: string;
  /** Sustained processing capacity in people per minute at normal staffing. */
  baseThroughputPerMin: number;
  /** Share of total arrivals this gate normally receives, 0–1. */
  arrivalShare: number;
  /** Zone this gate feeds. */
  feedsZoneId: string;
}

/** Static definition of a transit line. */
export interface TransitConfig {
  line: string;
  /** Share of arriving spectators using this line, 0–1. */
  arrivalShare: number;
}

/** Venue display name. */
export const VENUE_NAME = 'Meridian Stadium';

/** Total safe capacity across all zones. */
export const VENUE_CAPACITY = 82_500;

/** First-aid points, referenced by zones for deterministic incident routing. */
export const FIRST_AID_POINTS: readonly { id: string; name: string }[] = [
  { id: 'fa-north', name: 'North First Aid Post' },
  { id: 'fa-south', name: 'South First Aid Post' },
  { id: 'fa-east', name: 'East Medical Centre' },
  { id: 'fa-west', name: 'West Medical Centre' },
];

/** The eight zones of the venue. */
export const ZONES: readonly ZoneConfig[] = [
  { id: 'z1', name: 'North Lower', capacity: 12_000, firstAidZoneId: 'fa-north' },
  { id: 'z2', name: 'North Upper', capacity: 9_500, firstAidZoneId: 'fa-north' },
  { id: 'z3', name: 'East Concourse', capacity: 8_000, firstAidZoneId: 'fa-east' },
  { id: 'z4', name: 'East Stand', capacity: 11_500, firstAidZoneId: 'fa-east' },
  { id: 'z5', name: 'South Lower', capacity: 12_000, firstAidZoneId: 'fa-south' },
  { id: 'z6', name: 'South Upper', capacity: 9_500, firstAidZoneId: 'fa-south' },
  { id: 'z7', name: 'West Concourse', capacity: 8_000, firstAidZoneId: 'fa-west' },
  { id: 'z8', name: 'West Stand', capacity: 12_000, firstAidZoneId: 'fa-west' },
];

/**
 * The six gates of the venue. Arrival shares sum to 1.
 *
 * Two properties are deliberate and are asserted by tests:
 *
 *  - **Throughput is per *gate*, not per turnstile.** Each gate runs a bank of
 *    turnstiles in parallel, which is why the figures are in the hundreds. Total
 *    throughput (~1,800/min) is sized with deliberate headroom over the ~1,650/min
 *    peak arrival rate, exactly as a real venue is: gates run hot through the rush
 *    (utilisation in the 80–100% band) but a normal matchday never saturates them.
 *    Undersizing them would make every ordinary rush read 'critical' and train an
 *    operator to ignore the alarm.
 *
 *  - **Each gate's arrival share is proportional to the capacity of the zone it
 *    feeds.** Ticket allocation follows the stand a fan sits in, so a gate serving
 *    a 12,000-seat stand receives more of the crowd than one serving an 8,000
 *    concourse. Getting this wrong makes zones fill past capacity on a normal
 *    matchday and pins every density readout to critical.
 */
export const GATES: readonly GateConfig[] = [
  {
    id: 'gA',
    name: 'Gate A',
    baseThroughputPerMin: 354,
    arrivalShare: 12_000 / 61_000,
    feedsZoneId: 'z1',
  },
  {
    id: 'gB',
    name: 'Gate B',
    baseThroughputPerMin: 280,
    arrivalShare: 9_500 / 61_000,
    feedsZoneId: 'z2',
  },
  {
    id: 'gC',
    name: 'Gate C',
    baseThroughputPerMin: 236,
    arrivalShare: 8_000 / 61_000,
    feedsZoneId: 'z3',
  },
  {
    id: 'gD',
    name: 'Gate D',
    baseThroughputPerMin: 339,
    arrivalShare: 11_500 / 61_000,
    feedsZoneId: 'z4',
  },
  {
    id: 'gE',
    name: 'Gate E',
    baseThroughputPerMin: 354,
    arrivalShare: 12_000 / 61_000,
    feedsZoneId: 'z5',
  },
  {
    id: 'gF',
    name: 'Gate F',
    baseThroughputPerMin: 236,
    arrivalShare: 8_000 / 61_000,
    feedsZoneId: 'z7',
  },
];

/** The transit lines serving the venue. Arrival shares sum to 1. */
export const TRANSIT_LINES: readonly TransitConfig[] = [
  { line: 'Metro Blue Line', arrivalShare: 0.35 },
  { line: 'Metro Red Line', arrivalShare: 0.25 },
  { line: 'Regional Rail', arrivalShare: 0.2 },
  { line: 'Shuttle Network', arrivalShare: 0.2 },
];

/** Ids of zones served directly by a gate. */
const FED_ZONE_IDS: ReadonlySet<string> = new Set(GATES.map((g) => g.feedsZoneId));

/**
 * Reports whether a zone is entered directly through a gate.
 *
 * Zones without their own gate (upper tiers, far stands) fill by internal
 * circulation from the concourses instead.
 *
 * @param zoneId - Zone to test.
 * @returns True when at least one gate feeds this zone.
 */
export function isGateFedZone(zoneId: string): boolean {
  return FED_ZONE_IDS.has(zoneId);
}

/** Combined safe capacity of every gate-fed zone. */
export const FED_CAPACITY: number = ZONES.filter((z) => isGateFedZone(z.id)).reduce(
  (sum, z) => sum + z.capacity,
  0,
);

/** Combined safe capacity of every zone reached only by internal circulation. */
export const UNFED_CAPACITY: number = VENUE_CAPACITY - FED_CAPACITY;

/**
 * Share of admitted spectators who pass through their entry zone and continue on
 * to a zone with no gate of its own.
 *
 * Derived from capacity rather than tuned: if 26% of the venue's seats can only
 * be reached by walking on from a concourse, then 26% of the crowd must do so.
 * This is what keeps the simulation conserving people.
 */
export const TRANSIT_SHARE: number = UNFED_CAPACITY / VENUE_CAPACITY;

/**
 * Finds the first-aid point nearest a zone.
 *
 * @param zoneId - Zone to look up.
 * @returns The first-aid point id, or the north post as a safe default when the
 *   zone is unknown — routing a responder to a real post always beats failing.
 */
export function nearestFirstAid(zoneId: string): string {
  return ZONES.find((z) => z.id === zoneId)?.firstAidZoneId ?? 'fa-north';
}

/**
 * Looks up a zone's display name.
 *
 * @param zoneId - Zone to look up.
 * @returns The zone name, or the id itself when unknown.
 */
export function zoneName(zoneId: string): string {
  return ZONES.find((z) => z.id === zoneId)?.name ?? zoneId;
}
