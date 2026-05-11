type Props = {
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  readonly onChange: (next: number) => void;
  readonly ariaLabel: string;
  readonly disabled?: boolean;
};

export function Stepper({
  value,
  min = 1,
  max = 99,
  onChange,
  ariaLabel,
  disabled,
}: Props) {
  const clamped = Math.min(Math.max(value, min), max);
  const atMin = clamped <= min;
  const atMax = clamped >= max;

  const step = (delta: number) => {
    if (disabled) return;
    const next = Math.min(Math.max(clamped + delta, min), max);
    if (next !== clamped) onChange(next);
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-stretch overflow-hidden rounded-md border border-border bg-bg/40"
    >
      <StepperButton
        label={`Decrease ${ariaLabel}`}
        sign="−"
        disabled={disabled || atMin}
        onClick={() => step(-1)}
      />
      <span
        aria-live="polite"
        aria-atomic="true"
        className="flex min-w-10 items-center justify-center border-x border-border px-3 font-mono text-sm tabular-nums text-text"
      >
        {clamped}
      </span>
      <StepperButton
        label={`Increase ${ariaLabel}`}
        sign="+"
        disabled={disabled || atMax}
        onClick={() => step(1)}
      />
    </div>
  );
}

function StepperButton({
  label,
  sign,
  disabled,
  onClick,
}: {
  label: string;
  sign: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex min-h-11 w-9 cursor-pointer items-center justify-center text-sm text-text-muted transition-colors sm:min-h-0 sm:py-1.5",
        "hover:bg-surface hover:text-text",
        "active:bg-surface/80",
        "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
      ].join(" ")}
    >
      {sign}
    </button>
  );
}
