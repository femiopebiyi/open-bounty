"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet, Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn, shortenAddress } from "@/lib/utils";
import { toast } from "sonner";

export function WalletButton() {
  const { publicKey, disconnect, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);

  if (!publicKey) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] font-medium text-ink-700 border border-ink-200 rounded-lg hover:border-ink-300 hover:bg-ink-50 transition-colors"
      >
        <Wallet className="w-3.5 h-3.5" />
        Connect
      </button>
    );
  }

  const address = publicKey.toBase58();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 text-[12.5px] font-medium border border-ink-200 rounded-lg hover:border-ink-300 hover:bg-ink-50 transition-colors"
      >
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
        <span className="font-mono">{shortenAddress(address, 3)}</span>
        <ChevronDown className="w-3 h-3 text-ink-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-ink-200 rounded-xl shadow-elevated z-50 overflow-hidden animate-fade-up">
            <div className="px-3 py-2.5 border-b border-ink-100">
              <p className="text-2xs text-ink-400 uppercase tracking-wider">
                Connected with {wallet?.adapter.name}
              </p>
              <p className="text-xs font-mono text-ink-800 mt-1 break-all">
                {address}
              </p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(address);
                toast.success("Address copied");
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-[13px] text-ink-700 hover:bg-ink-50 transition-colors"
            >
              Copy address
            </button>
            <button
              onClick={() => {
                setVisible(true);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-[13px] text-ink-700 hover:bg-ink-50 transition-colors"
            >
              Change wallet
            </button>
            <button
              onClick={async () => {
                await disconnect();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors border-t border-ink-100"
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
