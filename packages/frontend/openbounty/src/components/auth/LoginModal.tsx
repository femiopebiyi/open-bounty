"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Github, X, ArrowRight } from "lucide-react";
import { useEffect } from "react";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export function LoginModal({ open, onClose }: LoginModalProps) {
  const handleGitHubLogin = () => {
    window.location.href = `${API_URL}/auth/github`;
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-950/30 backdrop-blur-[2px] animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm bg-white rounded-2xl shadow-modal overflow-hidden animate-fade-up focus:outline-none">
          <Dialog.Close className="absolute top-3 right-3 p-1.5 rounded-md text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition-colors">
            <X className="w-4 h-4" />
          </Dialog.Close>

          <div className="p-6 pt-7">
            <div className="flex items-center gap-2 mb-5">
              <Logo size="md" />
              <span className="font-semibold tracking-tight text-ink-950">
                OpenBounty
              </span>
            </div>
            <Dialog.Title className="text-lg font-semibold text-ink-950 tracking-tight">
              Sign in to continue
            </Dialog.Title>
            <Dialog.Description className="text-[13px] text-ink-500 mt-1">
              Connect your GitHub account to post bounties and earn rewards for
              fixing issues.
            </Dialog.Description>

            <button
              onClick={handleGitHubLogin}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 h-11 bg-ink-950 text-white text-sm font-medium rounded-lg hover:bg-ink-800 transition-colors group"
            >
              <Github className="w-4 h-4" />
              Continue with GitHub
              <ArrowRight className="w-3.5 h-3.5 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all" />
            </button>

            <div className="mt-5 pt-4 border-t border-ink-100">
              <p className="text-2xs text-ink-400 text-center leading-relaxed">
                We use GitHub to verify the developers behind every bounty.
                No code access. Read your public profile and email only.
              </p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Logo({ size = "sm" }: { size?: "sm" | "md" }) {
  const dims = size === "md" ? "w-6 h-6" : "w-5 h-5";
  return (
    <div className={`${dims} bg-ink-950 rounded-md flex items-center justify-center`}>
      <span className="text-white text-[9px] font-bold tracking-tighter">
        OB
      </span>
    </div>
  );
}
