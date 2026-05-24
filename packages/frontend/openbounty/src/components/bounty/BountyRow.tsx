"use client";

import Link from "next/link";
import { ArrowUpRight, Clock, Users } from "lucide-react";
import type { Bounty } from "@/types";
import { LANGUAGE_COLORS } from "@/lib/constants";
import {
  cn,
  formatTimeRemaining,
  formatAmount,
  effectiveStatus,
  extractRepoInfo,
} from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/bounty/StatusBadge";

interface BountyRowProps {
  bounty: Bounty;
}

export function BountyRow({ bounty }: BountyRowProps) {
  const status = effectiveStatus(bounty);
  const repo = extractRepoInfo(bounty.github_issue_url);
  const amount = formatAmount(bounty.amount_in_sol, bounty.token_mint);

  return (
    <Link
      href={`/bounties/${bounty.bounty_id}`}
      className="group relative block border-b border-ink-100 last:border-b-0 hover:bg-ink-50/60 transition-colors duration-150"
    >
      <div className="px-4 sm:px-5 py-4">
        <div className="flex items-start gap-4">
          {/* Main */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              {repo && (
                <span className="text-xs font-mono text-ink-500 truncate">
                  {repo.full_name}
                </span>
              )}
              {repo?.number && (
                <>
                  <span className="text-ink-300">·</span>
                  <span className="text-xs text-ink-400">#{repo.number}</span>
                </>
              )}
            </div>

            <h3 className="text-[14px] font-medium text-ink-950 leading-snug line-clamp-1 group-hover:text-ink-700 transition-colors">
              {bounty.issue_title || bounty.github_issue_url}
            </h3>

            <div className="flex items-center gap-3 mt-2.5">
              {/* Author */}
              <div className="flex items-center gap-1.5">
                <Avatar username={bounty.github_username} size="xs" />
                <span className="text-xs text-ink-500">
                  {bounty.github_username}
                </span>
              </div>

              <span className="text-ink-200">·</span>

              {/* Time */}
              <div className="flex items-center gap-1 text-xs text-ink-500">
                <Clock className="w-3 h-3" />
                {formatTimeRemaining(bounty.expiry_date)}
              </div>

              {/* Hunters */}
              {bounty.hunter_limit !== undefined && (
                <>
                  <span className="text-ink-200 hidden sm:inline">·</span>
                  <div className="hidden sm:flex items-center gap-1 text-xs text-ink-500">
                    <Users className="w-3 h-3" />
                    {bounty.hunter_count ?? 0}/{bounty.hunter_limit}
                  </div>
                </>
              )}

              {/* Languages */}
              {bounty.languages && bounty.languages.length > 0 && (
                <>
                  <span className="text-ink-200 hidden md:inline">·</span>
                  <div className="hidden md:flex items-center gap-1.5">
                    {bounty.languages.slice(0, 3).map((lang) => (
                      <span
                        key={lang}
                        className="inline-flex items-center gap-1 text-2xs text-ink-500"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: LANGUAGE_COLORS[lang] }}
                        />
                        {lang}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right cluster */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex items-baseline gap-1 tabular">
              <span className="text-[15px] font-semibold text-ink-950">
                {amount.symbol === "USD" ? "$" : ""}
                {amount.value}
              </span>
              <span className="text-2xs text-ink-400">
                {amount.symbol === "USD" ? "SOL" : amount.symbol}
              </span>
            </div>
            <StatusBadge status={status} size="xs" />
          </div>

          <ArrowUpRight className="w-3.5 h-3.5 text-ink-300 opacity-0 group-hover:opacity-100 group-hover:text-ink-500 transition-all duration-150 mt-0.5" />
        </div>
      </div>
    </Link>
  );
}

export function BountyRowSkeleton() {
  return (
    <div className="border-b border-ink-100 last:border-b-0 px-4 sm:px-5 py-4">
      <div className="flex items-start gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-3 w-32 skeleton rounded" />
          <div className="h-4 w-3/4 skeleton rounded" />
          <div className="flex gap-3 items-center">
            <div className="h-3 w-16 skeleton rounded" />
            <div className="h-3 w-20 skeleton rounded" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="h-5 w-16 skeleton rounded" />
          <div className="h-4 w-14 skeleton rounded-full" />
        </div>
      </div>
    </div>
  );
}
