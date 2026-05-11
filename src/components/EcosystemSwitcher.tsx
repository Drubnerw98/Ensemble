import { ECOSYSTEM, type EcosystemApp } from "../lib/ecosystem";

interface Props {
  current: EcosystemApp;
  accentClassName?: string;
  size?: "sm" | "md";
}

/**
 * Named chip trio identifying the three sibling apps and marking the
 * current one. Shared chrome pattern across Resonance, Constellation, and
 * Ensemble. Per-app accent color keeps each app's identity while the
 * structure unifies the family.
 */
export function EcosystemSwitcher({
  current,
  accentClassName = "text-accent",
  size = "sm",
}: Props) {
  const textSize = size === "sm" ? "text-[10px]" : "text-[11px]";
  return (
    <nav
      aria-label="Sibling apps"
      className={`flex items-center gap-1.5 font-mono ${textSize} tracking-[0.22em] uppercase`}
    >
      {ECOSYSTEM.map((entry, i) => {
        const isCurrent = entry.key === current;
        return (
          <span key={entry.key} className="flex items-center gap-1.5">
            {i > 0 && (
              <span aria-hidden className="text-border">
                ·
              </span>
            )}
            {isCurrent ? (
              <span aria-current="page" className={accentClassName}>
                {entry.name}
              </span>
            ) : (
              <a
                href={entry.url}
                className="text-text-muted transition-colors hover:text-text"
              >
                {entry.name}
              </a>
            )}
          </span>
        );
      })}
    </nav>
  );
}
