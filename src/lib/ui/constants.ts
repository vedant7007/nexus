/**
 * @module ui/constants
 *
 * Responsibility: every tunable number the UI uses, named and in one place.
 *
 * Nothing here may be inlined at a call site. A `3000` in a JSX prop is a number
 * nobody can search for, review, or reason about six months later; `SIM_POLL_MS`
 * is a decision with a name and a rationale.
 */

/**
 * How often the dashboard re-reads the live snapshot, in milliseconds.
 *
 * Matches the simulator's own tick rate: polling faster burns Cloud Run
 * requests to re-render numbers that have not changed, and polling slower makes
 * the feed visibly stutter.
 */
export const SIM_POLL_MS = 3_000;

/**
 * How often the AI briefing refreshes, in milliseconds.
 *
 * Far slower than the snapshot, and deliberately so: each refresh costs a Gemini
 * call against a 15/min budget, and a briefing that rewrites itself every three
 * seconds is unreadable in a control room. Twenty seconds keeps it current
 * without spending the budget or the operator's attention.
 */
export const BRIEFING_REFRESH_MS = 20_000;

/**
 * How often recommendations refresh, in milliseconds.
 *
 * Offset from the briefing cadence so the two AI panels do not fire their calls
 * in the same instant and trip the rate limiter together.
 */
export const RECOMMENDATIONS_REFRESH_MS = 25_000;

/** How often the incident log re-reads, in milliseconds. No AI cost. */
export const INCIDENTS_POLL_MS = 10_000;

/**
 * Tick the dashboard clock opens on.
 *
 * Not zero: at kickoff minus 60 the stadium is nearly empty and every scenario
 * reads "normal" for the first minute, so the feed opens partway into the fill
 * where a crisis scenario is already visibly diverging. Chosen so a normal
 * matchday still reads normal here, while gate-surge escalates to critical
 * within a few live ticks.
 */
export const DEMO_START_TICK = 18;

/** Density percentage at or above which a zone tile reads as full. */
export const ZONE_TILE_FULL_PCT = 100;

/** Maximum recommendation cards rendered at once. */
export const MAX_VISIBLE_RECOMMENDATIONS = 3;

/** Characters accepted in the incident report field. Mirrors the API bound. */
export const REPORT_MAX_CHARS = 800;

/** Minimum characters before the incident form will submit. Mirrors the API. */
export const REPORT_MIN_CHARS = 3;

/** Rows of the incident log shown before scrolling. */
export const INCIDENT_LOG_PAGE_SIZE = 25;

/** Milliseconds a transient "acknowledged" confirmation stays on screen. */
export const ACK_CONFIRM_MS = 2_500;
