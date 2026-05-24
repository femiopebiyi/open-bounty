"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Trophy, ChevronLeft, ChevronRight } from "lucide-react";

import { fetchLeaderboard } from "@/lib/api";
import { cn, formatUSD } from "@/lib/utils";
import type { LeaderboardEntry } from "@/types";

import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

const PAGE_SIZE = 10;

export default function LeaderboardPage() {
  const [page, setPage] = useState(0);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["leaderboard", page],
    queryFn: () =>
      fetchLeaderboard({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
  });

  const podium = entries.slice(0, 3);
  const restStart = page === 0 ? 3 : 0;
  const rest = entries.slice(restStart);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950">
          Leaderboard
        </h1>
        <p className="text-[13px] text-ink-500 mt-1">
          Top earners by total USD value claimed
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {page === 0 && (
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          )}
          <div className="border border-ink-200 rounded-xl overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="px-4 py-3 border-b border-ink-100 last:border-b-0 flex items-center gap-3"
              >
                <Skeleton className="w-6 h-4" />
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Trophy className="w-4 h-4" />}
          title="The leaderboard is empty"
          description="Win bounties to claim a spot at the top."
        />
      ) : (
        <>
          {/* Podium */}
          {page === 0 && podium.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-8">
              {/* Second */}
              {podium[1] && (
                <PodiumCard
                  entry={podium[1]}
                  rank={2}
                  className="self-end h-32"
                />
              )}
              {/* First — taller */}
              {podium[0] && (
                <PodiumCard entry={podium[0]} rank={1} className="h-40" />
              )}
              {/* Third */}
              {podium[2] && (
                <PodiumCard
                  entry={podium[2]}
                  rank={3}
                  className="self-end h-28"
                />
              )}
            </div>
          )}

          {/* List */}
          <div className="border border-ink-200 rounded-xl overflow-hidden bg-white">
            <div className="grid grid-cols-[3rem_1fr_8rem_8rem] sm:grid-cols-[3rem_1fr_10rem_10rem] gap-3 px-4 py-2.5 bg-ink-50/40 border-b border-ink-100 text-2xs uppercase tracking-[0.06em] text-ink-400 font-medium">
              <div className="text-center">#</div>
              <div>Hunter</div>
              <div className="text-right">Wins</div>
              <div className="text-right">Earned</div>
            </div>
            {rest.map((entry: LeaderboardEntry, i: number) => {
              const rank = page * PAGE_SIZE + (page === 0 ? restStart : 0) + i + 1;
              return (
                <Link
                  key={entry.github_username}
                  href={`/profile/${entry.github_username}`}
                  className="grid grid-cols-[3rem_1fr_8rem_8rem] sm:grid-cols-[3rem_1fr_10rem_10rem] gap-3 px-4 py-3 items-center hover:bg-ink-50 transition-colors border-b border-ink-100 last:border-b-0"
                >
                  <span
                    className={cn(
                      "text-[13px] tabular text-center font-medium",
                      rank <= 3 ? "text-ink-950" : "text-ink-400"
                    )}
                  >
                    {rank}
                  </span>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar username={entry.github_username} size="md" />
                    <span className="text-[13px] font-medium text-ink-900 truncate">
                      {entry.github_username}
                    </span>
                  </div>
                  <span className="text-right text-[13px] text-ink-700 tabular">
                    {entry.bounties_won}
                  </span>
                  <span className="text-right text-[13px] font-semibold text-ink-950 tabular">
                    {formatUSD(entry.total_earned)}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[13px] text-ink-600 border border-ink-200 rounded-lg hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>
            <span className="text-xs text-ink-400 tabular">
              Page {page + 1}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={entries.length < PAGE_SIZE}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[13px] text-ink-600 border border-ink-200 rounded-lg hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PodiumCard({
  entry,
  rank,
  className,
}: {
  entry: LeaderboardEntry;
  rank: number;
  className?: string;
}) {
  const rankBgClass: Record<number, string> = {
    1: "bg-amber-100 text-amber-700 border-amber-200",
    2: "bg-ink-100 text-ink-700 border-ink-200",
    3: "bg-orange-50 text-orange-700 border-orange-200",
  };

  return (
    <Link
      href={`/profile/${entry.github_username}`}
      className={cn(
        "relative flex flex-col items-center justify-end p-4 rounded-xl border border-ink-200 bg-white hover:border-ink-300 hover:shadow-card transition-all duration-150 text-center",
        className
      )}
    >
      <span
        className={cn(
          "absolute top-3 left-3 text-2xs font-bold w-5 h-5 rounded-full border flex items-center justify-center",
          rankBgClass[rank]
        )}
      >
        {rank}
      </span>
      <Avatar
        username={entry.github_username}
        size="lg"
        className="!w-11 !h-11 mb-2.5"
      />
      <p className="text-[13px] font-medium text-ink-900 truncate max-w-full">
        {entry.github_username}
      </p>
      <p className="text-2xs text-ink-500 mt-0.5 tabular">
        {formatUSD(entry.total_earned)}
      </p>
    </Link>
  );
}
