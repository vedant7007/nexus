// Every tunable number the UI uses, named and in one place. Nothing here may be
// inlined at a call site: a `3000` in a JSX prop is unsearchable, whereas
// `SIM_POLL_MS` is a decision with a name and a rationale.

/**
 * How often the dashboard re-reads the live snapshot, in milliseconds.
 *
 * Matches the simulator's own tick rate: polling faster burns Cloud Run
 * requests to re-render numbers that have not changed, and polling slower makes
 * the feed visibly stutter.
 */
export const SIM_POLL_MS = 3_000;

/**
 * How often the AI situational briefing refreshes, in milliseconds.
 *
 * Deliberately slow. Each refresh costs a Gemini call against a shared ~15/min
 * free-tier ceiling, so steady-state polling is kept frugal — the *important*
 * updates are event-driven, not timer-driven: the briefing re-fetches the
 * instant the overall risk level changes (see `useEscalation` / `revalidateKey`
 * in the hooks). The timer is only a backstop for slow drift, so 35s is ample
 * and a control-room briefing that rewrote itself every few seconds would be
 * unreadable anyway.
 */
export const BRIEFING_REFRESH_MS = 35_000;

/**
 * How often the sustainability insight refreshes, in milliseconds.
 *
 * Slowest of the three AI panels: energy/waste/transport figures move
 * gradually, so a 90s cadence keeps it current at a fraction of the quota. It
 * has no level-change trigger — nothing about it is time-critical.
 */
export const SUSTAINABILITY_REFRESH_MS = 90_000;

/**
 * How often recommendations refresh, in milliseconds.
 *
 * Offset from the briefing cadence so the two AI panels do not fire their calls
 * in the same instant. Like the briefing, it also re-fetches immediately on a
 * level change, so this timer is a backstop rather than the primary trigger.
 */
export const RECOMMENDATIONS_REFRESH_MS = 40_000;

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

/**
 * How long the overall risk level must hold before it triggers an AI-panel
 * refresh, in milliseconds.
 *
 * Longer than a couple of simulator ticks, so band-boundary jitter cannot flap
 * the level and burn Gemini quota; short enough that a genuine escalation still
 * reaches the AI panels within a few seconds. The status pill is not debounced.
 */
export const LEVEL_SETTLE_MS = 6_000;

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
