use anchor_lang::prelude::*;

#[account]
pub struct BountyAccount {
    pub poster: Pubkey,
    pub winner: Option<Pubkey>,
    pub bounty_id: u64,             // 8
    pub amount_usd: u64,            // 8  (microdollars, 6 decimals)
    pub amount: u64,                // 8  (raw token amount: lamports or micro-USDC)
    pub token_mint: Option<Pubkey>, // 33  (None = SOL, Some = SPL mint)
    pub price_used: i64,            // 8  (only meaningful for SOL)
    pub price_expo: i32,            // 4  (only meaningful for SOL)
    pub expiry_date: i64,           // 8
    pub status: BountyStatus,       // 1
    pub bump: u8,                   // 1
}

impl BountyAccount {
    pub const SIZE: usize = 32 + 33 + 8 + 8 + 8 + 33 + 8 + 4 + 8 + 1 + 1; // 144
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum BountyStatus {
    Open,
    Paused,
    Claimed,
    Disputed,
}

#[event]
pub struct BountyPosted {
    pub bounty_id: u64,
    pub poster: Pubkey,
    pub amount_usd: u64,
    pub amount_raw: u64, // renamed from amount_lamports
    pub token_mint: Option<Pubkey>,
}
#[event]
pub struct BountyClaimed {
    pub hunter: Pubkey,
    pub amount: u64,
}
