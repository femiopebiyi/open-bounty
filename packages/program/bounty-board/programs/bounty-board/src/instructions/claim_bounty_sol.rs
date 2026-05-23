use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

use crate::{
    errors::BountyError,
    state::bounty_account::{BountyAccount, BountyClaimed, BountyStatus},
};

#[derive(Accounts)]
pub struct ClaimBountySol<'info> {
    /// Your backend's hot wallet — the only key allowed to trigger payouts
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bounty", bounty.poster.as_ref(), &bounty.bounty_id.to_le_bytes()],
        bump = bounty.bump,
    )]
    pub bounty: Account<'info, BountyAccount>,

    /// CHECK: verified against the `winner` arg and the hunter ATA owner
    #[account(mut, constraint = bounty.winner.unwrap() == winner.key() @ BountyError::WrongWinner)]
    pub winner: AccountInfo<'info>,
}

pub fn claim_bounty_sol(ctx: Context<ClaimBountySol>) -> Result<()> {
    let bounty = &mut ctx.accounts.bounty;
    require!(bounty.status == BountyStatus::Open, BountyError::NotOpen);
    require!(
        bounty.expiry_date > Clock::get()?.unix_timestamp,
        BountyError::Expired
    );

    bounty.status = BountyStatus::Claimed;
    let amount = bounty.amount;

    let bounty_lamports = bounty.to_account_info().lamports();
    let winner_lamports = ctx.accounts.winner.lamports();

    **bounty.to_account_info().try_borrow_mut_lamports()? = bounty_lamports
        .checked_sub(amount)
        .ok_or(BountyError::MathOverflow)?;

    **ctx.accounts.winner.try_borrow_mut_lamports()? = winner_lamports
        .checked_add(amount)
        .ok_or(BountyError::MathOverflow)?;

    emit!(BountyClaimed {
        hunter: ctx.accounts.winner.key(),
        amount,
    });

    Ok(())
}
