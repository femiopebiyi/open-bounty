"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Trophy,
  Target,
  ExternalLink,
  ArrowLeft,
  Plus,
} from "lucide-react";

import {
  fetchBountiesByPoster,
  fetchBounties,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { cn, formatUSD } from "@/lib/utils";
import type { Bounty } from "@/types";

import { BountyRow, BountyRowSkeleton } from "@/components/bounty/BountyRow";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatTile } from "@/components/ui/StatTile";

type Tab = "posted" | "hunting";

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { github_username } = useAuthStore();
  const [tab, setTab] = useState<Tab>("posted");
  const isOwnProfile = github_username === username;

  const { data: postedBounties = [], isLoading: loadingPosted } = useQuery({
    queryKey: ["bounties", "poster", username],
    queryFn: () => fetchBountiesByPoster(username),
  });

  const { data: allBounties = [], isLoading: loadingAll } = useQuery({
    queryKey: ["bounties"],
    queryFn: () => fetchBounties({ limit: 200 }),
  });

  const huntingBounties = allBounties.filter(
    (b: Bounty) => b.winner_github === username
  );



  const totalPosted = postedBounties.reduce(
    (sum: number, b: Bounty) => sum + b.usd_amount_at_the_time,
    0
  );

  // Only count bounties with status = 'claimed', not winner_selected
  const totalEarned = allBounties
    .filter(
      (b: Bounty) => b.status === "claimed" && b.winner_github === username
    )
    .reduce((sum: number, b: Bounty) => sum + b.usd_amount_at_the_time, 0);

  const bountiesWon = allBounties.filter(
    (b: Bounty) =>
      b.status === "claimed" && b.winner_github === username
  ).length;

  const totalPaidOut = postedBounties
    .filter((b: Bounty) => b.status === "claimed")
    .reduce((sum: number, b: Bounty) => sum + b.usd_amount_at_the_time, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-500 hover:text-ink-900 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </Link>

      {/* Profile header */}
      <div className="flex items-start gap-5 mb-10">
        <Avatar
          username={username}
          size="xl"
          className="!w-20 !h-20 border border-ink-100"
        />
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight text-ink-950">
              {username}
            </h1>
            {isOwnProfile && (
              <span className="text-2xs font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                You
              </span>
            )}
          </div>
          <a
            href={`https://github.com/${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[13px] text-ink-500 hover:text-ink-900 transition-colors mt-1"
          >
            github.com/{username}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px mb-10 bg-ink-100 border border-ink-100 rounded-xl overflow-hidden">
        <StatBlock label="Total earned" value={formatUSD(totalEarned)} />
        <StatBlock label="Bounties won" value={bountiesWon.toString()} />
        <StatBlock label="Bounties posted" value={postedBounties.length.toString()} />
        <StatBlock label="Total paid out" value={formatUSD(totalPaidOut)} />
      </div>

      {/* Tabs */}
      <div className="border-b border-ink-200 mb-6">
        <div className="flex items-center gap-1">
          {(["posted", "hunting"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "relative px-4 py-2.5 text-[13px] font-medium transition-colors capitalize",
                tab === t
                  ? "text-ink-950"
                  : "text-ink-500 hover:text-ink-900"
              )}
            >
              {t === "posted" ? "Posted" : "Hunting"}
              <span
                className={cn(
                  "ml-2 text-2xs px-1.5 py-0.5 rounded-full tabular",
                  tab === t
                    ? "bg-ink-950 text-white"
                    : "bg-ink-100 text-ink-500"
                )}
              >
                {t === "posted" ? postedBounties.length : huntingBounties.length}
              </span>
              {tab === t && (
                <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-ink-950" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === "posted" && (
        <div>
          {loadingPosted ? (
            <div className="border border-ink-200 rounded-xl overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <BountyRowSkeleton key={i} />
              ))}
            </div>
          ) : postedBounties.length === 0 ? (
            <EmptyState
              icon={<Target className="w-4 h-4" />}
              title={
                isOwnProfile
                  ? "You haven't posted any bounties yet"
                  : "No bounties posted"
              }
              description={
                isOwnProfile
                  ? "Drop a bounty on a GitHub issue and watch developers compete."
                  : ""
              }
              action={
                isOwnProfile && (
                  <Link href="/post">
                    <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                      Post your first bounty
                    </Button>
                  </Link>
                )
              }
            />
          ) : (
            <div className="border border-ink-200 rounded-xl overflow-hidden">
              {postedBounties.map((bounty: Bounty) => (
                <BountyRow key={bounty.bounty_id} bounty={bounty} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "hunting" && (
        <div>
          {loadingAll ? (
            <div className="border border-ink-200 rounded-xl overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <BountyRowSkeleton key={i} />
              ))}
            </div>
          ) : huntingBounties.length === 0 ? (
            <EmptyState
              icon={<Trophy className="w-4 h-4" />}
              title={
                isOwnProfile
                  ? "No wins yet — but the next one's yours"
                  : "No hunting activity"
              }
              description={
                isOwnProfile
                  ? "Browse open bounties and fix something to climb the leaderboard."
                  : ""
              }
              action={
                isOwnProfile && (
                  <Link href="/">
                    <Button variant="outline" size="sm">
                      Browse bounties
                    </Button>
                  </Link>
                )
              }
            />
          ) : (
            <div className="border border-ink-200 rounded-xl overflow-hidden">
              {huntingBounties.map((bounty: Bounty) => (
                <BountyRow key={bounty.bounty_id} bounty={bounty} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4 sm:p-5">
      <p className="text-2xs uppercase tracking-[0.06em] text-ink-400 font-medium">
        {label}
      </p>
      <p className="text-xl sm:text-2xl font-semibold text-ink-950 mt-1 tabular tracking-tight">
        {value}
      </p>
    </div>
  );
}
