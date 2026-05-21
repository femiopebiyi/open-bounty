use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

use crate::{
    errors::BountyError,
    state::bounty_account::{BountyAccount, BountyPosted, BountyStatus},
};

#[derive(Accounts)]
#[instruction(bounty_id: u64)]
pub struct PostBountySol<'info> {
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

    pub price_update: Account<'info, PriceUpdateV2>,
    pub system_program: Program<'info, System>,
}

pub fn post_bounty_sol(
    ctx: Context<PostBountySol>,
    bounty_id: u64,
    amount_usd: u64,
    expiry_date: i64,
) -> Result<()> {
    let feed_id =
        get_feed_id_from_hex("0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d")?;

    let price_data = ctx
        .accounts
        .price_update
        .get_price_no_older_than(&Clock::get()?, 60, &feed_id)
        .map_err(|_| BountyError::StalePrice)?;

    require!(price_data.price > 0, BountyError::InvalidPrice);
    require!(
        price_data.conf < (price_data.price as u64) / 10,
        BountyError::LowConfidence
    );
    let expo = price_data.exponent;
    require!(expo < 0 && expo > -20, BountyError::InvalidExponent);

    let decimal_shift = 3i32 - expo;
    let scaling = 10u128.pow(decimal_shift as u32);
    let lamports = (amount_usd as u128)
        .checked_mul(scaling)
        .and_then(|v| v.checked_div(price_data.price as u128))
        .ok_or(BountyError::MathOverflow)?;
    require!(lamports <= u64::MAX as u128, BountyError::MathOverflow);
    let lamports = lamports as u64;

    let bounty = &mut ctx.accounts.bounty;
    bounty.poster = ctx.accounts.poster.key();
    bounty.winner = None;
    bounty.bounty_id = bounty_id;
    bounty.amount_usd = amount_usd;
    bounty.amount = lamports;
    bounty.token_mint = None; // <-- SOL marker
    bounty.price_used = price_data.price;
    bounty.price_expo = expo;
    bounty.status = BountyStatus::Open;
    bounty.bump = ctx.bumps.bounty;
    bounty.expiry_date = expiry_date;

    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.poster.to_account_info(),
                to: bounty.to_account_info(),
            },
        ),
        lamports,
    )?;

    emit!(BountyPosted {
        bounty_id,
        poster: ctx.accounts.poster.key(),
        amount_usd,
        amount_raw: lamports,
        token_mint: None,
    });
    Ok(())
}
