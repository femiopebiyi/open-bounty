import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        "border border-dashed border-ink-200 rounded-xl bg-ink-50/40",
        className
      )}
    >
      {icon && (
        <div className="w-10 h-10 bg-white border border-ink-200 rounded-lg flex items-center justify-center mb-4 text-ink-400">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-ink-900">{title}</h3>
      {description && (
        <p className="text-[13px] text-ink-500 mt-1 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
