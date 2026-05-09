import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AvatarStack, Button, Card } from "./ui";

type UserInfo = { name?: string; avatarUrl?: string };

const SPIN_TICK_MS = 140;
const SPIN_TOTAL_MS = 1200;

export function HeroCard({
  winnerTitle,
  voterIds,
  userInfoById,
  isHost,
  onReconsider,
  spinningTitles = [],
  animateOnMount = true,
}: {
  winnerTitle: string;
  voterIds: readonly string[];
  userInfoById: ReadonlyMap<string, UserInfo>;
  isHost: boolean;
  onReconsider: () => void;
  spinningTitles?: readonly string[];
  animateOnMount?: boolean;
}) {
  const shouldSpin = animateOnMount && spinningTitles.length > 1;
  const [tickIndex, setTickIndex] = useState(0);
  const [settled, setSettled] = useState(!shouldSpin);

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

  return (
    <motion.div {...motionProps}>
      <Card className="border-accent/40 bg-accent/[0.04]">
        <Card.Eyebrow>Tonight&apos;s pick</Card.Eyebrow>
        <Card.Body>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-light tracking-tight text-text">
                {displayedTitle}
              </h2>
              {settled ? (
                <div className="mt-3">
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
