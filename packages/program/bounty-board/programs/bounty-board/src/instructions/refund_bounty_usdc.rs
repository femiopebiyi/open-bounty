use crate::{
    errors::BountyError,
    state::bounty_account::{BountyAccount, BountyStatus},
};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

#[derive(Accounts)]
pub struct RefundBountyUsdc<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bounty", bounty.poster.as_ref(), &bounty.bounty_id.to_le_bytes()],
        bump = bounty.bump,
        constraint = bounty.token_mint.is_some() @ BountyError::NotSplBounty,
    )]
    pub bounty: Account<'info, BountyAccount>,

    /// Bounty's escrow ATA
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = bounty,
        associated_token::token_program = token_program,
    )]
    pub bounty_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Poster's ATA — receives the refund
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = token_mint,
        associated_token::authority = poster,
        associated_token::token_program = token_program,
    )]
    pub poster_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: must match bounty.poster
    #[account(
        mut,
        constraint = poster.key() == bounty.poster @ BountyError::Unauthorized
    )]
    pub poster: AccountInfo<'info>,

    #[account(
        constraint = token_mint.key() == bounty.token_mint.unwrap() @ BountyError::WrongTokenMint
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn refund_bounty_usdc(ctx: Context<RefundBountyUsdc>) -> Result<()> {
    let bounty = &mut ctx.accounts.bounty;

    require!(bounty.status == BountyStatus::Open, BountyError::NotOpen);
    require!(
        bounty.expiry_date < Clock::get()?.unix_timestamp,
        BountyError::NotExpired
    );

    bounty.status = BountyStatus::Claimed;

    let amount = bounty.amount;
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
                to: ctx.accounts.poster_token_account.to_account_info(),
                mint: ctx.accounts.token_mint.to_account_info(),
                authority: bounty.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        ctx.accounts.token_mint.decimals,
    )?;

    Ok(())
}
