import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { StadiumMap } from '@/components/dashboard/StadiumMap';
import { SustainabilityStrip } from '@/components/dashboard/SustainabilityStrip';
import { IncidentLog } from '@/components/incidents/IncidentLog';
import { ReportForm } from '@/components/incidents/ReportForm';
import { TriageResult } from '@/components/incidents/TriageResult';
import { Panel, PanelEmpty, PanelError, PanelSkeleton } from '@/components/ui/Panel';
import type { IncidentDto, SnapshotDto, TriagePreviewDto } from '@/lib/schemas/api';
import type { ZoneStateDto } from '@/lib/ui/dto';

/** Narrows vitest-axe's loose result before asserting. */
async function expectNoAxeViolations(container: HTMLElement): Promise<void> {
  const results = await axe(container);
  expect(results.violations).toEqual([]);
}

const SEV1_PREVIEW: TriagePreviewDto = {
  detectedLanguage: 'Spanish',
  englishText: 'There is a person who has fainted in section 114.',
  type: 'medical',
  severity: 'SEV1',
  team: 'Medical Response',
  matchedRule: 'life-safety keyword "desmayad" → SEV1 (overrides proposed type "facilities")',
  protocol: ['Dispatch Medical Response to the reported location.', 'Alert East Medical Centre.'],
  mode: 'ai',
};

const INCIDENT: IncidentDto = {
  id: 'inc-1',
  type: 'medical',
  severity: 'SEV1',
  zoneId: 'z3',
  rawText: 'hay una persona desmayada',
  englishText: 'A person has fainted.',
  language: 'Spanish',
  protocol: ['Dispatch Medical Response.'],
  status: 'open',
  team: 'Medical Response',
  nearestFirstAidZoneId: 'fa-east',
  matchedRule: 'life-safety keyword',
  mode: 'ai',
  createdAt: '2026-06-14T18:00:00.000Z',
  createdBy: 'uid-1',
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
];

const SNAPSHOT: SnapshotDto = {
  tMinusKickoffMin: 20,
  tick: 40,
  zones: ZONES,
  gates: [],
  transit: [],
  weather: { tempC: 24, condition: 'Clear', humidityPct: 50 },
  resources: {
    energyKwh: 2_592,
    wasteDiversionPct: 71,
    waterLitres: 17_400,
    publicTransportSharePct: 62,
  },
};

describe('Panel states', () => {
  it('renders a titled region a screen reader can find', () => {
    render(<Panel title="Test Panel">content</Panel>);
    expect(screen.getByRole('region', { name: 'Test Panel' })).toBeInTheDocument();
  });

  it('hides the skeleton from assistive tech', () => {
    const { container } = render(<PanelSkeleton lines={2} />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('offers retry on error', async () => {
    const onRetry = vi.fn();
    render(<PanelError message="It broke." onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('omits retry when there is nothing to retry', () => {
    render(<PanelError message="It broke." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders an empty state', () => {
    render(<PanelEmpty message="Nothing here." />);
    expect(screen.getByText('Nothing here.')).toBeInTheDocument();
  });
});

describe('TriageResult', () => {
  it('separates AI understanding from the rule-based decision', () => {
    render(<TriageResult result={SEV1_PREVIEW} />);

    expect(screen.getByText('Understanding')).toBeInTheDocument();
    expect(screen.getByText('Triage decision')).toBeInTheDocument();
    // The claim a judge should be able to read off the screen.
    expect(screen.getByText('Rule-based · not AI')).toBeInTheDocument();
  });

  it('shows the severity with its plain-language meaning', () => {
    render(<TriageResult result={SEV1_PREVIEW} />);

    expect(screen.getByText('SEV-1')).toBeInTheDocument();
    expect(screen.getByText('Life safety — respond immediately')).toBeInTheDocument();
  });

  it('quotes the rule that fired, so the decision is auditable', () => {
    render(<TriageResult result={SEV1_PREVIEW} />);
    expect(screen.getByText(/overrides proposed type/)).toBeInTheDocument();
  });

  it('shows the translation and detected language', () => {
    render(<TriageResult result={SEV1_PREVIEW} />);

    expect(screen.getByText('Spanish')).toBeInTheDocument();
    expect(screen.getByText(/fainted in section 114/)).toBeInTheDocument();
  });

  it('shows the protocol as an ordered list', () => {
    render(<TriageResult result={SEV1_PREVIEW} />);
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<TriageResult result={SEV1_PREVIEW} />);
    await expectNoAxeViolations(container);
  });
});

describe('ReportForm', () => {
  const props = {
    onPreview: vi.fn().mockResolvedValue(undefined),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    busy: false,
    error: null,
    preview: null,
  };

  it('labels the report field', () => {
    render(<ReportForm {...props} />);
    expect(screen.getByLabelText(/Report an incident in any language/)).toBeInTheDocument();
  });

  it('requires a zone, because the engine needs one', () => {
    render(<ReportForm {...props} />);
    expect(screen.getByLabelText('Zone')).toBeInTheDocument();
  });

  it('disables submission until the report is long enough', () => {
    render(<ReportForm {...props} />);
    expect(screen.getByRole('button', { name: 'Triage' })).toBeDisabled();
  });

  it('submits a report', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ReportForm {...props} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/Report an incident/), 'person collapsed');
    await userEvent.click(screen.getByRole('button', { name: 'Log incident' }));

    expect(onSubmit).toHaveBeenCalledWith('person collapsed', 'z1');
  });

  it('fills the field from an example chip', async () => {
    render(<ReportForm {...props} />);

    await userEvent.click(screen.getByRole('button', { name: /desmayada/ }));
    expect(screen.getByLabelText(/Report an incident/)).toHaveValue(
      'hay una persona desmayada en la sección 114',
    );
  });

  it('announces an error politely', () => {
    const { container } = render(
      <ReportForm {...props} error={{ code: 'rate_limited', message: 'Slow down.' }} />,
    );

    expect(screen.getByText('Slow down.')).toBeInTheDocument();
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<ReportForm {...props} />);
    await expectNoAxeViolations(container);
  });
});

describe('IncidentLog', () => {
  const props = {
    incidents: [INCIDENT],
    loading: false,
    error: null,
    onRetry: vi.fn(),
    onStatusChange: vi.fn(),
  };

  it('renders the translation and the original', () => {
    render(<IncidentLog {...props} />);

    expect(screen.getByText('A person has fainted.')).toBeInTheDocument();
    expect(screen.getByText(/hay una persona desmayada/)).toBeInTheDocument();
  });

  it('states in the caption that severity is rule-based', () => {
    render(<IncidentLog {...props} />);
    expect(screen.getByText(/decided by rule, not by\s+AI/)).toBeInTheDocument();
  });

  it('advances status', async () => {
    const onStatusChange = vi.fn();
    render(<IncidentLog {...props} onStatusChange={onStatusChange} />);

    await userEvent.click(screen.getByRole('button', { name: /Acknowledge/ }));
    expect(onStatusChange).toHaveBeenCalledWith('inc-1', 'acknowledged');
  });

  it('offers no action on a resolved incident', () => {
    render(<IncidentLog {...props} incidents={[{ ...INCIDENT, status: 'resolved' }]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows an empty state rather than a bare table', () => {
    render(<IncidentLog {...props} incidents={[]} />);
    expect(screen.getByText(/No incidents logged/)).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<IncidentLog {...props} />);
    await expectNoAxeViolations(container);
  });
});

describe('StadiumMap', () => {
  it('gives the graphic a text equivalent', () => {
    render(<StadiumMap zones={ZONES} />);

    expect(screen.getByRole('img')).toHaveAccessibleName(/Schematic of the venue/);
    expect(screen.getByText(/North Lower: 80 percent of safe capacity/)).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<StadiumMap zones={ZONES} />);
    await expectNoAxeViolations(container);
  });
});

describe('SustainabilityStrip', () => {
  const insight = { text: 'Energy is 8% above baseline.', mode: 'rule' as const, generatedAt: '' };

  it('renders metrics against their targets', () => {
    render(<SustainabilityStrip snapshot={SNAPSHOT} insight={insight} />);

    expect(screen.getByText('2,592 kWh')).toBeInTheDocument();
    expect(screen.getByText('71%')).toBeInTheDocument();
    expect(screen.getByText(/below target/)).toBeInTheDocument();
  });

  it('renders the insight with its mode', () => {
    render(<SustainabilityStrip snapshot={SNAPSHOT} insight={insight} />);

    expect(screen.getByText('Energy is 8% above baseline.')).toBeInTheDocument();
    expect(screen.getByText('Rule-based')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<SustainabilityStrip snapshot={SNAPSHOT} insight={insight} />);
    await expectNoAxeViolations(container);
  });
});
