'use client';

// Every field in the app goes through here, so the label/control association,
// the hint wiring, and the error announcement cannot be forgotten on one form
// and remembered on another.
import { useId } from 'react';

interface FieldShellProps {
  label: string;
  hint?: string;
  children: (ids: { controlId: string; describedBy: string | undefined }) => React.ReactNode;
}

/** A label, an optional hint, and a control wired to both. */
function FieldShell({ label, hint, children }: FieldShellProps) {
  const controlId = useId();
  const hintId = useId();

  return (
    <div>
      <label htmlFor={controlId} className="block text-sm font-medium text-[var(--color-ink)]">
        {label}
      </label>
      {hint === undefined ? null : (
        <p id={hintId} className="mt-1 text-xs text-[var(--color-ink-dim)]">
          {hint}
        </p>
      )}
      {children({ controlId, describedBy: hint === undefined ? undefined : hintId })}
    </div>
  );
}

const CONTROL_CLASS =
  'mt-1.5 w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2.5 text-sm text-[var(--color-ink)]';

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password';
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}

/** A single-line text input. */
export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  required,
  hint,
}: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint}>
      {({ controlId, describedBy }) => (
        <input
          id={controlId}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required={required}
          aria-describedby={describedBy}
          className={CONTROL_CLASS}
        />
      )}
    </FieldShell>
  );
}

export interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
}

/** A multi-line text input with a live character count. */
export function TextAreaField({
  label,
  value,
  onChange,
  hint,
  rows = 3,
  maxLength,
  placeholder,
  required,
}: TextAreaFieldProps) {
  return (
    <FieldShell label={label} hint={hint}>
      {({ controlId, describedBy }) => (
        <>
          <textarea
            id={controlId}
            value={value}
            onChange={(event) =>
              onChange(
                maxLength === undefined
                  ? event.target.value
                  : event.target.value.slice(0, maxLength),
              )
            }
            rows={rows}
            required={required}
            placeholder={placeholder}
            aria-describedby={describedBy}
            className={CONTROL_CLASS}
          />
          {maxLength === undefined ? null : (
            <p className="mt-1 text-right text-[0.6875rem] text-[var(--color-ink-dim)]">
              <span className="tnum">{value.length}</span> / {maxLength}
            </p>
          )}
        </>
      )}
    </FieldShell>
  );
}

export interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}

/**
 * A native select.
 *
 * Native rather than Radix: it is a plain single-choice list with no custom
 * presentation, and the platform control is already keyboard-operable,
 * screen-reader-correct, and free.
 */
export function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  return (
    <FieldShell label={label}>
      {({ controlId }) => (
        <select
          id={controlId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={CONTROL_CLASS}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

export interface FormErrorProps {
  message: string | null;
}

/**
 * A form error, announced politely.
 *
 * The live region wraps the conditional rather than sitting inside it: a region
 * that only mounts when an error appears is not announced at all, because there
 * was nothing there to change.
 */
export function FormError({ message }: FormErrorProps) {
  return (
    <div aria-live="polite">
      {message === null ? null : (
        <p className="rounded-lg border border-[var(--color-status-critical)] bg-[var(--color-status-critical-bg)] px-3 py-2 text-sm text-[var(--color-status-critical-text)]">
          {message}
        </p>
      )}
    </div>
  );
}
