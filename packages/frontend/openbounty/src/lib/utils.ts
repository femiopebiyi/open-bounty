import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNowStrict, fromUnixTime, isPast, format } from "date-fns";
import type { BountyStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isExpired(expiryUnix: number): boolean {
  return isPast(fromUnixTime(expiryUnix));
}

export function formatTimeRemaining(expiryUnix: number): string {
  const date = fromUnixTime(expiryUnix);
  if (isPast(date)) return "Expired";
  return formatDistanceToNowStrict(date) + " left";
}

export function formatTimeAgo(unix: number | string): string {
  const date = typeof unix === "number" ? fromUnixTime(unix) : new Date(unix);
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

export function formatDate(unix: number | string): string {
  const date = typeof unix === "number" ? fromUnixTime(unix) : new Date(unix);
  return format(date, "MMM d, yyyy");
}

export function formatAmount(amount: number, tokenMint: string | null): {
  value: string;
  symbol: string;
  raw: string;
} {
  if (tokenMint) {
    const v = amount / 1_000_000;
    return {
      value: v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      symbol: "USDC",
      raw: `${v.toFixed(2)} USDC`,
    };
  }
  // amount is in microdollars (USD value at posting)
  const v = amount / 1_000_000;
  return {
    value: v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    symbol: "USD",
    raw: `$${v.toFixed(2)}`,
  };
}

export function formatUSD(microDollars: number): string {
  const v = microDollars / 1_000_000;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatSOL(lamports: number, decimals = 3): string {
  return (lamports / 1_000_000_000).toFixed(decimals);
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function effectiveStatus(b: { status: BountyStatus; expiry_date: number }): BountyStatus {
  if (b.status === "open" && isExpired(b.expiry_date)) return "expired";
  return b.status;
}

export function extractRepoInfo(issueUrl: string): {
  owner: string;
  repo: string;
  number: number;
  full_name: string;
} | null {
  const match = issueUrl.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    number: parseInt(match[3]),
    full_name: `${match[1]}/${match[2]}`,
  };
}

export function daysToUnixTimestamp(days: number): number {
  return Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
}

export function usdToMicroDollars(usd: number): number {
  return Math.floor(usd * 1_000_000);
}

export function gravatarFor(username: string): string {
  return `https://avatars.githubusercontent.com/${username}`;
}
