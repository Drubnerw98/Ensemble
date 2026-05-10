import type { WhyChip } from "../lib/whyForRoom";
import type { UserInfo } from "../lib/types";

type Props = {
  chips: readonly WhyChip[];
  userInfoById: ReadonlyMap<string, UserInfo>;
};

// Cross-attribution row: which OTHER members' profiles also describe
// this candidate. Theme = filled background, archetype = outlined, so
// the rarer archetype signal reads as "someone's deeper pattern" not
// just "another tag." Empty-state is intentionally zero-chrome:
// quiet absence is better than a "no matches" hint.
//
// Mobile: stacks. Desktop: horizontal scroll if overflows. The row
// itself uses `flex-wrap` so short lists settle naturally without a
// scroll affordance.
export function RoomFitChips({ chips, userInfoById }: Props) {
  if (chips.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 overflow-x-auto sm:gap-1"
      role="list"
      aria-label="Also matches in this room"
    >
      {chips.map((chip) => {
        const info = userInfoById.get(chip.userId);
        const memberName = info?.name ?? "A member";
        const ariaLabel = `${memberName}'s ${chip.matchedLabel} ${chip.kind}`;
        const baseClass =
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] leading-none";
        // Theme: filled with the social accent at low alpha, ring on.
        // Archetype: outline-only, dimmer text. Distinct enough to be
        // pre-attentive without shouting.
        const variantClass =
          chip.kind === "theme"
            ? "bg-accent/10 text-text ring-1 ring-accent/30"
            : "bg-transparent text-text-muted ring-1 ring-border";
        return (
          <span
            key={`${chip.userId}-${chip.kind}-${chip.matchedLabel}`}
            role="listitem"
            title={ariaLabel}
            aria-label={ariaLabel}
            className={`${baseClass} ${variantClass}`}
          >
            {info?.avatarUrl ? (
              <img
                src={info.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-3.5 w-3.5 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="inline-block h-3.5 w-3.5 shrink-0 rounded-full bg-white/10"
              />
            )}
            <span className="font-mono text-[10px] tracking-wide">
              {chip.matchedLabel}
            </span>
          </span>
        );
      })}
    </div>
  );
}
