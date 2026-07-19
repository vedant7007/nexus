// Every entry carries a `label` and an `icon` alongside its colours, and
// consumers render all three. This is the accessibility guarantee: roughly 1 in
// 12 men has a colour vision deficiency, and a control room is where "the red
// one" must never be the only way to know something is wrong. Colour is the
// fastest signal, never the only one.
import type { RiskLevel, Severity } from '../engine/types';

/** How a risk level is presented. */
export interface StatusPresentation {
  /** Human-readable label. Always rendered — never replaced by colour alone. */
  label: string;
  /** Text glyph carrying the same meaning as the colour. */
  icon: string;
  /** Tailwind classes for text on a dark surface. */
  textClass: string;
  /** Tailwind classes for a filled badge. */
  badgeClass: string;
  /** Tailwind class for a solid bar or dot. */
  fillClass: string;
  /**
   * The raw status colour as a CSS value, for contexts that set a colour
   * directly rather than via a class — notably SVG `fill`, where a Tailwind
   * `bg-*` class does nothing.
   */
  color: string;
  /** Screen-reader phrasing, spelled out rather than abbreviated. */
  announcement: string;
}

const PRESENTATION: Record<RiskLevel, StatusPresentation> = {
  normal: {
    label: 'Normal',
    icon: '●',
    textClass: 'text-[var(--color-status-normal-text)]',
    badgeClass:
      'bg-[var(--color-status-normal-bg)] text-[var(--color-status-normal-text)] border-[var(--color-status-normal)]',
    fillClass: 'bg-[var(--color-status-normal)]',
    color: 'var(--color-status-normal)',
    announcement: 'Normal',
  },
  elevated: {
    label: 'Elevated',
    icon: '◐',
    textClass: 'text-[var(--color-status-elevated-text)]',
    badgeClass:
      'bg-[var(--color-status-elevated-bg)] text-[var(--color-status-elevated-text)] border-[var(--color-status-elevated)]',
    fillClass: 'bg-[var(--color-status-elevated)]',
    color: 'var(--color-status-elevated)',
    announcement: 'Elevated',
  },
  high: {
    label: 'High',
    icon: '▲',
    textClass: 'text-[var(--color-status-high-text)]',
    badgeClass:
      'bg-[var(--color-status-high-bg)] text-[var(--color-status-high-text)] border-[var(--color-status-high)]',
    fillClass: 'bg-[var(--color-status-high)]',
    color: 'var(--color-status-high)',
    announcement: 'High',
  },
  critical: {
    label: 'Critical',
    icon: '⬤',
    textClass: 'text-[var(--color-status-critical-text)]',
    badgeClass:
      'bg-[var(--color-status-critical-bg)] text-[var(--color-status-critical-text)] border-[var(--color-status-critical)]',
    fillClass: 'bg-[var(--color-status-critical)]',
    color: 'var(--color-status-critical)',
    announcement: 'Critical',
  },
};

/** Resolves how a risk level should be presented. */
export function statusOf(level: RiskLevel): StatusPresentation {
  return PRESENTATION[level];
}

/** How an incident severity is presented. */
export interface SeverityPresentation {
  label: string;
  /** What the severity means, in words, for an operator who does not know the codes. */
  meaning: string;
  badgeClass: string;
}

const SEVERITY_PRESENTATION: Record<Severity, SeverityPresentation> = {
  SEV1: {
    label: 'SEV-1',
    meaning: 'Life safety — respond immediately',
    badgeClass:
      'bg-[var(--color-status-critical-bg)] text-[var(--color-status-critical-text)] border-[var(--color-status-critical)]',
  },
  SEV2: {
    label: 'SEV-2',
    meaning: 'Urgent — respond promptly',
    badgeClass:
      'bg-[var(--color-status-elevated-bg)] text-[var(--color-status-elevated-text)] border-[var(--color-status-elevated)]',
  },
  SEV3: {
    label: 'SEV-3',
    meaning: 'Routine — resolve when able',
    badgeClass:
      'bg-[var(--color-status-normal-bg)] text-[var(--color-status-normal-text)] border-[var(--color-status-normal)]',
  },
};

/** Resolves how an incident severity should be presented. */
export function severityOf(severity: Severity): SeverityPresentation {
  return SEVERITY_PRESENTATION[severity];
}

// Maps a density percentage to the band used for tinting a zone. Mirrors the
// engine's bands rather than redefining them — the UI must never be a second,
// quietly divergent opinion about what counts as dangerous.
export { classifyDensity as densityBand } from '../engine/thresholds';
