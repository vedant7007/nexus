// Renders a risk level with colour, icon, and words — always all three, so the
// state is never conveyed by colour alone.
import type { RiskLevel } from '@/lib/engine/types';
import { statusOf } from '@/lib/ui/status';

export interface StatusPillProps {
  level: RiskLevel;
  /** Larger treatment for the dashboard's hero status. */
  size?: 'sm' | 'lg';
  /** Optional prefix, e.g. "Overall". */
  prefix?: string;
}

const SIZE_CLASS: Record<'sm' | 'lg', string> = {
  sm: 'px-2.5 py-1 text-xs gap-1.5',
  lg: 'px-4 py-2 text-base gap-2.5',
};

/**
 * A pill showing a risk level.
 *
 * The icon is `aria-hidden` because the adjacent text already carries the
 * meaning — announcing "black circle Critical" would be noise. Sighted users
 * get a redundant non-colour cue; screen reader users get the word.
 */
export function StatusPill({ level, size = 'sm', prefix }: StatusPillProps) {
  const status = statusOf(level);
  // The hero pill breathes at critical — a restrained, non-colour cue that
  // something needs attention now. Only at the large size, so the many small
  // pills in cards and tables never flicker. Suppressed under reduced-motion.
  const pulse = level === 'critical' && size === 'lg' ? 'pulse-critical' : '';

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold tracking-wide ${status.badgeClass} ${SIZE_CLASS[size]} ${pulse}`}
    >
      <span aria-hidden="true">{status.icon}</span>
      <span>
        {prefix === undefined ? '' : `${prefix} `}
        {status.label}
      </span>
    </span>
  );
}
