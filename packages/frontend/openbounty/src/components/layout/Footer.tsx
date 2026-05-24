import Link from "next/link";
import { Github } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-ink-100 mt-20">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-ink-950 rounded-md flex items-center justify-center">
              <span className="text-white text-[8px] font-bold tracking-tighter">
                OB
              </span>
            </div>
            <span className="text-[13px] text-ink-500">
              OpenBounty &middot; Trustless bounties on Solana
            </span>
          </div>

          <div className="flex items-center gap-6 text-[13px]">
            <Link
              href="/leaderboard"
              className="text-ink-500 hover:text-ink-900 transition-colors"
            >
              Leaderboard
            </Link>
            <Link
              href="/faucet"
              className="text-ink-500 hover:text-ink-900 transition-colors"
            >
              Faucet
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-ink-500 hover:text-ink-900 transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
