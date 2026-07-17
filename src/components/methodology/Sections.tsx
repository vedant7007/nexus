/**
 * @module components/methodology/Sections
 *
 * Responsibility: the content of the trust page.
 *
 * Every constant is imported from the engine rather than retyped. A trust page
 * that can drift from the code it describes is worse than no trust page: it
 * would be documentation lying with authority.
 */
import { OVERFLOW_LANE_UPLIFT, STAFF_SURGE_UPLIFT } from '@/lib/engine/flow';
import { SEV1_KEYWORDS, TEAMS } from '@/lib/engine/severity';
import {
  DENSITY_BANDS,
  ETA_HORIZON_MIN,
  GATE_QUEUE_CRITICAL,
  GATE_UTILIZATION_BANDS,
  HEAT_STRESS_HUMIDITY_PCT,
  HEAT_STRESS_TEMP_C,
} from '@/lib/engine/thresholds';
import { VENUE_CAPACITY, VENUE_NAME } from '@/lib/sim/venue';

/**
 * A titled section of the trust page.
 *
 * @param props - Heading and content.
 * @returns The section.
 */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel p-6">
      <h2 className="text-lg font-bold tracking-tight text-[var(--color-ink)]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
        {children}
      </div>
    </section>
  );
}

/** A two-column reference table. */
function RefTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: readonly string[];
  rows: readonly (readonly string[])[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-xs uppercase tracking-wider text-[var(--color-ink-dim)]">
            {headers.map((header) => (
              <th key={header} scope="col" className="pb-2 pr-4 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-t border-[var(--color-border)]">
              {row.map((cell, index) => (
                <td
                  key={cell}
                  className={`py-2.5 pr-4 ${index === 0 ? 'font-medium text-[var(--color-ink)]' : ''}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DENSITY_ROWS: readonly (readonly string[])[] = [
  ['Normal', `Below ${DENSITY_BANDS.elevated}%`, 'Free movement. No action needed.'],
  [
    'Elevated',
    `${DENSITY_BANDS.elevated}–${DENSITY_BANDS.high}%`,
    'Comfortable movement ends. Monitor the trend.',
  ],
  [
    'High',
    `${DENSITY_BANDS.high}–${DENSITY_BANDS.critical}%`,
    'Movement is constrained. Intervene before it compounds.',
  ],
  [
    'Critical',
    `${DENSITY_BANDS.critical}% and above`,
    'Approaching unsafe crowd pressure. Act immediately.',
  ],
];

const SEVERITY_ROWS: readonly (readonly string[])[] = [
  [
    'A life-safety term appears (unconscious, not breathing, crush, fire, weapon, …)',
    `SEV-1 — ${TEAMS.medical} dispatched alongside the category’s own team`,
  ],
  [
    'The incident is in a zone already at critical density',
    'SEV-1 — a minor report inside crowd pressure is a potential trigger',
  ],
  [
    'A vulnerable person is named (child, elderly, wheelchair user, pregnant)',
    'SEV-2 floor — raised above the category default',
  ],
  ['Category: medical, crowd, security, or lost person', 'SEV-2 floor'],
  ['Category: facilities or transport', 'SEV-3 floor'],
];

/** The headline claim: the AI has no shape in which to express a severity. */
export function InterlockSection() {
  return (
    <Section title="The AI cannot express a severity">
      <p>
        The obvious design is to let the model triage an incident and have the engine override it
        when it gets one wrong. NEXUS does not do that, because an override is only ever as good as
        the list of cases you thought to override.
      </p>
      <p>
        Instead the model&rsquo;s output schema{' '}
        <strong className="text-[var(--color-ink)]">has no severity field and no team field</strong>
        . There is no shape in which it can express a triage decision. It reports what language a
        message is in, what it says in English, and which of six categories it falls under. The
        engine decides severity and routing from a keyword table, scanning both the original text
        and the translation — so a mistranslation cannot launder an emergency into a routine report.
      </p>
      <p className="rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent-dim)] px-4 py-3 text-[var(--color-ink)]">
        The consequence is testable, and tested:{' '}
        <strong>
          AI mode and rule-based mode reach identical severity on life-safety reports across
          English, Spanish, Bengali and Hindi.
        </strong>{' '}
        With Gemini switched off entirely, a report of{' '}
        <span lang="es" className="font-mono text-[0.8125rem]">
          &ldquo;hay una persona desmayada&rdquo;
        </span>{' '}
        is still SEV-1, still routed to {TEAMS.medical}. The AI makes the system easier to
        understand. It cannot make it less safe.
      </p>
    </Section>
  );
}

/** Crowd density thresholds and their sourcing. */
export function ThresholdsSection() {
  return (
    <Section title="Crowd density thresholds">
      <p>
        Density is a percentage of a zone&rsquo;s <em>safe</em> capacity, not its fire-code maximum.
        Safe capacity is set so 100% corresponds to roughly 4 people per square metre — the point,
        in established crowd-safety guidance (UK SGSA <em>Green Guide</em>; Fruin&rsquo;s Level of
        Service), at which involuntary contact begins and pressure waves become possible.
      </p>
      <RefTable
        caption="Crowd density bands and what each means"
        headers={['Band', 'Density', 'Meaning']}
        rows={DENSITY_ROWS}
      />
      <p>
        A gate is assessed on utilisation — arrivals as a percentage of what it can process — with
        bands at {GATE_UTILIZATION_BANDS.elevated}%, {GATE_UTILIZATION_BANDS.high}% and{' '}
        {GATE_UTILIZATION_BANDS.critical}%. A queue of {GATE_QUEUE_CRITICAL.toLocaleString('en-US')}{' '}
        people is critical on its own, whatever the rate: a gate that has caught up can still be
        holding a dangerous mass of people.
      </p>
      <p>
        Above {HEAT_STRESS_TEMP_C}°C <em>with</em> humidity at or above {HEAT_STRESS_HUMIDITY_PCT}%,
        every crowd risk is raised one band. Both are required, because dry heat is far better
        tolerated by a standing crowd than the same temperature when humid.
      </p>
    </Section>
  );
}

/** The severity rules table. */
export function SeveritySection() {
  return (
    <Section title="Severity rules">
      <p>
        Applied in order. A rule can only raise severity above the category&rsquo;s floor, never
        lower it. {SEV1_KEYWORDS.length} life-safety terms are matched, including common non-English
        forms so the interlock holds even when no translation is available.
      </p>
      <RefTable
        caption="Severity rules and their outcomes"
        headers={['If', 'Then']}
        rows={SEVERITY_ROWS}
      />
    </Section>
  );
}

/** How the impact numbers are computed. */
export function ImpactSection() {
  return (
    <Section title="How the impact numbers are computed">
      <p>
        Every figure beside a recommendation — the &ldquo;122% → 85%&rdquo; — comes from a
        conservation-of-people flow model, never from the language model. Rerouting a share of a
        gate&rsquo;s arrivals moves exactly those people to another gate and recomputes both
        utilisations; the queue drains at the surplus of throughput over the reduced inflow, and if
        there is no surplus the model says the queue never clears rather than inventing an
        optimistic time.
      </p>
      <p>
        Opening an overflow lane is modelled as +{Math.round(OVERFLOW_LANE_UPLIFT * 100)}%
        throughput, surging stewards as +{Math.round(STAFF_SURGE_UPLIFT * 100)}%. Projected time to
        critical is extrapolated from current net flow and suppressed beyond {ETA_HORIZON_MIN}{' '}
        minutes, where it stops being operationally useful.
      </p>
      <p>
        It is a first-order estimate and does not pretend otherwise. It is not a microsimulation of
        pedestrian movement. What it is, is defensible, deterministic, and identical every time you
        run it.
      </p>
    </Section>
  );
}

/** The venue and the simulated feed. */
export function VenueSection() {
  return (
    <Section title="The venue and the feed">
      <p>
        {VENUE_NAME} is a fictional {VENUE_CAPACITY.toLocaleString('en-US')}-capacity World Cup
        venue with 8 zones and 6 gates. The operational feed is simulated, and the simulator is a
        pure function of scenario and elapsed time over a seeded random source: the same scenario
        always produces the same match, so a demo is reproducible and a failing test is debuggable.
      </p>
      <p>
        The simulation conserves people. A scenario redistributes the crowd or shifts when it
        arrives; it never conjures extra spectators to manufacture a crisis. A transit delay means
        the same people arrive later and in a tighter window — which is what a transit delay
        actually does.
      </p>
    </Section>
  );
}
