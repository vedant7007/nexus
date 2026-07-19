# Architecture

NEXUS is a stadium control-room command center. The whole design serves one
constraint: **generative AI is load-bearing for language, and structurally
forbidden from deciding anything safety-critical.** Everything below follows from
that.

For the numbers behind the safety rules (density bands, severity keywords, flow
model), see the in-app [`/methodology`](src/app/methodology/page.tsx) page — it
renders them straight from the engine. This document is the code-level map.

## Layering

Requests flow in exactly one direction, and each layer may only call the one
below it:

```
route  →  withRoute  →  service  →  engine | ai | repository
```

- **route** (`src/app/api/*`) — a thin adapter. It names the service call and the
  response shape; nothing else. Cross-cutting concerns are not its job.
- **withRoute** (`src/lib/server/handler.ts`) — the single edge harness. It owns
  auth, Zod validation of the request, rate limiting, the typed error envelope,
  and the guarantee that an unexpected throw becomes a bare 500 (detail logged,
  never serialized to the client). Written once so every route inherits it.
- **service** (`situationService`, `incidentService`) — orchestration. Composes
  engine, AI, and repository into one operation.
- **engine / ai / repository** — the three leaf capabilities, described below.

The client never computes a safety value. The server owns all authoritative
state; the browser polls and renders.

See [ADR-0004](docs/adr/0004-repository-interface.md) for why persistence is an
interface, and [ADR-0005](docs/adr/0005-dynamic-rendering-for-csp.md) for why no
page is statically prerendered.

## The deterministic core

`src/lib/engine/` is pure, tested safety math — thresholds, risk assessment, the
crowd-flow model, severity rules, sustainability. Every crowd number, threshold,
ETA, and "110% → 92%" impact figure originates here. It is a pure function of its
inputs and is covered to ≥95%.

`src/lib/sim/` is the operational feed: a seeded simulator that is a pure function
of `(scenario, tick)`. Because it holds no state, multiple Cloud Run instances
serving consecutive polls agree, and any tick is directly addressable from a test.
It conserves people — a transit delay is the same crowd arriving later and
tighter, not invented spectators — and is calibrated so a normal matchday peaks at
"high", leaving "critical" meaningful. See
[ADR-0002](docs/adr/0002-deterministic-engine-and-simulator.md).

## The AI layer and the safety interlock

`src/lib/ai/` wraps Gemini (via Vertex AI). The model does only what a language
model can: write a briefing, explain a decision, understand an incident reported
in any of 30+ languages.

It cannot set a safety value, and this is enforced by a **type, not a
convention**: the triage model's output schema has no `severity` field and no
`team` field, so there is no shape in which it can express a triage decision. It
proposes a _category_; the engine's `classifySeverity` decides severity and
routing from a keyword table, scanning both the raw report and the translation so
a mistranslation cannot launder an emergency into a routine note. A life-safety
keyword overrides the model's proposed category outright. This is the central
design decision — [ADR-0001](docs/adr/0001-safety-interlock.md).

## Resilience

Every AI call returns a discriminated result the caller must handle, behind an 8s
timeout with Zod validation of the model's output. Every feature has a
deterministic fallback that carries the same real numbers, and the fallback was
written before the feature it backs — rule-based triage keeps the full severity
and routing guarantee with the model switched off entirely. Tests assert AI mode
and rule mode reach identical severity on the same life-safety reports across four
languages, so the fallback cannot decay into a second-class path. See
[ADR-0003](docs/adr/0003-resilience-and-fallbacks.md).

## The client

`src/components/` is presentational — props in, UI out, never a `fetch`. Every
request goes through a data hook in `src/lib/ui/` (`useSnapshot`, `useSituation`,
`useBriefing`, `useRecommendations`, `useIncidents`), each composing one polling
primitive. Every response is parsed with the shared Zod schemas
(`src/lib/schemas/api.ts`) at the door, which is what lets the UI layer carry no
`any` and no non-null assertions: the DTO types are _inferred from_ the schemas,
so a type and its validator cannot drift.

## Configuration and security

`src/lib/config.ts` is the single environment gateway — a Zod-validated module
that every other file reads config through, so a missing or malformed variable
fails at one predictable place.

`src/middleware.ts` issues a per-request nonce CSP and the security headers. The
nonce requirement is why the app renders dynamically rather than statically
([ADR-0005](docs/adr/0005-dynamic-rendering-for-csp.md)). Firebase ID tokens are
verified in `withRoute`; Firestore rules deny all client access (the Admin SDK is
the only reader). Gemini runs through Vertex AI on the Cloud Run service account —
there is no API key in the repo or the deployment.

## Directory map

| Path               | Responsibility                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `src/lib/engine/`  | Pure safety math. ≥95% covered.                                                              |
| `src/lib/sim/`     | Seeded simulator, pure in `(scenario, tick)`. ≥95% covered.                                  |
| `src/lib/ai/`      | Gemini client, briefings, triage, deterministic fallbacks.                                   |
| `src/lib/server/`  | Auth, the `withRoute` harness, typed errors, repository + Firestore impl + in-memory double. |
| `src/lib/schemas/` | Zod wire contracts; DTO types inferred from them.                                            |
| `src/lib/ui/`      | Typed API client, data hooks, one polling primitive, status vocabulary.                      |
| `src/components/`  | Radix-based, accessible, presentational components.                                          |
| `src/app/`         | App Router pages and API routes.                                                             |
