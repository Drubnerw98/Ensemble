type Props = {
  readonly name?: string;
  readonly avatarUrl?: string;
  readonly isYou?: boolean;
  readonly isHost?: boolean;
  readonly ready?: boolean;
};

// "In the room" presence chip. Ready state surfaces as a saffron ring
// around the avatar rather than a separate dot — pre-attentively reads
// as "this person is glowing because they're done." Host gets a quiet
// eyebrow-style badge so the role is visible without shouting.
export function MemberChip({ name, avatarUrl, isYou, isHost, ready }: Props) {
  const displayName = name ?? "Anonymous";
  const hoverTitle = [
    displayName,
    isYou ? "(you)" : null,
    isHost ? "· host" : null,
    ready ? "· ready" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li
      title={hoverTitle}
      className="flex items-center gap-2 rounded-full border border-border bg-bg/40 py-1 pr-3 pl-1 text-xs text-text transition-colors hover:border-border-strong"
    >
      <span
        className={[
          "relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition",
          ready ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : "",
        ].join(" ")}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span className="h-full w-full rounded-full bg-white/10" />
        )}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span>{displayName}</span>
        {isYou ? <span className="text-text-muted">(you)</span> : null}
        {isHost ? (
          <span className="font-display text-[9px] font-medium tracking-[0.22em] text-accent uppercase">
            host
          </span>
        ) : null}
      </span>
    </li>
  );
}
