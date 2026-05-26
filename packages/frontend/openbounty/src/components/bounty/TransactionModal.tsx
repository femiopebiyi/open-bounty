"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransactionModalProps {
  open: boolean;
  tokenType: "SOL" | "USDC";
  currentStep: number;
  error?: string | null;
  onClose: () => void;
}

const SOL_STEPS = [
  {
    label: "Fetching SOL price",
    desc: "Getting current market rate from CoinGecko",
  },
  {
    label: "Lock bounty funds",
    desc: "Approval 1 of 1 — transfer SOL into escrow",
  },
  {
    label: "Confirming",
    desc: "Waiting for network confirmation",
  },
];

const USDC_STEPS = [
  {
    label: "Lock bounty funds",
    desc: "Approval 1 of 1 — transfer USDC into escrow",
  },
  {
    label: "Confirming",
    desc: "Waiting for network confirmation",
  },
];

export function TransactionModal({
  open,
  tokenType,
  currentStep,
  error,
  onClose,
}: TransactionModalProps) {
  const steps = tokenType === "SOL" ? SOL_STEPS : USDC_STEPS;
  const isComplete = currentStep >= steps.length && !error;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-950/30 backdrop-blur-[2px] animate-fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md bg-white rounded-2xl shadow-modal overflow-hidden animate-fade-up focus:outline-none"
          onInteractOutside={(e) => !isComplete && !error && e.preventDefault()}
          onEscapeKeyDown={(e) => !isComplete && !error && e.preventDefault()}
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <Dialog.Title className="text-base font-semibold text-ink-950 tracking-tight">
                  {error
                    ? "Transaction failed"
                    : isComplete
                      ? "Bounty posted"
                      : "Posting your bounty"}
                </Dialog.Title>
                <Dialog.Description className="text-[13px] text-ink-500 mt-1">
                  {error
                    ? "Something went wrong. You can try again safely."
                    : tokenType === "SOL"
                      ? "This requires 2 wallet approvals"
                      : "This requires 1 wallet approval"}
                </Dialog.Description>
              </div>
              {(isComplete || error) && (
                <Dialog.Close className="text-ink-400 hover:text-ink-700 transition-colors">
                  <span className="text-xs">Close</span>
                </Dialog.Close>
              )}
            </div>

            {/* Steps */}
            {error ? (
              <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-[13px] text-red-700 break-words">{error}</p>
              </div>
            ) : (
              <ol className="space-y-1">
                {steps.map((step, i) => {
                  const isDone = i < currentStep;
                  const isActive = i === currentStep;
                  const isPending = i > currentStep;

                  return (
                    <li
                      key={i}
                      className={cn(
                        "relative flex items-start gap-3 p-3 rounded-lg transition-colors",
                        isActive && "bg-ink-50",
                        isDone && "opacity-50"
                      )}
                    >
                      {/* Step indicator */}
                      <div
                        className={cn(
                          "relative w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                          isDone && "bg-ink-950",
                          isActive && "bg-ink-950",
                          isPending && "bg-ink-100 ring-1 ring-inset ring-ink-200"
                        )}
                      >
                        {isDone ? (
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        ) : isActive ? (
                          <Loader2 className="w-3 h-3 text-white animate-spin" />
                        ) : (
                          <span className="text-2xs text-ink-400 font-medium">
                            {i + 1}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-[13px] font-medium leading-snug",
                            isPending ? "text-ink-500" : "text-ink-900"
                          )}
                        >
                          {step.label}
                        </p>
                        {isActive && (
                          <p className="text-xs text-ink-500 mt-1 leading-relaxed animate-fade-in">
                            {step.desc}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {isComplete && (
              <div className="mt-5 p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-3 animate-fade-up">
                <div className="w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                </div>
                <p className="text-[13px] text-emerald-800 font-medium">
                  Funds locked in escrow. Hunters can now register.
                </p>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
