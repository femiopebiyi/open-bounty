# OpenBounty

> Trustless GitHub bounties on Solana.

Post a bounty on any open GitHub issue. Funds lock in escrow until a pull
request merges — then the winning hunter claims their reward.

## Stack

- **Next.js 14** — App Router, RSC where it counts
- **Geist Sans + Mono** — Vercel's typeface
- **Tailwind CSS** — custom ink/emerald palette, no defaults
- **Solana Wallet Adapter** — Phantom, Solflare, Backpack
- **TanStack Query** — server state
- **Zustand** — auth state (persisted)
- **Radix UI** — Dialog, Tabs, Tooltip primitives
- **Sonner** — toast notifications
- **Framer Motion** — only where needed

## Setup

```bash
npm install
cp .env.local.example .env.local
# Fill in your values
npm run dev
```

App runs on `http://localhost:3001`.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Hero, stats strip, bounty feed with filters |
| `/bounties/[id]` | Detail view with sidebar, register, claim |
| `/post` | 3-step bounty creation (repo → issue → details) |
| `/profile/[username]` | Posted/Hunting tabs with stats |
| `/leaderboard` | Top 50, podium for top 3, paginated |
| `/faucet` | Devnet airdrop (1 SOL + 10k USDC, 24h cooldown) |
| `/auth/callback` | GitHub OAuth landing |

## Backend integration

The backend's GitHub OAuth callback needs to redirect to the frontend instead
of returning JSON. In `github_auth.rs`:

```rust
let redirect_url = format!(
    "{}/auth/callback?token={}&github_username={}&email={}",
    std::env::var("FRONTEND_URL").unwrap_or("http://localhost:3001".into()),
    token,
    github_user.login,
    github_user.email.unwrap_or_default()
);
return Ok(Redirect::to(&redirect_url));
```

You'll also need to enrich the `/bounties` endpoint with `issue_title`,
`repo_name`, `languages`, `hunter_count`, `hunter_limit`. The `BountyRow`
component falls back gracefully when these are missing.

## Design language

- **One accent** — deep emerald for "earned/won"
- **Typography first** — Geist tight tracking on headings, tabular numbers for all amounts
- **Monospace for technical content** — wallet addresses, IDs, repo names
- **Subtle borders** — 1px ink-100/200 throughout
- **No shadows** — except focus rings and modals
- **Empty states that guide** — never just "no results"
- **Skeleton loaders** — match exact final layout

## Environment

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend URL |
| `NEXT_PUBLIC_PROGRAM_ID` | Deployed Anchor program ID |
| `NEXT_PUBLIC_USDC_MINT` | Test USDC mint address |
| `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` or `mainnet-beta` |

## License

MIT
