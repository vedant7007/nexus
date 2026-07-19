# ADR-0001: The AI has no shape in which to express a safety number

## Context

The product is GenAI-central: the model writes briefings, explains decisions, and
understands incident reports in 30+ languages. But a stadium control room cannot
accept a severity or a crowd number that a language model invented or
hallucinated. "Prompt the model to be careful" is not a guarantee.

## Decision

Make the unsafe state **unrepresentable** rather than merely discouraged.

- The triage model's output schema (`triageProposalSchema`) has no `severity`
  field and no `team` field. There is no shape in which the model can express a
  triage decision — only the detected language, an English translation, and one
  of six operational _categories_.
- The deterministic engine (`classifySeverity`) decides severity and routing from
  a keyword table, scanning **both** the raw report and the translation, so a
  mistranslation cannot launder an emergency into a routine note. A life-safety
  keyword overrides the model's proposed category outright.
- Every crowd number, threshold, ETA, and impact figure comes from the pure
  engine. The model is handed those facts and asked only to phrase them.

## Consequences

- The guarantee is testable, and tested: AI mode and rule mode reach identical
  severity on life-safety reports across English, Spanish, Bengali, and Hindi.
  With the model off, _"hay una persona desmayada"_ is still SEV-1, still routed
  to Medical Response.
- The model can be wrong, slow, or absent without ever moving a safety outcome.
- Cost: two representations of an incident (the model's proposal and the engine's
  decision) must be kept coherent in the triage view. We show them side by side
  and label which is which, turning that cost into a trust feature.
