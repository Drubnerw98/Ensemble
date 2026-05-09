import { motion } from "framer-motion";
import { AvatarStack, Button, Card } from "./ui";

type UserInfo = { name?: string; avatarUrl?: string };

export function HeroCard({
  winnerTitle,
  voterIds,
  userInfoById,
  isHost,
  onReconsider,
}: {
  winnerTitle: string;
  voterIds: readonly string[];
  userInfoById: ReadonlyMap<string, UserInfo>;
  isHost: boolean;
  onReconsider: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
    >
      <Card className="border-accent/40 bg-accent/[0.04]">
        <Card.Eyebrow>Tonight&apos;s pick</Card.Eyebrow>
        <Card.Body>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-light tracking-tight text-text">
                {winnerTitle}
              </h2>
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
            </div>
            {isHost ? (
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
