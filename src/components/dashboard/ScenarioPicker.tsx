'use client';

// The control the whole demo turns on, so it is a Radix Select rather than a
// styled div: full keyboard operation, correct roles, focus management, and
// typeahead come from the primitive instead of being reimplemented badly.
import * as Select from '@radix-ui/react-select';

import { SCENARIO_IDS, type ScenarioId, getScenario } from '@/lib/sim/scenarios';

export interface ScenarioPickerProps {
  value: ScenarioId;
  onChange: (value: ScenarioId) => void;
}

/**
 * Narrows the Radix string callback back to a ScenarioId.
 *
 * Radix hands back `string`, and the honest way to get a ScenarioId out of it is
 * to check — not to assert with `as` and hope the option list never drifts.
 */
function toScenarioId(value: string): ScenarioId | null {
  return SCENARIO_IDS.find((id) => id === value) ?? null;
}

/** A keyboard-operable scenario selector. */
export function ScenarioPicker({ value, onChange }: ScenarioPickerProps) {
  const handleChange = (next: string): void => {
    const id = toScenarioId(next);
    if (id !== null) onChange(id);
  };

  return (
    <div className="flex items-center gap-2.5">
      <label
        htmlFor="scenario-picker"
        className="text-xs font-medium text-[var(--color-ink-muted)]"
      >
        Scenario
      </label>
      <Select.Root value={value} onValueChange={handleChange}>
        <Select.Trigger
          id="scenario-picker"
          className="inline-flex min-w-[11rem] items-center justify-between gap-2 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-surface-overlay)]"
          aria-label="Select operational scenario"
        >
          <Select.Value />
          <Select.Icon aria-hidden="true">▾</Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={6}
            className="z-50 overflow-hidden rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] shadow-2xl"
          >
            <Select.Viewport className="p-1.5">
              {SCENARIO_IDS.map((id) => {
                const scenario = getScenario(id);
                return (
                  <Select.Item
                    key={id}
                    value={id}
                    className="cursor-pointer select-none rounded-md px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none data-[highlighted]:bg-[var(--color-accent-dim)] data-[highlighted]:text-[var(--color-accent-strong)]"
                  >
                    <Select.ItemText>{scenario.name}</Select.ItemText>
                    <span className="mt-0.5 block max-w-[18rem] text-xs text-[var(--color-ink-dim)]">
                      {scenario.description}
                    </span>
                  </Select.Item>
                );
              })}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
