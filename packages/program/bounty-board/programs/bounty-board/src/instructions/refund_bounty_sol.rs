use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

use crate::{
    errors::BountyError,
    state::bounty_account::{BountyAccount, BountyStatus},
};

#[derive(Accounts)]
pub struct RefundBounty<'info> {
    /// The original poster — receives the refund
    #[account(mut)]
    pub poster: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [b"bounty", bounty.poster.as_ref(), &bounty.bounty_id.to_le_bytes()],
        bump = bounty.bump,
        constraint = bounty.poster == poster.key() @ BountyError::Unauthorized,
        close = poster, // drains all lamports to poster after instruction
    )]
    pub bounty: Account<'info, BountyAccount>,

    /// Backend executor — the only key allowed to trigger refunds
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn refund_bounty(ctx: Context<RefundBounty>) -> Result<()> {
    let bounty = &mut ctx.accounts.bounty;

    // Must be open (not already claimed or winner selected)
    require!(bounty.status == BountyStatus::Open, BountyError::NotOpen);

    // Must be expired
    require!(
        bounty.expiry_date < Clock::get()?.unix_timestamp,
        BountyError::NotExpired
    );

    bounty.status = BountyStatus::Claimed; // reuse claimed to mark as settled

    // close = poster handles the actual SOL transfer
    Ok(())
}
