"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Search,
  SlidersHorizontal,
  Plus,
  ArrowRight,
  Sparkles,
  X,
} from "lucide-react";
import { BountyRow, BountyRowSkeleton } from "@/components/bounty/BountyRow";
import { LanguageFilter } from "@/components/bounty/LanguageFilter";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchBounties } from "@/lib/api";
import { STATUS_FILTERS } from "@/lib/constants";
import { cn, formatUSD, effectiveStatus } from "@/lib/utils";
import type { Bounty } from "@/types";

export default function HomePage() {
  const [languages, setLanguages] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: bounties = [], isLoading } = useQuery({
    queryKey: ["bounties"],
    queryFn: () => fetchBounties({ limit: 100 }),
  });

  const stats = useMemo(() => {
    const open = bounties.filter(
      (b: Bounty) => effectiveStatus(b) === "open"
    );
    const claimed = bounties.filter(
      (b: Bounty) => b.status === "claimed"  // only fully claimed
    );
    const totalLocked = open.reduce(
      (sum: number, b: Bounty) => sum + b.usd_amount_at_the_time, 0
    );
    const totalPaid = claimed.reduce(
      (sum: number, b: Bounty) => sum + b.usd_amount_at_the_time, 0
    );
    return {
      openCount: open.length,
      paidCount: claimed.length,
      totalLocked,
      totalPaid,
    };
  }, [bounties]);

  const filtered = useMemo(() => {
    return bounties.filter((b: Bounty) => {
      const status = effectiveStatus(b);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (languages.length > 0) {
        const hasLang = b.languages?.some((l) => languages.includes(l));
        if (!hasLang) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        const hay = (
          (b.issue_title || "") +
          " " +
          b.github_username +
          " " +
          b.github_issue_url
        ).toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [bounties, languages, statusFilter, search]);

  const hasFilters = languages.length > 0 || search || statusFilter !== "open";

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-ink-100">
        <div className="absolute inset-0 bg-grid opacity-[0.5]" aria-hidden />
        <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white border border-ink-200 text-2xs text-ink-600 font-mono mb-6">
              <Sparkles className="w-3 h-3" />
              Now live on Solana devnet
            </div>
            <h1 className="text-balance text-[34px] sm:text-[44px] leading-[1.05] font-semibold tracking-[-0.02em] text-ink-950">
              GitHub bounties,{" "}
              <span className="text-ink-400">settled on-chain.</span>
            </h1>
            <p className="text-pretty text-base sm:text-[17px] text-ink-500 mt-5 leading-relaxed max-w-xl">
              Post a bounty on any open issue. Funds lock in escrow until a pull
              request merges, then the winning hunter claims their reward.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-7">
              <Link href="/post">
                <Button size="lg" iconRight={<ArrowRight className="w-4 h-4" />}>
                  Post a bounty
                </Button>
              </Link>
              <Link href="/faucet">
                <Button variant="outline" size="lg">
                  Get devnet tokens
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px mt-12 sm:mt-14 max-w-3xl bg-ink-100 border border-ink-100 rounded-xl overflow-hidden">
            <Stat label="Open bounties" value={stats.openCount.toString()} />
            <Stat label="Total locked" value={formatUSD(stats.totalLocked)} />
            <Stat label="Paid out" value={formatUSD(stats.totalPaid)} />
            <Stat label="Bounties claimed" value={stats.paidCount.toString()} />
          </div>
        </div>
      </section>

      {/* Feed */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid gap-8 lg:grid-cols-[180px_1fr] w-full">
          {/* Sidebar */}
          <aside className="hidden lg:block sticky top-20 self-start">
            <LanguageFilter selected={languages} onChange={setLanguages} />
          </aside>

          {/* Main */}
          <div className="min-w-0 w-full overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5 w-full">
              <div className="w-full sm:flex-1 sm:max-w-md min-w-0">
                <Input
                  placeholder="Search bounties, repos, users…"
                  leftIcon={<Search className="w-3.5 h-3.5" />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  rightSlot={
                    search ? (
                      <button
                        onClick={() => setSearch("")}
                        className="p-1 text-ink-400 hover:text-ink-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    ) : null
                  }
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none w-full sm:w-auto">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={cn(
                      "shrink-0 h-9 px-3 text-[13px] rounded-lg transition-colors whitespace-nowrap",
                      statusFilter === f.value
                        ? "bg-ink-950 text-white font-medium"
                        : "text-ink-600 hover:text-ink-950 hover:bg-ink-100 border border-ink-200"
                    )}
                  >
                    {f.label}
                  </button>
                ))}

                <button
                  onClick={() => setFilterOpen(!filterOpen)}
                  className={cn(
                    "lg:hidden shrink-0 inline-flex items-center gap-1.5 h-9 px-3 text-[13px] rounded-lg border transition-colors",
                    languages.length > 0
                      ? "border-ink-950 bg-ink-950 text-white"
                      : "border-ink-200 text-ink-600 hover:bg-ink-50"
                  )}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filter
                  {languages.length > 0 && (
                    <span className="bg-white text-ink-950 text-2xs font-semibold rounded-full w-4 h-4 flex items-center justify-center">
                      {languages.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Mobile filters */}
            {filterOpen && (
              <div className="lg:hidden mb-5 p-4 border border-ink-200 rounded-xl bg-white animate-fade-up">
                <LanguageFilter
                  selected={languages}
                  onChange={setLanguages}
                />
              </div>
            )}

            {/* Active filter chips */}
            {(languages.length > 0 || search) && (
              <div className="flex items-center flex-wrap gap-1.5 mb-4 text-xs text-ink-500">
                <span>Filtering by:</span>
                {search && (
                  <Chip onRemove={() => setSearch("")}>“{search}”</Chip>
                )}
                {languages.map((l) => (
                  <Chip
                    key={l}
                    onRemove={() =>
                      setLanguages(languages.filter((x) => x !== l))
                    }
                  >
                    {l}
                  </Chip>
                ))}
              </div>
            )}

            {/* Result count */}
            <p className="text-xs text-ink-400 mb-3 tabular">
              {isLoading
                ? "Loading…"
                : `${filtered.length} ${filtered.length === 1 ? "bounty" : "bounties"
                }`}
            </p>

            {/* List */}
            <div className="border border-ink-200 rounded-xl bg-white overflow-hidden">
              {isLoading ? (
                <>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <BountyRowSkeleton key={i} />
                  ))}
                </>
              ) : filtered.length === 0 ? (
                <div className="p-2">
                  <EmptyState
                    icon={<Plus className="w-4 h-4" />}
                    title={
                      hasFilters
                        ? "No bounties match those filters"
                        : "No open bounties right now"
                    }
                    description={
                      hasFilters
                        ? "Try clearing some filters to see more results."
                        : "Be the first to post one. Hunters are waiting."
                    }
                    action={
                      hasFilters ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setLanguages([]);
                            setSearch("");
                            setStatusFilter("open");
                          }}
                        >
                          Clear all filters
                        </Button>
                      ) : (
                        <Link href="/post">
                          <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                            Post a bounty
                          </Button>
                        </Link>
                      )
                    }
                  />
                </div>
              ) : (
                filtered.map((bounty: Bounty) => (
                  <BountyRow key={bounty.bounty_id} bounty={bounty} />
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
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

function Chip({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-ink-100 text-ink-700 text-xs">
      {children}
      <button
        onClick={onRemove}
        className="text-ink-500 hover:text-ink-900 -mr-0.5"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
