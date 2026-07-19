import { CountUp } from '@/components/marketing/CountUp';
import { Reveal } from '@/components/marketing/Reveal';

function StatItem({ value, suffix, label }: { value: number; suffix?: string; label: string }) {
  return (
    <Reveal>
      <p className="text-4xl font-bold text-gradient sm:text-5xl">
        <CountUp value={value} suffix={suffix} />
      </p>
      <p className="mt-2 text-sm text-[var(--color-ink-dim)]">{label}</p>
    </Reveal>
  );
}

export function StatsSection() {
  return (
    <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]/40 py-16">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 text-center lg:grid-cols-4">
        <StatItem value={30} suffix="+" label="languages understood" />
        <StatItem value={483} label="automated tests, all green" />
        <StatItem value={95} suffix="%+" label="safety-engine coverage" />
        <StatItem value={100} suffix="%" label="deterministic safety math" />
      </div>
    </section>
  );
}
