import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

type ButtonProps = {
  variant?: Variant;
  size?: Size;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const BASE =
  "inline-flex items-center justify-center rounded-md font-medium cursor-pointer transition duration-150 active:scale-[0.98] disabled:cursor-default disabled:opacity-30 disabled:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-bg hover:bg-accent/90",
  secondary:
    "border border-border bg-transparent text-text hover:bg-surface hover:border-border-strong",
  ghost: "text-text-muted hover:text-warn",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs min-h-11 sm:min-h-0",
  md: "px-4 py-2 text-sm min-h-11 sm:min-h-0",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const merged = `${BASE} ${VARIANTS[variant]} ${SIZES[size]}${
    className ? ` ${className}` : ""
  }`;
  return <button type={type} className={merged} {...rest} />;
}
