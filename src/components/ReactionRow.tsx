import type { ReactionKind } from "../lib/liveblocks";

export type ReactionState = {
  thumbsUp: { count: number; selfReacted: boolean };
  heart: { count: number; selfReacted: boolean };
  thinking: { count: number; selfReacted: boolean };
  yikes: { count: number; selfReacted: boolean };
};

const REACTION_ORDER: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "thumbsUp", emoji: "👍", label: "thumbs-up" },
  { kind: "heart", emoji: "❤️", label: "heart" },
  { kind: "thinking", emoji: "🤔", label: "thinking" },
  { kind: "yikes", emoji: "😬", label: "yikes" },
];

export function ReactionRow({
  state,
  disabled,
  onToggle,
}: {
  state: ReactionState;
  disabled?: boolean;
  onToggle: (kind: ReactionKind) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 items-center sm:gap-1">
      {REACTION_ORDER.map(({ kind, emoji, label }) => {
        const { count, selfReacted } = state[kind];
        const ariaLabel = `${label} reaction${count > 0 ? `, count ${count}` : ""}`;
        return (
          <button
            key={kind}
            type="button"
            aria-label={ariaLabel}
            aria-pressed={selfReacted}
            disabled={disabled}
            onClick={() => onToggle(kind)}
            className={[
              "flex h-8 items-center gap-1 rounded-full px-2.5 text-xs ring-1 transition-colors sm:h-7 sm:px-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              selfReacted
                ? "bg-accent/15 ring-accent/40"
                : "bg-bg/40 ring-border",
            ].join(" ")}
          >
            <span>{emoji}</span>
            {count > 0 ? (
              <span className="font-mono text-[10px] text-text-muted">{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
