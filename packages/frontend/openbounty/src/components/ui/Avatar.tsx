"use client";

import { cn, gravatarFor } from "@/lib/utils";

interface AvatarProps {
  username: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  ring?: boolean;
}

const sizes = {
  xs: "w-4 h-4",
  sm: "w-5 h-5",
  md: "w-6 h-6",
  lg: "w-9 h-9",
  xl: "w-14 h-14",
};

export function Avatar({ username, size = "md", className, ring }: AvatarProps) {
  return (
    <img
      src={gravatarFor(username)}
      alt={username}
      className={cn(
        "rounded-full bg-ink-100 object-cover shrink-0",
        sizes[size],
        ring && "ring-2 ring-white",
        className
      )}
      loading="lazy"
    />
  );
}

interface AvatarStackProps {
  usernames: string[];
  max?: number;
  size?: "xs" | "sm" | "md";
}

export function AvatarStack({ usernames, max = 4, size = "sm" }: AvatarStackProps) {
  const visible = usernames.slice(0, max);
  const overflow = usernames.length - visible.length;

  return (
    <div className="flex -space-x-1.5">
      {visible.map((u) => (
        <Avatar key={u} username={u} size={size} ring />
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            "rounded-full bg-ink-100 border-2 border-white flex items-center justify-center text-2xs font-medium text-ink-500",
            sizes[size]
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
