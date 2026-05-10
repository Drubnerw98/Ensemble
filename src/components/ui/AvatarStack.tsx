import { AnimatePresence, motion } from "framer-motion";

type UserInfo = { name?: string; avatarUrl?: string };
type Size = "sm" | "md";

type AvatarStackProps = {
  userIds: readonly string[];
  userInfoById: ReadonlyMap<string, UserInfo>;
  max?: number;
  size?: Size;
  showCount?: boolean;
  highlight?: boolean;
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-5 w-5",
  md: "h-7 w-7",
};

const SIZE_OFFSET: Record<Size, string> = {
  sm: "-ml-1.5",
  md: "-ml-2.5",
};

const HERO_SPRING = {
  type: "spring",
  stiffness: 320,
  damping: 18,
} as const;

export function AvatarStack({
  userIds,
  userInfoById,
  max = 3,
  size = "sm",
  showCount = false,
  highlight = false,
}: AvatarStackProps) {
  if (userIds.length === 0) return null;

  const visible = userIds.slice(0, max);
  const sizeClass = SIZE_CLASS[size];
  const offsetClass = SIZE_OFFSET[size];

  const wrapperRing = highlight
    ? "ring-2 ring-accent/50 ring-offset-2 ring-offset-bg rounded-md"
    : "";

  return (
    <div className={`flex items-center gap-2 ${wrapperRing}`}>
      <div className="flex">
        <AnimatePresence initial={false}>
          {visible.map((id, i) => {
            const info = userInfoById.get(id);
            const offset = i > 0 ? offsetClass : "";
            const baseClass = `${sizeClass} shrink-0 rounded-full border border-bg object-cover ${offset}`;
            return (
              <motion.span
                key={id}
                layout
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={HERO_SPRING}
                className="inline-flex"
              >
                {info?.avatarUrl ? (
                  <img
                    src={info.avatarUrl}
                    alt=""
                    title={info.name ?? "Member"}
                    referrerPolicy="no-referrer"
                    className={baseClass}
                  />
                ) : (
                  <span
                    title={info?.name ?? "Member"}
                    className={`${baseClass} bg-white/10`}
                  />
                )}
              </motion.span>
            );
          })}
        </AnimatePresence>
      </div>
      {showCount && (
        <span className="text-xs text-text-muted">{userIds.length}</span>
      )}
    </div>
  );
}
