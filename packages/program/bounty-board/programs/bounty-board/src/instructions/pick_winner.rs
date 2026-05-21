use anchor_lang::prelude::*;

use crate::{
    errors::BountyError,
    state::bounty_account::{BountyAccount, BountyStatus},
};

#[derive(Accounts)]
pub struct PickWinner<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[
        account(
            mut,
            seeds = [b"bounty", bounty.poster.as_ref(), &bounty.bounty_id.to_le_bytes()],
            bump = bounty.bump
        )
    ]
    pub bounty: Account<'info, BountyAccount>,
}

pub fn pick_winner(ctx: Context<PickWinner>, winner: Pubkey) -> Result<()> {
    let bounty = &mut ctx.accounts.bounty;

    require!(bounty.status == BountyStatus::Open, BountyError::NotOpen);

    bounty.winner = Some(winner);

    Ok(())
}
