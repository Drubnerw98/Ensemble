import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";

type CardProps = {
  children: ReactNode;
  className?: string;
};

function CardRoot({ children, className }: CardProps) {
  const merged = `rounded-lg border border-border bg-surface p-5${
    className ? ` ${className}` : ""
  }`;
  return <div className={merged}>{children}</div>;
}

function CardEyebrow({
  count,
  children,
}: {
  count?: number;
  children: ReactNode;
}) {
  return <Eyebrow count={count}>{children}</Eyebrow>;
}

function CardBody({ children }: { children: ReactNode }) {
  return <div className="mt-3">{children}</div>;
}

export const Card = Object.assign(CardRoot, {
  Eyebrow: CardEyebrow,
  Body: CardBody,
});
