use anchor_lang::prelude::*;
mod errors;
mod instructions;
mod state;

use instructions::*;

declare_id!("GmfiX2zNev72AQSK9Lygrmg6yN135Y95Gj3evz3kQhWM");

#[program]
pub mod bounty_board {
    use super::*;

    pub fn post_bounty_sol(
        ctx: Context<PostBountySol>,
        bounty_id: u64,
        amount_usd: u64,
        expiry_date: i64,
    ) -> Result<()> {
        instructions::post_bounty_sol::post_bounty_sol(ctx, bounty_id, amount_usd, expiry_date)
    }
    pub fn post_bounty_usdc(
        ctx: Context<PostBountyUSDC>,
        bounty_id: u64,
        amount_usd: u64,
        expiry_date: i64,
    ) -> Result<()> {
        instructions::post_bounty_usdc::post_bounty_usdc(ctx, bounty_id, amount_usd, expiry_date)
    }

    pub fn pick_winner(ctx: Context<PickWinner>, winner: Pubkey) -> Result<()> {
        instructions::pick_winner::pick_winner(ctx, winner)
    }

    pub fn claim_bounty_sol(ctx: Context<ClaimBountySol>) -> Result<()> {
        instructions::claim_bounty_sol::claim_bounty_sol(ctx)
    }
    pub fn claim_bounty_usdc(ctx: Context<ClaimBountyUSDC>) -> Result<()> {
        instructions::claim_bounty_usdc::claim_bounty_usdc(ctx)
    }

    // inside #[program]
    pub fn post_bounty_test(
        ctx: Context<PostBountyTest>,
        bounty_id: u64,
        lamports: u64,
        expiry_date: i64,
    ) -> Result<()> {
        instructions::post_bounty_test::post_bounty_test(ctx, bounty_id, lamports, expiry_date)
    }

    pub fn close_bounty_test(ctx: Context<CloseBountyTest>, bounty_id: u64) -> Result<()> {
        instructions::close_bounty_test::close_bounty_test(ctx, bounty_id)
    }
}
