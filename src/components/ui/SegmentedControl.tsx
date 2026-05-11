import { useId } from "react";
import { motion } from "framer-motion";

type Option<T extends string> = {
  readonly value: T;
  readonly label: string;
};

type Props<T extends string> = {
  readonly options: readonly Option<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled,
}: Props<T>) {
  // Unique layoutId per instance so multiple segmented controls on the
  // same screen do not share the active-pill animation.
  const layoutId = useId();

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className="relative inline-flex rounded-md border border-border bg-bg/40 p-0.5"
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const idx = options.findIndex((o) => o.value === value);
              const dir = e.key === "ArrowRight" ? 1 : -1;
              const next = options[(idx + dir + options.length) % options.length];
              onChange(next.value);
            }}
            className={[
              "relative z-10 min-h-11 cursor-pointer rounded-[5px] px-3 text-xs font-medium tracking-wide transition-colors sm:min-h-0 sm:py-1.5",
              "disabled:cursor-not-allowed disabled:opacity-40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
              selected ? "text-bg" : "text-text-muted hover:text-text",
            ].join(" ")}
          >
            {selected ? (
              <motion.span
                layoutId={`segmented-active-${layoutId}`}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 -z-10 rounded-[5px] bg-accent"
              />
            ) : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
