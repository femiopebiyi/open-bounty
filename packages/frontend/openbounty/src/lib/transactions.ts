import {
  Connection,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import { getProgram, deriveBountyPda } from "./program";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// ── Fetch SOL price from backend ──────────────────────────────────────────────

const SOL_MINT = "So11111111111111111111111111111111111111112";

async function fetchSolPrice(): Promise<{ usd_per_sol: number; lamports_per_dollar: number }> {
  try {
    const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`);
    if (!res.ok) throw new Error("Jupiter API error");
    const data = await res.json();
    const usd_per_sol = data[SOL_MINT].usdPrice;
    const lamports_per_dollar = Math.floor((1.0 / usd_per_sol) * 1_000_000_000);
    return { usd_per_sol, lamports_per_dollar };
  } catch {
    console.warn("Using hardcoded SOL price fallback: $170");
    const usd_per_sol = 170;
    const lamports_per_dollar = Math.floor((1.0 / usd_per_sol) * 1_000_000_000);
    return { usd_per_sol, lamports_per_dollar };
  }
}

// ── Post SOL bounty ───────────────────────────────────────────────────────────

export async function postBountySol({
  connection,
  wallet,
  bountyId,
  amountUsd,   // microdollars (6 decimals)
  expiryDate,
  onStepChange,
}: {
  connection: Connection;
  wallet: AnchorWallet;
  bountyId: number;
  amountUsd: number;
  expiryDate: number;
  onStepChange: (step: number) => void;
}): Promise<string> {
  const program = getProgram(connection, wallet);
  const posterKey = wallet.publicKey;
  const [bountyPda] = deriveBountyPda(posterKey, bountyId);

  // Step 1: get current SOL price
  onStepChange(1);
  const { lamports_per_dollar } = await fetchSolPrice();

  // Convert microdollars → dollars → lamports
  const dollars = amountUsd / 1_000_000;
  const lamports = Math.floor(dollars * lamports_per_dollar);

  // Step 2: single wallet approval
  onStepChange(2);
  const tx = await program.methods
    .postBountyTest(
      new BN(bountyId),
      new BN(lamports),
      new BN(expiryDate)
    )
    .accounts({
      poster: posterKey,
      bounty: bountyPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc({ commitment: "confirmed" });

  onStepChange(3);
  return tx;
}

// ── Post USDC bounty ──────────────────────────────────────────────────────────

export async function postBountyUsdc({
  connection,
  wallet,
  bountyId,
  amount,      // raw USDC (6 decimals)
  expiryDate,
  tokenMint,
  onStepChange,
}: {
  connection: Connection;
  wallet: AnchorWallet;
  bountyId: number;
  amount: number;
  expiryDate: number;
  tokenMint: PublicKey;
  onStepChange: (step: number) => void;
}): Promise<string> {
  const program = getProgram(connection, wallet);
  const posterKey = wallet.publicKey;
  const [bountyPda] = deriveBountyPda(posterKey, bountyId);

  const posterTokenAccount = await getAssociatedTokenAddress(tokenMint, posterKey);
  const bountyTokenAccount = await getAssociatedTokenAddress(tokenMint, bountyPda, true);

  onStepChange(1);

  const tx = await program.methods
    .postBountyUsdc(new BN(bountyId), new BN(amount), new BN(expiryDate))
    .accounts({
      poster: posterKey,
      bounty: bountyPda,
      tokenMint,
      posterTokenAccount,
      bountyTokenAccount,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc({ commitment: "confirmed" });

  onStepChange(2);
  return tx;
}