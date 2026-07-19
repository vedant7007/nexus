# ADR-0003: Fallbacks are the product, not an apology

## Context

The AI is a network call to an external model: it can be slow, rate-limited, or
down. A control room cannot go dark because Gemini had a bad minute.

## Decision

Treat degradation as a designed path, not an exception.

- Every AI call returns a discriminated result the caller must handle, behind an
  **8s timeout** with **Zod validation** of the model's output. Unparseable or
  late output is not a crash — it is a fallback.
- Every AI feature has a **deterministic fallback written before the feature it
  backs**. The templated briefing carries the same real engine numbers; rule-based
  triage keeps the full severity and routing guarantee with the model off.
- Provenance is surfaced: every AI route returns `mode: 'ai' | 'rule'`, and the UI
  shows an **AI / Rule-based** badge on every panel.

## Consequences

- Tests assert AI mode and rule mode reach identical severity on the same
  life-safety reports across four languages, so the fallback cannot silently decay
  into a second-class path.
- The whole demo arc works with the AI switched off — verified in an end-to-end
  "AI endpoints fail" spec.
- The timeout was raised 4s → 8s once real latency was measured (Gemini 2.5-flash
  with extended thinking disabled runs ~2s; 8s is headroom over network variance,
  and the deterministic panels are instant regardless).
- Cost: two code paths per feature. Mitigated by making the fallback the _default_
  mental model — the AI is an enhancement layered on a working rule-based product.
