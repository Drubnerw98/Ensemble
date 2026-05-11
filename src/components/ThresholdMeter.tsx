import { motion } from "framer-motion";

type Props = {
  readonly current: number;
  readonly needed: number;
  readonly justDecided?: boolean;
};

const MAX_PIPS = 7;

// Pip-dot meter replacing the `2 / 3` text counter on CandidateRow. Filled
// dots = votes received; hollow dots = votes still needed to cross. When
// justDecided is true (this client observed the voting->decided transition
// AND this row is the winner), the filled pips stagger-enter from scale 0
// to give the consensus moment a visible convergence beat before the
// row-pulse glow takes over.
export function ThresholdMeter({ current, needed, justDecided }: Props) {
  if (needed <= 0) return null;
  const filled = Math.min(current, needed);

  // High-N thresholds (first-to-15, first-to-20) would sprawl across the
  // row as pips. Fall back to text past the cap. Keeps the visual rhythm
  // of compact 1-7 pip rows intact for the common case.
  if (needed > MAX_PIPS) {
    return (
      <span
        className={`shrink-0 whitespace-nowrap font-display text-[10px] font-medium tracking-[0.2em] uppercase ${
          current >= needed ? "text-accent" : "text-text-muted"
        }`}
        aria-label={`${current} of ${needed} votes`}
      >
        {current} / {needed}
      </span>
    );
  }

  return (
    <div
      role="meter"
      aria-valuenow={current}
      aria-valuemax={needed}
      aria-label={`${current} of ${needed} votes`}
      className="flex shrink-0 items-center gap-1"
    >
      {Array.from({ length: needed }, (_, i) => {
        const isFilled = i < filled;
        return (
          <span
            key={i}
            className="relative inline-block h-1.5 w-1.5 rounded-full border border-border-strong"
          >
            {isFilled ? (
              <motion.span
                key={justDecided ? "decided" : "voting"}
                initial={
                  justDecided ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }
                }
                animate={{ scale: 1, opacity: 1 }}
                transition={
                  justDecided
                    ? {
                        delay: i * 0.08,
                        type: "spring",
                        stiffness: 600,
                        damping: 26,
                      }
                    : { duration: 0 }
                }
                className="absolute inset-[1px] rounded-full bg-accent"
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
