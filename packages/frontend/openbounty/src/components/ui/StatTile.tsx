import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

interface StatTileProps {
  label: string;
  value: string | number | ReactNode;
  trend?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function StatTile({
  label,
  value,
  trend,
  className,
  size = "md",
}: StatTileProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p className="text-2xs uppercase tracking-[0.06em] text-ink-400 font-medium">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-semibold text-ink-950 tabular tracking-tight",
            size === "sm" && "text-lg",
            size === "md" && "text-2xl",
            size === "lg" && "text-3xl"
          )}
        >
          {value}
        </span>
        {trend && (
          <span className="text-xs text-emerald-600 font-medium">{trend}</span>
        )}
      </div>
    </div>
  );
}
