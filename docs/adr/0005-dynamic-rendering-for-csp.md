# ADR-0005: Dynamic rendering to carry a per-request CSP nonce

## Context

The app ships a strict Content-Security-Policy with a per-request nonce, so inline
scripts must carry a matching `nonce`. A nonce is per-request by definition; it
cannot exist in a page rendered once at build time. With static prerendering, the
browser refused every one of Next's own scripts and the app shipped with **no
client JavaScript at all** — a defect the tests caught before it shipped.

## Decision

Opt the root layout into dynamic rendering by reading `headers()` in it. The read
is load-bearing (it forces dynamic rendering); the value is unused. Every page
then renders per-request and Next stamps the nonce onto its script tags.

## Consequences

- The strict nonce CSP holds and the client actually hydrates.
- No page is statically prerendered. That is the correct trade here: this is an
  authenticated operations console behind `min-instances=1`, so there is no cold
  start to amortise and nothing worth caching at the edge — every page shows live
  state anyway.
- The reasoning lives here (and in one comment at the `headers()` call) rather
  than as a mystery that a future maintainer might "optimize" back into a broken
  static build.
