"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Plus,
  Menu,
  X,
  LogOut,
  User,
  ChevronDown,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useWallet } from "@solana/wallet-adapter-react";
import { cn } from "@/lib/utils";
import { LoginModal } from "@/components/auth/LoginModal";
import { WalletButton } from "@/components/wallet/WalletButton";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

const navLinks = [
  { href: "/", label: "Bounties" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/faucet", label: "Faucet" },
];

export function Navbar() {
  const pathname = usePathname();
  const { disconnect } = useWallet();
  const { isAuthenticated, github_username, clearAuth } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const handleLogout = async () => {
    clearAuth();
    await disconnect();
    setProfileOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-30 w-full bg-white/85 backdrop-blur-md border-b border-ink-100">
        <nav className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center">
          {/* Logo + nav */}
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="flex items-center gap-2 group"
            >
              <div className="w-[22px] h-[22px] bg-ink-950 rounded-md flex items-center justify-center transition-transform group-hover:scale-105">
                <span className="text-white text-[9px] font-bold tracking-tighter">
                  OB
                </span>
              </div>
              <span className="font-semibold text-[14.5px] tracking-tight">
                OpenBounty
              </span>
              <span className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-2xs font-mono uppercase tracking-wider text-ink-400 border border-ink-200 rounded">
                Devnet
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-0.5">
              {navLinks.map((link) => {
                const active =
                  link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "relative px-2.5 py-1.5 text-[13px] transition-colors",
                      active
                        ? "text-ink-950 font-medium"
                        : "text-ink-500 hover:text-ink-900"
                    )}
                  >
                    {link.label}
                    {active && (
                      <span className="absolute left-1/2 -translate-x-1/2 -bottom-[15px] h-[2px] w-6 bg-ink-950 rounded-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-2 ml-auto">
            {isAuthenticated ? (
              <>
                <Link href="/post" className="hidden sm:block">
                  <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                    New bounty
                  </Button>
                </Link>

                <div className="hidden sm:block">
                  <WalletButton />
                </div>

                {/* Profile dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-1 p-0.5 rounded-full hover:bg-ink-100 transition-colors"
                  >
                    {github_username && (
                      <Avatar username={github_username} size="lg" className="!w-7 !h-7" />
                    )}
                    <ChevronDown className="w-3 h-3 text-ink-400 mr-1" />
                  </button>

                  {profileOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setProfileOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-ink-200 rounded-xl shadow-elevated z-50 overflow-hidden animate-fade-up">
                        <div className="px-3 py-2.5 border-b border-ink-100">
                          <p className="text-2xs text-ink-400 uppercase tracking-wider">
                            Signed in as
                          </p>
                          <p className="text-[13px] font-medium text-ink-900 mt-0.5">
                            {github_username}
                          </p>
                        </div>
                        <Link
                          href={`/profile/${github_username}`}
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-[13px] text-ink-700 hover:bg-ink-50 transition-colors"
                        >
                          <User className="w-3.5 h-3.5 text-ink-400" />
                          Your profile
                        </Link>
                        <Link
                          href="/post"
                          onClick={() => setProfileOpen(false)}
                          className="flex sm:hidden items-center gap-2 px-3 py-2 text-[13px] text-ink-700 hover:bg-ink-50 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 text-ink-400" />
                          New bounty
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-ink-700 hover:bg-ink-50 transition-colors border-t border-ink-100"
                        >
                          <LogOut className="w-3.5 h-3.5 text-ink-400" />
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <Button size="sm" onClick={() => setLoginOpen(true)}>
                Sign in
              </Button>
            )}

            <button
              className="md:hidden p-1.5 rounded-md text-ink-700 hover:bg-ink-100 transition-colors ml-1"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-ink-100 bg-white py-2 px-4 animate-fade-in">
            {navLinks.map((link) => {
              const active =
                link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "block px-3 py-2 rounded-md text-sm transition-colors",
                    active
                      ? "bg-ink-100 text-ink-950 font-medium"
                      : "text-ink-600 hover:bg-ink-50"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            {isAuthenticated && (
              <div className="pt-2 mt-2 border-t border-ink-100 sm:hidden">
                <WalletButton />
              </div>
            )}
          </div>
        )}
      </header>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
