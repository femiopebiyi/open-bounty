use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

use crate::state::bounty_account::{BountyAccount, BountyStatus};

#[derive(Accounts)]
#[instruction(bounty_id: u64)]
pub struct PostBountyTest<'info> {
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

    pub system_program: Program<'info, System>,
}

pub fn post_bounty_test(
    ctx: Context<PostBountyTest>,
    bounty_id: u64,
    lamports: u64,
    expiry_date: i64,
) -> Result<()> {
    let bounty = &mut ctx.accounts.bounty;
    bounty.poster = ctx.accounts.poster.key();
    bounty.winner = None;
    bounty.bounty_id = bounty_id;
    bounty.amount_usd = 0;
    bounty.amount = lamports;
    bounty.token_mint = None;
    bounty.price_used = 0;
    bounty.price_expo = 0;
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

    Ok(())
}
