import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { BriefingPanel } from '@/components/dashboard/BriefingPanel';
import { RecommendationsPanel } from '@/components/dashboard/RecommendationsPanel';
import { ZoneGrid } from '@/components/dashboard/ZoneGrid';
import { ModeBadge } from '@/components/ui/ModeBadge';
import { StatusPill } from '@/components/ui/StatusPill';
import type { RecommendationsDto } from '@/lib/schemas/api';
import type { GateStateDto, ZoneStateDto } from '@/lib/ui/dto';

/** vitest-axe's result type is loose; this narrows what we assert on. */
async function expectNoAxeViolations(container: HTMLElement): Promise<void> {
  const results = await axe(container);
  expect(results.violations).toEqual([]);
}

const BRIEFING = {
  text: 'Overall status is critical with 20 minutes to kickoff. Gate C is over capacity.',
  mode: 'ai' as const,
  generatedAt: '2026-06-14T18:00:00.000Z',
};

const RECOMMENDATIONS: RecommendationsDto = {
  mode: 'ai',
  items: [
    {
      riskId: 'gate:gC',
      subjectName: 'Gate C',
      level: 'critical',
      action: 'Reroute 30% of Gate C arrivals to Gate A',
      impact: 'Gate C utilization 122% → 85.4%; Gate A 56.2% → 76.9%.',
      reasoning: 'Gate C is at critical risk and needs intervention now.',
    },
  ],
};

const ZONES: ZoneStateDto[] = [
  {
    id: 'z1',
    name: 'North Lower',
    occupancy: 9_600,
    capacity: 12_000,
    densityPct: 80,
    netFlowPerMin: 40,
  },
  {
    id: 'z3',
    name: 'East Concourse',
    occupancy: 7_800,
    capacity: 8_000,
    densityPct: 97.5,
    netFlowPerMin: 60,
  },
];

const GATES: GateStateDto[] = [
  {
    id: 'gC',
    name: 'Gate C',
    inflowPerMin: 247,
    throughputPerMin: 203,
    queueLen: 3_053,
    utilizationPct: 122,
    feedsZoneId: 'z3',
  },
];

describe('StatusPill', () => {
  it('always renders the level as text, never colour alone', () => {
    render(<StatusPill level="critical" />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it.each(['normal', 'elevated', 'high', 'critical'] as const)('renders %s', (level) => {
    render(<StatusPill level={level} />);
    expect(screen.getByText(new RegExp(level, 'i'))).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<StatusPill level="high" prefix="Overall:" />);
    await expectNoAxeViolations(container);
  });
});

describe('ModeBadge', () => {
  it('names the AI source', () => {
    render(<ModeBadge mode="ai" />);
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('names rule-based mode as provenance, not an error', () => {
    render(<ModeBadge mode="rule" />);

    expect(screen.getByText('Rule-based')).toBeInTheDocument();
    // The wording matters: this is a feature, so it must not read as a failure.
    expect(screen.getByTitle(/Same numbers, same safety decisions/)).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<ModeBadge mode="rule" />);
    await expectNoAxeViolations(container);
  });
});

describe('BriefingPanel', () => {
  it('renders the briefing text and its mode', () => {
    render(<BriefingPanel briefing={BRIEFING} loading={false} error={null} onRetry={vi.fn()} />);

    expect(screen.getByText(/Overall status is critical/)).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('announces updates politely rather than interrupting', () => {
    const { container } = render(
      <BriefingPanel briefing={BRIEFING} loading={false} error={null} onRetry={vi.fn()} />,
    );

    const live = container.querySelector('[aria-live]');
    expect(live).toHaveAttribute('aria-live', 'polite');
  });

  it('shows a rule-based badge without looking broken', () => {
    render(
      <BriefingPanel
        briefing={{ ...BRIEFING, mode: 'rule' }}
        loading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText('Rule-based')).toBeInTheDocument();
    expect(screen.getByText(/Overall status is critical/)).toBeInTheDocument();
  });

  it('shows a retryable error only when there is no briefing to show', async () => {
    const onRetry = vi.fn();
    render(
      <BriefingPanel
        briefing={null}
        loading={false}
        error={{ code: 'network', message: 'Could not reach the server.' }}
        onRetry={onRetry}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('keeps showing stale text rather than blanking when a refresh fails', () => {
    render(
      <BriefingPanel
        briefing={BRIEFING}
        loading={false}
        error={{ code: 'network', message: 'Could not reach the server.' }}
        onRetry={vi.fn()}
      />,
    );

    // Stale numbers beat no numbers in a control room.
    expect(screen.getByText(/Overall status is critical/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <BriefingPanel briefing={BRIEFING} loading={false} error={null} onRetry={vi.fn()} />,
    );
    await expectNoAxeViolations(container);
  });
});

describe('RecommendationsPanel', () => {
  const props = {
    recommendations: RECOMMENDATIONS,
    loading: false,
    error: null,
    onRetry: vi.fn(),
    onAcknowledge: vi.fn(),
    acknowledged: new Set<string>(),
  };

  it('shows the engine-computed impact prominently', () => {
    render(<RecommendationsPanel {...props} />);

    expect(screen.getByText('Computed impact')).toBeInTheDocument();
    expect(screen.getByText(/122% → 85.4%/)).toBeInTheDocument();
  });

  it('shows the action and the reasoning', () => {
    render(<RecommendationsPanel {...props} />);

    expect(screen.getByText('Reroute 30% of Gate C arrivals to Gate A')).toBeInTheDocument();
    expect(screen.getByText(/needs intervention now/)).toBeInTheDocument();
  });

  it('keeps impact numbers in rule mode — a failed AI call costs prose, not correctness', () => {
    render(
      <RecommendationsPanel {...props} recommendations={{ ...RECOMMENDATIONS, mode: 'rule' }} />,
    );

    expect(screen.getByText('Rule-based')).toBeInTheDocument();
    expect(screen.getByText(/122% → 85.4%/)).toBeInTheDocument();
  });

  it('acknowledges a recommendation', async () => {
    const onAcknowledge = vi.fn();
    render(<RecommendationsPanel {...props} onAcknowledge={onAcknowledge} />);

    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
    expect(onAcknowledge).toHaveBeenCalledWith('gate:gC');
  });

  it('marks an acknowledged recommendation and disables it', () => {
    render(<RecommendationsPanel {...props} acknowledged={new Set(['gate:gC'])} />);

    expect(screen.getByRole('button', { name: /Acknowledged/ })).toBeDisabled();
  });

  it('shows a calm empty state rather than a blank panel', () => {
    render(<RecommendationsPanel {...props} recommendations={{ items: [], mode: 'rule' }} />);
    expect(screen.getByText(/No action needed/)).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<RecommendationsPanel {...props} />);
    await expectNoAxeViolations(container);
  });
});

describe('ZoneGrid', () => {
  it('renders density with a text label alongside the colour', () => {
    render(<ZoneGrid zones={ZONES} gates={GATES} loading={false} />);

    expect(screen.getByText('North Lower')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    // The label is what makes it readable without colour vision.
    expect(screen.getByText('Elevated')).toBeInTheDocument();
  });

  it('formats headcounts with thousands separators', () => {
    render(<ZoneGrid zones={ZONES} gates={GATES} loading={false} />);
    expect(screen.getByText('9,600')).toBeInTheDocument();
  });

  it('renders gate load with a label', () => {
    render(<ZoneGrid zones={ZONES} gates={GATES} loading={false} />);

    const gates = screen.getByRole('heading', { name: 'Gates' }).parentElement;
    expect(gates).not.toBeNull();
    if (gates !== null) {
      expect(within(gates).getByText('Gate C')).toBeInTheDocument();
      expect(within(gates).getByText('3,053')).toBeInTheDocument();
    }
  });

  it('has no axe violations', async () => {
    const { container } = render(<ZoneGrid zones={ZONES} gates={GATES} loading={false} />);
    await expectNoAxeViolations(container);
  });
});
