"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Droplets,
  Check,
  Wallet,
  Clock,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

import { requestFaucet } from "@/lib/api";
import { shortenAddress } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export default function FaucetPage() {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [claimed, setClaimed] = useState<{
    solSig?: string;
    usdcSig?: string;
  } | null>(null);
  const [cooldown, setCooldown] = useState(false);

  const faucetMutation = useMutation({
    mutationFn: () => requestFaucet(publicKey!.toBase58()),
    onSuccess: (data) => {
      setClaimed({ solSig: data?.sol_sig, usdcSig: data?.usdc_sig });
      toast.success("Airdrop sent");
    },
    onError: (err: any) => {
      const msg = err?.response?.data || "Request failed";
      if (typeof msg === "string" && msg.toLowerCase().includes("24")) {
        setCooldown(true);
        toast.error("Already claimed today. Come back in 24 hours.");
      } else {
        toast.error(msg);
      }
    },
  });

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-14">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex w-12 h-12 bg-ink-950 text-white rounded-xl items-center justify-center mb-5">
          <Droplets className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950">
          Devnet faucet
        </h1>
        <p className="text-[13px] text-ink-500 mt-2">
          Get test tokens to try OpenBounty without spending real money.
        </p>
      </div>

      {/* What you get */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <FaucetAmount icon="◎" amount="1" label="Devnet SOL" />
        <FaucetAmount icon="$" amount="10,000" label="Test USDC" />
      </div>

      {/* Rate limit notice */}
      <div className="flex items-start gap-2.5 p-3 mb-6 bg-ink-50 border border-ink-100 rounded-lg">
        <Clock className="w-3.5 h-3.5 text-ink-500 shrink-0 mt-0.5" />
        <div className="text-xs text-ink-700 leading-relaxed">
          <strong className="text-ink-900">One claim per wallet, per day.</strong>{" "}
          Tokens have no real value and only work on Solana devnet.
        </div>
      </div>

      {/* Action */}
      {!connected ? (
        <Button
          fullWidth
          size="lg"
          icon={<Wallet className="w-4 h-4" />}
          onClick={() => setVisible(true)}
        >
          Connect wallet to claim
        </Button>
      ) : claimed ? (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-center animate-fade-up">
          <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check className="w-5 h-5 text-white" strokeWidth={3} />
          </div>
          <p className="text-sm font-semibold text-emerald-900">
            Airdrop sent
          </p>
          <p className="text-[13px] text-emerald-700 mt-1">
            Tokens are on their way to{" "}
            <span className="font-mono">
              {shortenAddress(publicKey!.toBase58(), 4)}
            </span>
          </p>
          {(claimed.solSig || claimed.usdcSig) && (
            <div className="mt-4 pt-4 border-t border-emerald-200 space-y-2 text-xs">
              {claimed.solSig && (
                <TxLink label="SOL transfer" sig={claimed.solSig} />
              )}
              {claimed.usdcSig && (
                <TxLink label="USDC transfer" sig={claimed.usdcSig} />
              )}
            </div>
          )}
          <p className="text-2xs text-emerald-600 mt-4">
            Come back in 24 hours for another claim.
          </p>
        </div>
      ) : cooldown ? (
        <div className="p-5 bg-ink-50 border border-ink-200 rounded-xl text-center">
          <Clock className="w-5 h-5 text-ink-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-ink-900">
            You've already claimed today
          </p>
          <p className="text-[13px] text-ink-500 mt-1">
            Faucet refreshes 24 hours after your last claim.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 p-3 bg-white border border-ink-200 rounded-lg">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            <div className="flex-1 min-w-0">
              <p className="text-2xs text-ink-400 uppercase tracking-wider">
                Sending to
              </p>
              <p className="text-xs font-mono text-ink-800 truncate">
                {publicKey?.toBase58()}
              </p>
            </div>
          </div>
          <Button
            fullWidth
            size="lg"
            icon={<Droplets className="w-4 h-4" />}
            onClick={() => faucetMutation.mutate()}
            loading={faucetMutation.isPending}
          >
            Request airdrop
          </Button>
        </div>
      )}
    </div>
  );
}

function FaucetAmount({
  icon,
  amount,
  label,
}: {
  icon: string;
  amount: string;
  label: string;
}) {
  return (
    <div className="p-4 border border-ink-200 rounded-xl text-center">
      <div className="inline-flex w-7 h-7 rounded-full bg-ink-100 items-center justify-center text-sm font-semibold text-ink-700 mb-2">
        {icon}
      </div>
      <p className="text-2xl font-semibold text-ink-950 tabular tracking-tight">
        {amount}
      </p>
      <p className="text-2xs uppercase tracking-[0.06em] text-ink-400 font-medium mt-1">
        {label}
      </p>
    </div>
  );
}

function TxLink({ label, sig }: { label: string; sig: string }) {
  return (
    <a
      href={`https://solscan.io/tx/${sig}?cluster=devnet`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between text-emerald-800 hover:text-emerald-900 transition-colors"
    >
      <span>{label}</span>
      <span className="inline-flex items-center gap-1 font-mono">
        {shortenAddress(sig, 4)}
        <ExternalLink className="w-3 h-3" />
      </span>
    </a>
  );
}
