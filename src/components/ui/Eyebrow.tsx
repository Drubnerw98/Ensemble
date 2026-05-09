type EyebrowProps = {
  count?: number;
  children: React.ReactNode;
};

export function Eyebrow({ count, children }: EyebrowProps) {
  return (
    <p className="font-display text-[11px] tracking-[0.22em] text-text-muted uppercase">
      {children}
      {count !== undefined && ` · ${count}`}
    </p>
  );
}
