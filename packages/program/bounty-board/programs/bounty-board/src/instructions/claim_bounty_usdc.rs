use anchor_lang::prelude::*;

use crate::{
    errors::BountyError,
    state::bounty_account::{BountyAccount, BountyClaimed, BountyStatus},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

#[derive(Accounts)]
pub struct ClaimBountyUSDC<'info> {
    /// Your backend hot wallet — pays for hunter ATA creation if needed
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bounty", bounty.poster.as_ref(), &bounty.bounty_id.to_le_bytes()],
        bump = bounty.bump,
        constraint = bounty.token_mint.is_some() @ BountyError::NotSplBounty,
    )]
    pub bounty: Account<'info, BountyAccount>,

    /// The escrow ATA owned by the bounty PDA
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = bounty,
        associated_token::token_program = token_program
    )]
    pub bounty_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Hunter's ATA — created automatically if it doesn't exist
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = token_mint,
        associated_token::authority = winner,
        associated_token::token_program = token_program
    )]
    pub hunter_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: verified against the `winner` arg and the hunter ATA owner
    #[account(mut, constraint = bounty.winner.unwrap() == winner.key() @ BountyError::WrongWinner)]
    pub winner: AccountInfo<'info>,

    #[account(
        constraint = token_mint.key() == bounty.token_mint.unwrap() @ BountyError::WrongTokenMint
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn claim_bounty_usdc(ctx: Context<ClaimBountyUSDC>) -> Result<()> {
    let bounty = &mut ctx.accounts.bounty;

    require!(bounty.status == BountyStatus::Open, BountyError::NotOpen);
    require!(
        bounty.expiry_date > Clock::get()?.unix_timestamp,
        BountyError::Expired
    );

    bounty.status = BountyStatus::Claimed;
    let amount = bounty.amount;

    // PDA signer seeds
    let seeds = &[
        b"bounty",
        bounty.poster.as_ref(),
        &bounty.bounty_id.to_le_bytes(),
        &[bounty.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.bounty_token_account.to_account_info(),
                to: ctx.accounts.hunter_token_account.to_account_info(),
                mint: ctx.accounts.token_mint.to_account_info(),
                authority: bounty.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        ctx.accounts.token_mint.decimals,
    )?;

    emit!(BountyClaimed {
        hunter: bounty.winner.unwrap(),
        amount,
    });

    Ok(())
}
