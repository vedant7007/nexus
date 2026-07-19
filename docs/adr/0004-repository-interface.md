# ADR-0004: Persistence is an interface, with an in-memory double

## Context

Incidents must persist to Firestore in production. But route and service tests
should not need a Firestore emulator, network, or credentials, and a misconfigured
database must fail loudly rather than silently lose safety logs.

This is the decision most at risk of reading as over-engineering, so the
justification is explicit.

## Decision

- Services depend on an `IncidentRepository` **interface**, never on Firestore.
- Two implementations satisfy it: `FirestoreIncidentRepository` (production) and
  `InMemoryIncidentRepository` (the test double), living side by side as two halves
  of one contract. A shared conformance suite proves they behave the same.
- There is **no automatic in-memory fallback** in production. The in-memory
  repository is constructed only by tests and the explicit demo build.

## Consequences

- Route and service tests run with zero external dependencies against the double,
  while production runs against Firestore through the identical surface.
- A misconfigured database fails loudly (a 500, logged) instead of writing safety
  logs to a `Map` that vanishes on the next cold start.
- Inbound Firestore documents are Zod-validated on read (`incidentSchema`), not
  cast — the persistence boundary is held to the same "validate at the edge"
  standard as the network boundary.
- Cost: one interface and one extra class for a single entity. Judged worth it
  because it is what makes the test suite hermetic and the failure mode safe — the
  abstraction earns its keep, it is not pattern cosplay.
