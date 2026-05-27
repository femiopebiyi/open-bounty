"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWallet, useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import {
  Search,
  ChevronRight,
  GitBranch,
  AlertCircle,
  Check,
  ArrowLeft,
  Info,
  Lock,
  Star,
  CircleDot,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import bs58 from "bs58";

import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useAuthStore } from "@/store/auth";
import {
  cn,
  daysToUnixTimestamp,
  usdToMicroDollars,
  formatTimeAgo,
} from "@/lib/utils";
import { SUPPORTED_LANGUAGES, LANGUAGE_COLORS } from "@/lib/constants";
import { api, getNonce, fetchUserRepos, fetchRepoIssues } from "@/lib/api";
import type { GitHubRepo, GitHubIssue } from "@/types";

import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { TransactionModal } from "@/components/bounty/TransactionModal";
import { postBountySol, postBountyUsdc } from "@/lib/transactions";

type Step = "repo" | "issue" | "details";

const STEPS: { key: Step; label: string }[] = [
  { key: "repo", label: "Repository" },
  { key: "issue", label: "Issue" },
  { key: "details", label: "Details" },
];

export default function PostBountyPage() {
  const router = useRouter();
  const { publicKey, signMessage, connected } = useWallet();
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const { setVisible } = useWalletModal();
  const { isAuthenticated, token } = useAuthStore();
  const { AuthModal, setShowLogin } = useAuthGuard();

  const [step, setStep] = useState<Step>("repo");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [issueSearch, setIssueSearch] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingIssues, setLoadingIssues] = useState(false);

  // Form
  const [tokenType, setTokenType] = useState<"SOL" | "USDC">("SOL");
  const [amountUsd, setAmountUsd] = useState("");
  const [daysActive, setDaysActive] = useState("14");
  const [hunterLimit, setHunterLimit] = useState("10");
  const [languages, setLanguages] = useState<string[]>([]);

  // Tx flow
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txStep, setTxStep] = useState(0);
  const [txError, setTxError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) setShowLogin(true);
  }, [isAuthenticated, setShowLogin]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    setLoadingRepos(true);
    fetchUserRepos(token)
      .then((data) => setRepos(Array.isArray(data) ? data : []))
      .catch(() => toast.error("Couldn't load your GitHub repos"))
      .finally(() => setLoadingRepos(false));
  }, [isAuthenticated, token]);

  const selectRepo = async (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setStep("issue");
    setIssueSearch("");
    setLoadingIssues(true);
    try {
      const data = await fetchRepoIssues(token!, repo.full_name);
      const issuesOnly = (data as any[]).filter((d) => !d.pull_request);
      setIssues(issuesOnly);
    } catch {
      toast.error("Couldn't load issues");
    } finally {
      setLoadingIssues(false);
    }
  };

  const selectIssue = (issue: GitHubIssue) => {
    setSelectedIssue(issue);
    setStep("details");
  };

  const toggleLanguage = (lang: string) =>
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );

  const filteredRepos = useMemo(() => {
    const q = repoSearch.toLowerCase();
    return repos.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q)
    );
  }, [repos, repoSearch]);

  const filteredIssues = useMemo(() => {
    const q = issueSearch.toLowerCase();
    return issues.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.number.toString().includes(q)
    );
  }, [issues, issueSearch]);

  const handleSubmit = async () => {
    if (!connected || !publicKey || !anchorWallet) {
      setVisible(true);
      return;
    }
    if (!selectedIssue || !selectedRepo) return;

    const amt = parseFloat(amountUsd);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!signMessage) {
      toast.error("Your wallet does not support message signing");
      return;
    }

    setTxModalOpen(true);
    setTxStep(0);
    setTxError(null);
    setSubmitting(true);

    try {
      const bountyId = Date.now();
      const expiryDate = daysToUnixTimestamp(parseInt(daysActive));
      const amountMicro = usdToMicroDollars(amt);

      // ── Step 0: Verify wallet ownership via nonce ──
      setTxStep(0);
      const { nonce, message } = await getNonce(publicKey.toBase58());
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(messageBytes);
      const signature = bs58.encode(signatureBytes);

      // ── Steps 1-N: On-chain transaction(s) ──
      let txSig: string;

      if (tokenType === "SOL") {
        txSig = await postBountySol({
          connection,
          wallet: anchorWallet,
          bountyId,
          amountUsd: amountMicro,
          expiryDate,
          onStepChange: setTxStep,
        });
      } else {
        const usdcMint = process.env.NEXT_PUBLIC_USDC_MINT ?? "EaUe6ri7FwqgxVyDcxGAFvfnNczdZVpmosTWo7RCXYZE";
        if (!usdcMint) throw new Error("USDC mint address not configured");

        txSig = await postBountyUsdc({
          connection,
          wallet: anchorWallet,
          bountyId,
          amount: amountMicro,
          expiryDate,
          tokenMint: new PublicKey(usdcMint),
          onStepChange: setTxStep,
        });
      }

      // ── Final step: Record in backend ──
      const totalSteps = tokenType === "SOL" ? 3 : 2;
      setTxStep(totalSteps);

      await api.post("/bounties", {
        bounty_id: bountyId,
        amount_in_sol: amountMicro,
        usd_amount_at_the_time: amountMicro,
        expiry_date: expiryDate,
        github_issue_url: selectedIssue.html_url,
        issue_title: selectedIssue.title,   // add this
        wallet: publicKey.toBase58(),
        nonce,
        signature,
        tx_sig: txSig,
        token_mint: tokenType === "USDC"
          ? process.env.NEXT_PUBLIC_USDC_MINT || null
          : null,
        languages,
        hunter_limit: parseInt(hunterLimit),
      });

      toast.success("Bounty posted!");
      setTimeout(() => {
        setTxModalOpen(false);
        router.push("/");
      }, 1500);
    } catch (err: any) {
      console.error(err);
      // User rejected wallet signature
      if (
        err?.message?.includes("User rejected") ||
        err?.message?.includes("Transaction cancelled")
      ) {
        setTxError("Transaction cancelled.");
      } else {
        setTxError(err?.response?.data || err?.message || "Something went wrong");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <Lock className="w-6 h-6 text-ink-300 mx-auto mb-3" />
        <h2 className="text-base font-semibold text-ink-900">
          Sign in to post a bounty
        </h2>
        <p className="text-[13px] text-ink-500 mt-1">
          Posters need GitHub access to verify the issue.
        </p>
        <AuthModal />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-500 hover:text-ink-900 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </button>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950">
          Post a bounty
        </h1>
        <p className="text-[13px] text-ink-500 mt-1">
          Attach a reward to any open GitHub issue. Funds stay in escrow until
          the merging PR is detected.
        </p>
      </header>

      {/* Stepper */}
      <div className="flex items-center justify-between mb-10">
        {STEPS.map((s, i) => {
          const currentIndex = STEPS.findIndex((x) => x.key === step);
          const isDone = i < currentIndex;
          const isActive = i === currentIndex;
          return (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 transition-colors",
                    isDone && "bg-ink-950 text-white",
                    isActive && "bg-ink-950 text-white",
                    !isDone && !isActive && "bg-ink-100 text-ink-400"
                  )}
                >
                  {isDone ? (
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={cn(
                    "text-[13px] font-medium hidden sm:inline",
                    isActive ? "text-ink-950" : "text-ink-500"
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 mx-3 h-px bg-ink-200" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Repo picker */}
      {step === "repo" && (
        <div className="animate-fade-up">
          <div className="mb-4">
            <Input
              placeholder="Search your repositories…"
              leftIcon={<Search className="w-3.5 h-3.5" />}
              value={repoSearch}
              onChange={(e) => setRepoSearch(e.target.value)}
            />
          </div>
          <div className="border border-ink-200 rounded-xl overflow-hidden bg-white">
            {loadingRepos ? (
              <div className="divide-y divide-ink-100">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="p-2">
                <EmptyState
                  icon={<GitBranch className="w-4 h-4" />}
                  title="No repositories found"
                  description={repoSearch ? "Try a different search term." : "No repositories available."}
                />
              </div>
            ) : (
              <ul className="max-h-[480px] overflow-y-auto divide-y divide-ink-100">
                {filteredRepos.map((repo) => (
                  <li key={repo.id}>
                    <button
                      onClick={() => selectRepo(repo)}
                      className="w-full text-left p-4 hover:bg-ink-50 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <GitBranch className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                            <span className="text-[13.5px] font-medium text-ink-900 truncate">
                              {repo.full_name}
                            </span>
                            {repo.private && (
                              <span className="text-2xs px-1.5 py-0.5 rounded bg-ink-100 text-ink-500 font-mono uppercase">
                                Private
                              </span>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-xs text-ink-500 truncate ml-5">
                              {repo.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 ml-5 text-2xs text-ink-400">
                            {repo.language && (
                              <span className="flex items-center gap-1">
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      LANGUAGE_COLORS[repo.language] || "#71717A",
                                  }}
                                />
                                {repo.language}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3" />
                              {repo.stargazers_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <CircleDot className="w-3 h-3" />
                              {repo.open_issues_count} open
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-ink-500 transition-colors shrink-0" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Issue picker */}
      {step === "issue" && selectedRepo && (
        <div className="animate-fade-up">
          <div className="flex items-center gap-1.5 text-xs mb-4">
            <button
              onClick={() => { setStep("repo"); setSelectedRepo(null); setIssues([]); }}
              className="text-ink-500 hover:text-ink-900 transition-colors font-mono"
            >
              {selectedRepo.full_name}
            </button>
            <ChevronRight className="w-3 h-3 text-ink-300" />
            <span className="text-ink-700 font-medium">Pick an issue</span>
          </div>
          <div className="mb-4">
            <Input
              placeholder="Search open issues…"
              leftIcon={<Search className="w-3.5 h-3.5" />}
              value={issueSearch}
              onChange={(e) => setIssueSearch(e.target.value)}
            />
          </div>
          <div className="border border-ink-200 rounded-xl overflow-hidden bg-white">
            {loadingIssues ? (
              <div className="divide-y divide-ink-100">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                ))}
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="p-2">
                <EmptyState
                  icon={<CircleDot className="w-4 h-4" />}
                  title="No open issues"
                  description="This repo has no open issues to post bounties on."
                />
              </div>
            ) : (
              <ul className="max-h-[480px] overflow-y-auto divide-y divide-ink-100">
                {filteredIssues.map((issue) => (
                  <li key={issue.id}>
                    <button
                      onClick={() => selectIssue(issue)}
                      className="w-full text-left p-4 hover:bg-ink-50 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-medium text-ink-900 leading-snug line-clamp-2">
                            {issue.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 text-2xs text-ink-400">
                            <span className="font-mono">#{issue.number}</span>
                            <span className="text-ink-200">·</span>
                            <span>opened {formatTimeAgo(issue.created_at)}</span>
                            {issue.labels.slice(0, 3).map((l) => (
                              <span
                                key={l.name}
                                className="px-1.5 py-0.5 rounded font-medium"
                                style={{
                                  backgroundColor: `#${l.color}20`,
                                  color: `#${l.color}`,
                                }}
                              >
                                {l.name}
                              </span>
                            ))}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-ink-500 transition-colors shrink-0 mt-0.5" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Details */}
      {step === "details" && selectedIssue && selectedRepo && (
        <div className="animate-fade-up space-y-6">
          {/* Selected issue summary */}
          <div className="flex items-start gap-3 p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-3 h-3 text-emerald-700" strokeWidth={3} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-ink-900 line-clamp-1">
                {selectedIssue.title}
              </p>
              <p className="text-xs text-ink-500 mt-0.5 font-mono">
                {selectedRepo.full_name}{" "}
                <span className="text-ink-300">·</span> #{selectedIssue.number}
              </p>
            </div>
            <button
              onClick={() => setStep("issue")}
              className="text-xs text-ink-500 hover:text-ink-900 transition-colors shrink-0"
            >
              Change
            </button>
          </div>

          {/* Token type */}
          <div>
            <Label>Reward token</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["SOL", "USDC"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTokenType(t)}
                  className={cn(
                    "flex items-center justify-center gap-2 h-10 rounded-lg border text-[13px] font-medium transition-colors",
                    tokenType === t
                      ? "border-ink-950 bg-ink-950 text-white"
                      : "border-ink-200 text-ink-700 hover:border-ink-300 hover:bg-ink-50"
                  )}
                >
                  <span className="text-sm">{t === "SOL" ? "◎" : "$"}</span>
                  {t}
                </button>
              ))}
            </div>
            {tokenType === "SOL" && (
              <div className="flex items-start gap-2 mt-2.5 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  Amount is converted to SOL at the current market price when you post.
                  1 wallet approval required.
                </p>
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <Label hint="USD value at time of posting">Bounty amount</Label>
            <Input
              type="number"
              min={1}
              placeholder="100"
              value={amountUsd}
              onChange={(e) => setAmountUsd(e.target.value)}
              leftIcon={<span className="text-ink-400 text-[13px]">$</span>}
              rightSlot={
                <span className="text-2xs font-mono text-ink-400 px-2">USD</span>
              }
            />
          </div>

          {/* Days + Hunter limit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Days active</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={daysActive}
                onChange={(e) => setDaysActive(e.target.value)}
              />
            </div>
            <div>
              <Label>Hunter limit</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={hunterLimit}
                onChange={(e) => setHunterLimit(e.target.value)}
              />
            </div>
          </div>

          {/* Languages */}
          <div>
            <Label optional>Languages</Label>
            <div className="flex flex-wrap gap-1.5">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const active = languages.includes(lang);
                return (
                  <button
                    key={lang}
                    onClick={() => toggleLanguage(lang)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs border transition-colors",
                      active
                        ? "border-ink-950 bg-ink-950 text-white"
                        : "border-ink-200 text-ink-700 hover:border-ink-300 hover:bg-ink-50"
                    )}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: active ? "white" : LANGUAGE_COLORS[lang],
                      }}
                    />
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wallet warning */}
          {!connected && (
            <div className="flex items-center gap-2.5 p-3 bg-ink-50 border border-ink-200 rounded-lg">
              <Wallet className="w-4 h-4 text-ink-500 shrink-0" />
              <p className="text-xs text-ink-700">
                Connect your wallet — funds will be locked from this wallet.
              </p>
            </div>
          )}

          {/* Submit */}
          <div className="pt-2">
            <Button
              fullWidth
              size="lg"
              onClick={handleSubmit}
              loading={submitting}
              disabled={!amountUsd}
            >
              {!connected
                ? "Connect wallet & post bounty"
                : `Post bounty${amountUsd ? ` · $${amountUsd}` : ""}`}
            </Button>
            <p className="text-2xs text-ink-400 text-center mt-2.5">
              Funds lock in a Solana escrow. Returned automatically if no winner
              by expiry.
            </p>
          </div>
        </div>
      )}

      <TransactionModal
        open={txModalOpen}
        tokenType={tokenType}
        currentStep={txStep}
        error={txError}
        onClose={() => {
          if (!submitting) setTxModalOpen(false);
        }}
      />
      <AuthModal />
    </div>
  );
}
