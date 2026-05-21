use crate::state::bounty_account::BountyAccount;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(bounty_id: u64)]
pub struct CloseBountyTest<'info> {
    #[account(mut)]
    pub poster: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bounty", poster.key().as_ref(), &bounty_id.to_le_bytes()],
        bump = bounty.bump,
        close = poster,
    )]
    pub bounty: Account<'info, BountyAccount>,

    pub system_program: Program<'info, System>,
}

pub fn close_bounty_test(_ctx: Context<CloseBountyTest>, _bounty_id: u64) -> Result<()> {
    Ok(())
}
