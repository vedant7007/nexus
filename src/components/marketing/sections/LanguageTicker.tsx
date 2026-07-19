// Each phrase is a real life-safety report; every one resolves to SEV-1 in the
// engine regardless of language — the marquee makes the multilingual claim
// concrete. Duplicated in the render so the CSS marquee loops seamlessly.
const INCIDENT_PHRASES = [
  { lang: 'Spanish', text: 'hay una persona desmayada' },
  { lang: 'Bengali', text: 'একজন অজ্ঞান হয়ে পড়েছে' },
  { lang: 'Hindi', text: 'एक व्यक्ति बेहोश हो गया' },
  { lang: 'French', text: "une personne s'est évanouie" },
  { lang: 'Arabic', text: 'شخص فقد وعيه' },
  { lang: 'Portuguese', text: 'uma pessoa desmaiou' },
  { lang: 'German', text: 'eine Person ist ohnmächtig' },
  { lang: 'Japanese', text: '気を失った人がいます' },
] as const;

export function LanguageTicker() {
  return (
    <section
      aria-label="Multilingual incident examples"
      className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/40 py-6"
    >
      <p className="mx-auto mb-4 max-w-6xl px-6 text-center text-xs uppercase tracking-[0.16em] text-[var(--color-ink-dim)]">
        Any language in · one triaged decision out — every phrase below resolves to{' '}
        <span className="text-[var(--color-status-critical-text)]">SEV-1 · Medical Response</span>
      </p>
      <div className="marquee-mask overflow-hidden">
        <div className="marquee gap-3">
          {[...INCIDENT_PHRASES, ...INCIDENT_PHRASES].map((phrase, index) => (
            <span
              key={index}
              className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-1.5 text-sm text-[var(--color-ink-muted)]"
            >
              <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--color-ink-dim)]">
                {phrase.lang}
              </span>
              <span>{phrase.text}</span>
              <span aria-hidden="true" className="text-[var(--color-status-critical)]">
                →
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
