"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Clock,
  Users,
  Trophy,
  AlertCircle,
  Copy,
  Lock,
  Calendar,
  Wallet,
} from "lucide-react";

import {
  fetchBounties,
  registerForBounty,
  claimBounty,
  fetchHuntersForBounty,
  fetchBounty,
} from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useAuthStore } from "@/store/auth";
import {
  cn,
  formatTimeRemaining,
  formatAmount,
  effectiveStatus,
  shortenAddress,
  formatDate,
  extractRepoInfo,
} from "@/lib/utils";
import { LANGUAGE_COLORS } from "@/lib/constants";
import type { Bounty, Hunter } from "@/types";

import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/bounty/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";

export default function BountyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { github_username, isAuthenticated } = useAuthStore();
  const { AuthModal, requireAuth } = useAuthGuard();
  const queryClient = useQueryClient();

  const [payoutWallet, setPayoutWallet] = useState("");
  const [alertEmail, setAlertEmail] = useState("");
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  const { data: bounty, isLoading } = useQuery<Bounty>({
    queryKey: ["bounty", id],
    queryFn: () => fetchBounty(parseInt(id)),
  });

  const { data: hunters = [] } = useQuery({
    queryKey: ["bounty-hunters", id],
    queryFn: () => fetchHuntersForBounty(parseInt(id)),
    enabled: !!bounty,
  });

  useEffect(() => {
    if (publicKey && !payoutWallet) {
      setPayoutWallet(publicKey.toBase58());
    }
  }, [publicKey, payoutWallet]);

  const registerMutation = useMutation({
    mutationFn: () =>
      registerForBounty({
        bounty_id: parseInt(id),
        payout_wallet: payoutWallet,
        alert_mail: alertEmail || undefined,
      }),
    onSuccess: () => {
      toast.success("Registered. Good luck.");
      setShowRegisterForm(false);
      queryClient.invalidateQueries({ queryKey: ["bounty-hunters", id] });
      queryClient.invalidateQueries({ queryKey: ["bounties"] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data || "Registration failed"),
  });

  const claimMutation = useMutation({
    mutationFn: () => claimBounty(parseInt(id)),
    onSuccess: () => {
      toast.success("Bounty claimed!");
      queryClient.invalidateQueries({ queryKey: ["bounties"] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data || "Claim failed"),
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-48" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!bounty) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <AlertCircle className="w-6 h-6 text-ink-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-ink-900">Bounty not found</p>
        <Link
          href="/"
          className="inline-block mt-3 text-xs text-ink-500 hover:text-ink-900 transition-colors"
        >
          ← Back to all bounties
        </Link>
      </div>
    );
  }

  const status = effectiveStatus(bounty);
  const repo = extractRepoInfo(bounty.github_issue_url);
  const amount = formatAmount(bounty.amount_in_sol, bounty.token_mint);
  const isPoster = github_username === bounty.github_username;
  const isWinner = github_username === bounty.winner_github;
  const isRegistered = hunters.some(
    (h: Hunter) => h.github_username === github_username
  );

  //&& !isPoster
  const canRegister =
    isAuthenticated && status === "open" && !isRegistered;
  const canClaim =
    isAuthenticated && isWinner && status === "winner_selected";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-500 hover:text-ink-900 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All bounties
      </button>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 lg:gap-10">
        {/* Main */}
        <div className="min-w-0 space-y-6">
          {/* Title block */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              {repo && (
                <span className="text-[13px] font-mono text-ink-500">
                  {repo.full_name}
                </span>
              )}
              {repo?.number && (
                <>
                  <span className="text-ink-300">·</span>
                  <span className="text-[13px] text-ink-400">
                    #{repo.number}
                  </span>
                </>
              )}
              <StatusBadge status={status} className="ml-auto" />
            </div>

            <h1 className="text-[22px] sm:text-2xl font-semibold leading-tight tracking-tight text-ink-950 text-balance">
              {bounty.issue_title || `Issue #${repo?.number}`}
              {bounty.issue_title && repo?.number && (
                <span className="ml-2 text-base font-normal text-ink-400 align-middle">
                  #{repo.number}
                </span>
              )}
            </h1>

            <div className="flex items-center flex-wrap gap-3 mt-4">
              <Link
                href={`/profile/${bounty.github_username}`}
                className="inline-flex items-center gap-1.5 text-[13px] text-ink-600 hover:text-ink-950 transition-colors"
              >
                <Avatar username={bounty.github_username} size="sm" />
                Posted by {bounty.github_username}
              </Link>
              <span className="text-ink-200">·</span>
              <span className="text-[13px] text-ink-500">
                Expires {formatDate(bounty.expiry_date)}
              </span>
            </div>

            {bounty.languages && bounty.languages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {bounty.languages.map((lang) => (
                  <span
                    key={lang}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-ink-100 text-ink-700 text-2xs"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: LANGUAGE_COLORS[lang] }}
                    />
                    {lang}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Winner banner */}
          {canClaim && (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl animate-fade-up">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                  <Trophy className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-900">
                    Congratulations — you won this bounty
                  </p>
                  <p className="text-[13px] text-emerald-700 mt-0.5">
                    Your reward of <strong>{amount.raw}</strong> is ready to
                    claim. Connect the wallet you registered with.
                  </p>
                  <Button
                    variant="success"
                    size="md"
                    className="mt-4"
                    onClick={() => {
                      if (!connected) {
                        setVisible(true);
                        return;
                      }
                      claimMutation.mutate();
                    }}
                    loading={claimMutation.isPending}
                  >
                    {connected ? "Claim reward" : "Connect wallet to claim"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Winner selected (not viewer) */}
          {status === "winner_selected" && !isWinner && bounty.winner_github && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-3">
              <Trophy className="w-4 h-4 text-amber-700 shrink-0" />
              <p className="text-[13px] text-amber-800">
                Awarded to{" "}
                <Link
                  href={`/profile/${bounty.winner_github}`}
                  className="font-semibold hover:underline"
                >
                  @{bounty.winner_github}
                </Link>
              </p>
            </div>
          )}





          {/* Already registered */}
          {isRegistered && status === "open" && (
            <div className="p-4 bg-ink-50 border border-ink-200 rounded-xl flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <span className="w-2 h-2 bg-emerald-600 rounded-full" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-ink-900">
                  You're registered for this bounty
                </p>
                <p className="text-xs text-ink-500 mt-0.5">
                  Open a PR with{" "}
                  <code className="text-ink-700 font-mono">
                    Closes #{repo?.number}
                  </code>{" "}
                  in the description.
                </p>
              </div>
            </div>
          )}





          {/* Sidebar */}
          <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
            {/* Reward card */}
            <div className="bg-ink-950 text-white rounded-xl p-5">
              <p className="text-2xs uppercase tracking-[0.06em] text-ink-400 mb-2 font-medium">
                Reward
              </p>
              <div className="flex items-baseline gap-1.5 tabular">
                <span className="text-3xl font-semibold tracking-tight">
                  {amount.symbol === "USD" ? "$" : ""}
                  {amount.value}
                </span>
                <span className="text-sm text-ink-400">
                  {amount.symbol === "USD" ? "SOL" : amount.symbol}
                </span>
              </div>
              <p className="text-2xs text-ink-400 mt-2">
                Locked in escrow on Solana {process.env.NEXT_PUBLIC_SOLANA_NETWORK}
              </p>
            </div>

            {/* Meta card */}
            <div className="border border-ink-200 rounded-xl divide-y divide-ink-100 bg-white">
              <MetaRow
                icon={<Clock className="w-3.5 h-3.5" />}
                label="Time left"
                value={formatTimeRemaining(bounty.expiry_date)}
              />
              {bounty.hunter_limit !== undefined && (
                <MetaRow
                  icon={<Users className="w-3.5 h-3.5" />}
                  label="Hunters"
                  value={`${hunters.length} / ${bounty.hunter_limit}`}
                />
              )}
              <MetaRow
                icon={<Calendar className="w-3.5 h-3.5" />}
                label="Expires"
                value={formatDate(bounty.expiry_date)}
              />
              <MetaRow
                icon={<Lock className="w-3.5 h-3.5" />}
                label="Token"
                value={bounty.token_mint ? "USDC" : "SOL"}
              />
              <MetaRow
                icon={<Wallet className="w-3.5 h-3.5" />}
                label="Escrow"
                value={
                  <span className="font-mono text-xs">
                    {shortenAddress(bounty.wallet_pubkey, 4)}
                  </span>
                }
                copy={bounty.wallet_pubkey}
              />
            </div>

            {/* Register CTA */}
            {canRegister && !showRegisterForm && (
              <button
                onClick={() => requireAuth(() => setShowRegisterForm(true))}
                className="w-full text-left p-5 border border-dashed border-ink-300 rounded-xl hover:border-ink-500 hover:bg-ink-50/50 transition-colors group"
              >
                <p className="text-sm font-medium text-ink-900">
                  Register to hunt this bounty
                </p>
                <p className="text-[13px] text-ink-500 mt-0.5">
                  Fix the issue, open a PR with{" "}
                  <code className="text-ink-700 font-mono bg-ink-100 px-1 py-0.5 rounded text-xs">
                    Closes #{repo?.number}
                  </code>{" "}
                  in the description, and earn the reward.
                </p>
              </button>
            )}

            {/* Register form */}
            {showRegisterForm && (
              <div className="border border-ink-200 rounded-xl p-5 animate-fade-up">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-ink-900">
                    Register for this bounty
                  </h3>
                  <button
                    onClick={() => setShowRegisterForm(false)}
                    className="text-xs text-ink-500 hover:text-ink-900"
                  >
                    Cancel
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label hint="No verification, paste carefully">
                      Payout wallet
                    </Label>
                    <Input
                      placeholder="Your Solana address"
                      value={payoutWallet}
                      onChange={(e) => setPayoutWallet(e.target.value)}
                      className="font-mono text-xs"
                    />
                    {connected && publicKey && (
                      <button
                        onClick={() => setPayoutWallet(publicKey.toBase58())}
                        className="mt-1.5 text-2xs text-ink-500 hover:text-ink-900 transition-colors"
                      >
                        Use connected wallet
                      </button>
                    )}
                  </div>
                  <div>
                    <Label optional hint="We'll email you if you win">
                      Notification email
                    </Label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={alertEmail}
                      onChange={(e) => setAlertEmail(e.target.value)}
                    />
                  </div>
                  <Button
                    fullWidth
                    onClick={() => registerMutation.mutate()}
                    loading={registerMutation.isPending}
                    disabled={!payoutWallet}
                  >
                    Confirm registration
                  </Button>
                </div>
              </div>
            )}

            {/* GitHub link */}
            <a
              href={bounty.github_issue_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 border border-ink-200 rounded-xl hover:bg-ink-50 transition-colors group"
            >
              <div>
                <p className="text-[13px] font-medium text-ink-900">
                  View on GitHub
                </p>
                <p className="text-2xs text-ink-500 mt-0.5">
                  Read the full issue
                </p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-ink-400 group-hover:text-ink-700 transition-colors" />
            </a>
          </aside>
        </div>



        {/* Hunters */}
        {hunters.length > 0 && (
          <div className="border border-ink-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-ink-100 bg-ink-50/40 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-ink-900">
                Hunters
              </h3>
              <span className="text-2xs text-ink-500 tabular">
                {hunters.length}
                {bounty.hunter_limit ? ` / ${bounty.hunter_limit}` : ""}
              </span>
            </div>
            <ul className="divide-y divide-ink-100">
              {hunters.map((h: Hunter) => (
                <li
                  key={h.github_username}
                  className="px-4 py-3 flex items-center justify-between"
                >
                  <Link
                    href={`/profile/${h.github_username}`}
                    className="flex items-center gap-2.5 group min-w-0"
                  >
                    <Avatar username={h.github_username} size="md" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink-900 group-hover:text-ink-700 transition-colors truncate">
                        {h.github_username}
                      </p>
                      <p className="text-2xs font-mono text-ink-400">
                        {shortenAddress(h.payout_wallet)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <AuthModal />
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
  copy,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  copy?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="flex items-center gap-2 text-[13px] text-ink-500">
        <span className="text-ink-400">{icon}</span>
        {label}
      </div>
      <div className="flex items-center gap-1.5 text-[13px] text-ink-900 font-medium">
        {value}
        {copy && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(copy);
              toast.success("Copied to clipboard");
            }}
            className="text-ink-400 hover:text-ink-700 transition-colors"
          >
            <Copy className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
