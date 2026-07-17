import { describe, expect, it } from 'vitest';

import type { RiskLevel, Severity } from '@/lib/engine/types';
import { SIM_POLL_MS, BRIEFING_REFRESH_MS, RECOMMENDATIONS_REFRESH_MS } from '@/lib/ui/constants';
import { densityBand, severityOf, statusOf } from '@/lib/ui/status';

const LEVELS: readonly RiskLevel[] = ['normal', 'elevated', 'high', 'critical'];
const SEVERITIES: readonly Severity[] = ['SEV1', 'SEV2', 'SEV3'];

describe('statusOf', () => {
  /** The accessibility guarantee, asserted rather than assumed. */
  it('gives every level a text label, so colour is never the only signal', () => {
    for (const level of LEVELS) {
      expect(statusOf(level).label.length).toBeGreaterThan(0);
      expect(statusOf(level).announcement.length).toBeGreaterThan(0);
    }
  });

  it('gives every level a non-colour icon', () => {
    for (const level of LEVELS) {
      expect(statusOf(level).icon.length).toBeGreaterThan(0);
    }
  });

  it('gives every level a distinct label', () => {
    const labels = LEVELS.map((level) => statusOf(level).label);
    expect(new Set(labels).size).toBe(LEVELS.length);
  });

  it('gives every level a distinct fill, so bands are visually separable', () => {
    const fills = LEVELS.map((level) => statusOf(level).fillClass);
    expect(new Set(fills).size).toBe(LEVELS.length);
  });
});

describe('severityOf', () => {
  it('explains every severity in words, not just a code', () => {
    for (const severity of SEVERITIES) {
      expect(severityOf(severity).label).toMatch(/SEV-\d/);
      // An operator who does not know the codes still has to understand it.
      expect(severityOf(severity).meaning.length).toBeGreaterThan(10);
    }
  });

  it('marks SEV-1 as life safety', () => {
    expect(severityOf('SEV1').meaning).toMatch(/life safety/i);
  });
});

describe('densityBand', () => {
  it('is the engine’s classifier, not a second opinion', () => {
    // Re-exported rather than reimplemented: the UI must never quietly disagree
    // with the engine about what counts as dangerous.
    expect(densityBand(50)).toBe('normal');
    expect(densityBand(75)).toBe('elevated');
    expect(densityBand(90)).toBe('high');
    expect(densityBand(97)).toBe('critical');
  });
});

describe('polling constants', () => {
  it('refreshes AI panels far slower than the snapshot, to protect the budget', () => {
    expect(BRIEFING_REFRESH_MS).toBeGreaterThan(SIM_POLL_MS * 3);
    expect(RECOMMENDATIONS_REFRESH_MS).toBeGreaterThan(SIM_POLL_MS * 3);
  });

  it('offsets the two AI cadences so they do not fire together', () => {
    expect(BRIEFING_REFRESH_MS).not.toBe(RECOMMENDATIONS_REFRESH_MS);
  });
});
