export type BountyStatus = "open" | "winner_selected" | "claimed" | "expired";
export type TokenType = "SOL" | "USDC";

export interface Bounty {
  bounty_id: number;
  wallet_pubkey: string;
  github_username: string;
  amount_in_sol: number;
  usd_amount_at_the_time: number;
  expiry_date: number;
  github_issue_url: string;
  issue_title?: string;          // add this
  status: BountyStatus;
  winner_github: string | null;
  winner_wallet: string | null;
  token_mint: string | null;
  languages?: string[];
  hunter_count?: number;
  hunter_limit?: number;
  created_at?: string;
}

export interface Hunter {
  bounty_id: number;
  github_username: string;
  payout_wallet: string;
  registered_at: string;
}

export interface LeaderboardEntry {
  github_username: string;
  total_earned: number;
  bounties_won: number;
  rank?: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  open_issues_count: number;
  private: boolean;
  updated_at: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  body: string | null;
  labels: { name: string; color: string }[];
  comments: number;
  created_at: string;
}

export interface AuthState {
  token: string | null;
  github_username: string | null;
  email: string | null;
  isAuthenticated: boolean;
}
