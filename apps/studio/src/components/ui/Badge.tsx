import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

export type BadgeTone = "green" | "yellow" | "gray" | "blue" | "purple" | "red";

const tones: Record<BadgeTone, string> = {
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  gray: "bg-slate-100 text-slate-600",
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
  red: "bg-red-100 text-red-700",
};

export function Badge({
  tone = "gray",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
