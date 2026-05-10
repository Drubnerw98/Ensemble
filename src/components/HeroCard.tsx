import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AvatarStack, Button, Card } from "./ui";
import type { UserInfo } from "../lib/types";

const SPIN_TICK_MS = 140;
const SPIN_TOTAL_MS = 1200;

export function HeroCard({
  winnerTitle,
  winnerPosterUrl = null,
  winnerType = null,
  winnerYear = null,
  voterIds,
  userInfoById,
  isHost,
  onReconsider,
  spinningTitles = [],
  animateOnMount = true,
}: {
  winnerTitle: string;
  winnerPosterUrl?: string | null;
  winnerType?: string | null;
  winnerYear?: number | null;
  voterIds: readonly string[];
  userInfoById: ReadonlyMap<string, UserInfo>;
  isHost: boolean;
  onReconsider: () => void;
  spinningTitles?: readonly string[];
  animateOnMount?: boolean;
}) {
  // Always spin on threshold-cross (single winner OR tied set), not just
  // on ties. Gives the consensus moment ~1.2s of "settling..." ceremony
  // even when the room is small and unanimous, which would otherwise
  // close out instantly. Late joiners (animateOnMount=false) still skip.
  const shouldSpin = animateOnMount && spinningTitles.length >= 1;
  const [tickIndex, setTickIndex] = useState(0);
  const [settled, setSettled] = useState(!shouldSpin);
  const heroRef = useRef<HTMLDivElement | null>(null);

  // Pull the hero into view on mount when this client just observed the
  // voting->decided transition. Otherwise the moment lands below the fold
  // for rooms with many candidates. Skipped for late joiners (animateOnMount
  // false) so navigation doesn't yank them around.
  useEffect(() => {
    if (!animateOnMount) return;
    heroRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [animateOnMount]);

  useEffect(() => {
    if (!shouldSpin) {
      // shouldSpin is false: no timer needed. settled was initialized from
      // !shouldSpin so it's already true on first render; the only case where
      // we'd need to correct it is a prop change making shouldSpin go false
      // after being true, but that can't happen (animateOnMount is a const
      // passed at mount and spinningTitles only grows). Rely on cleanup.
      return;
    }
    // shouldSpin is true: run the spin then settle.
    const tick = window.setInterval(() => {
      setTickIndex((i) => i + 1);
    }, SPIN_TICK_MS);
    const settle = window.setTimeout(() => {
      window.clearInterval(tick);
      setSettled(true);
    }, SPIN_TOTAL_MS);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(settle);
      // Reset for a future re-arm (e.g., if spinningTitles changes while
      // in-flight). setSettled is safe inside cleanup per the lint rule.
      setSettled(false);
    };
  }, [shouldSpin, spinningTitles]);

  const displayedTitle = settled
    ? winnerTitle
    : (spinningTitles[tickIndex % spinningTitles.length] ?? winnerTitle);

  // Skip Framer Motion enter animation for late joiners — the moment
  // already happened, mounting fresh shouldn't re-play it.
  const motionProps = animateOnMount
    ? {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { type: "spring" as const, stiffness: 220, damping: 24 },
      }
    : { initial: false as const };

  const metaLabel = formatMetaLabel(winnerType, winnerYear);

  return (
    <motion.div ref={heroRef} {...motionProps}>
      <Card className="border-accent/50 bg-gradient-to-b from-accent/[0.07] to-accent/[0.02] p-6 sm:p-8">
        <Card.Eyebrow>Tonight&apos;s pick</Card.Eyebrow>
        <Card.Body>
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 flex-1 items-start gap-4 sm:gap-5">
              {winnerPosterUrl ? (
                <img
                  src={winnerPosterUrl}
                  alt=""
                  className="h-40 w-28 shrink-0 rounded-md object-cover shadow-lg shadow-black/40 sm:h-52 sm:w-36"
                />
              ) : null}
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-light leading-tight tracking-tight text-text sm:text-4xl">
                  {displayedTitle}
                </h2>
                {metaLabel && settled ? (
                  <p className="mt-2 font-display text-[11px] font-medium tracking-[0.28em] text-text-muted uppercase">
                    {metaLabel}
                  </p>
                ) : null}
                {settled ? (
                  <div className="mt-5">
                    <AvatarStack
                      userIds={voterIds}
                      userInfoById={userInfoById}
                      size="md"
                      max={5}
                      showCount
                      highlight
                    />
                  </div>
                ) : null}
              </div>
            </div>
            {isHost && settled ? (
              <Button variant="secondary" size="sm" onClick={onReconsider}>
                Reconsider
              </Button>
            ) : null}
          </div>
        </Card.Body>
      </Card>
    </motion.div>
  );
}

function formatMetaLabel(
  type: string | null,
  year: number | null,
): string | null {
  const parts: string[] = [];
  if (type && type !== "unknown") parts.push(type);
  if (year !== null) parts.push(String(year));
  return parts.length > 0 ? parts.join(" · ") : null;
}
