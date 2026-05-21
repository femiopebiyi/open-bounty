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
    #[account(mut, constraint = bounty.winner.unwrap() == winner.key() @BountyError::WrongWinner)]
    pub winner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bounty", bounty.poster.as_ref(), &bounty.bounty_id.to_le_bytes()],
        bump = bounty.bump,
    )]
    pub bounty: Account<'info, BountyAccount>,

    pub system_program: Program<'info, System>,
}

/// Backend calls this after verifying the PR was merged on GitHub.
/// The backend signs as the `authority` (a hot wallet you control).
pub fn claim_bounty_sol(ctx: Context<ClaimBountySol>) -> Result<()> {
    let bounty = &mut ctx.accounts.bounty;
    require!(bounty.status == BountyStatus::Open, BountyError::NotOpen);
    require!(
        bounty.expiry_date < Clock::get()?.unix_timestamp,
        BountyError::Expired
    );

    bounty.status = BountyStatus::Claimed;
    let amount = bounty.amount;

    // PDA signs to transfer SOL out of its own account → hunter
    let seeds = &[
        b"bounty",
        bounty.poster.as_ref(),
        &bounty.bounty_id.to_le_bytes(),
        &[bounty.bump],
    ];

    let signer_seeds = &[&seeds[..]];

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: bounty.to_account_info(),
                to: ctx.accounts.winner.to_account_info(),
            },
            signer_seeds,
        ),
        bounty.amount,
    )?;

    emit!(BountyClaimed {
        hunter: ctx.accounts.winner.key(),
        amount,
    });
    Ok(())
}
