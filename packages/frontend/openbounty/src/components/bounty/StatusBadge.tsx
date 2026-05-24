import { cn } from "@/lib/utils";
import type { BountyStatus } from "@/types";

const config: Record<
  BountyStatus,
  { label: string; className: string; dot: string }
> = {
  open: {
    label: "Open",
    className: "bg-emerald-50 text-emerald-800 border-emerald-100",
    dot: "bg-emerald-500",
  },
  winner_selected: {
    label: "Awarded",
    className: "bg-amber-50 text-amber-800 border-amber-100",
    dot: "bg-amber-500",
  },
  claimed: {
    label: "Claimed",
    className: "bg-ink-100 text-ink-600 border-ink-200",
    dot: "bg-ink-400",
  },
  expired: {
    label: "Expired",
    className: "bg-ink-50 text-ink-500 border-ink-200",
    dot: "bg-ink-300",
  },
};

interface StatusBadgeProps {
  status: BountyStatus;
  className?: string;
  size?: "xs" | "sm";
}

export function StatusBadge({ status, className, size = "sm" }: StatusBadgeProps) {
  const c = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border rounded-full font-medium",
        size === "xs" ? "px-2 py-0.5 text-2xs" : "px-2.5 py-0.5 text-xs",
        c.className,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}
