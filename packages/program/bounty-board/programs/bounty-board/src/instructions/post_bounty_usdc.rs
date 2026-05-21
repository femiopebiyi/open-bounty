pub use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{
    errors::BountyError,
    state::bounty_account::{BountyAccount, BountyPosted, BountyStatus},
};

#[derive(Accounts)]
#[instruction(bounty_id: u64)]
pub struct PostBountyUSDC<'info> {
    #[account(mut)]
    pub poster: Signer<'info>,

    #[account(
        init,
        payer = poster,
        space = 8 + BountyAccount::SIZE,
        seeds = [b"bounty", poster.key().as_ref(), &bounty_id.to_le_bytes()],
        bump,
    )]
    pub bounty: Account<'info, BountyAccount>,

    #[account(
        mint::token_program = token_program
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = poster,
        associated_token::token_program = token_program
    )]
    pub poster_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = poster,
        associated_token::mint = token_mint,
        associated_token::authority = bounty,
        associated_token::token_program = token_program
    )]
    pub bounty_token_account: InterfaceAccount<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn post_bounty_usdc(
    ctx: Context<PostBountyUSDC>,
    bounty_id: u64,
    amount: u64, // raw USDC amount (6 decimals)
    expiry_date: i64,
) -> Result<()> {
    let bounty = &mut ctx.accounts.bounty;
    bounty.poster = ctx.accounts.poster.key();
    bounty.winner = None;
    bounty.bounty_id = bounty_id;
    bounty.amount_usd = amount; // 1 USDC ≈ $1, so same as microdollars
    bounty.amount = amount;
    bounty.token_mint = Some(ctx.accounts.token_mint.key());
    bounty.price_used = 0;
    bounty.price_expo = 0;
    bounty.status = BountyStatus::Open;
    bounty.bump = ctx.bumps.bounty;
    bounty.expiry_date = expiry_date;

    // CPI: transfer USDC from poster → bounty ATA
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.poster_token_account.to_account_info(),
                to: ctx.accounts.bounty_token_account.to_account_info(),
                authority: ctx.accounts.poster.to_account_info(),
                mint: ctx.accounts.token_mint.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.token_mint.decimals,
    )?;

    emit!(BountyPosted {
        bounty_id,
        poster: ctx.accounts.poster.key(),
        amount_usd: amount,
        amount_raw: amount,
        token_mint: Some(ctx.accounts.token_mint.key()),
    });
    Ok(())
}
