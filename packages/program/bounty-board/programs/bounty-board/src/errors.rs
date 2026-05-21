use anchor_lang::prelude::*;

#[error_code]
pub enum BountyError {
    #[msg("Bounty is not in Open state")]
    NotOpen,
    #[msg("Signer is not poster or hunter")]
    Unauthorized,
    #[msg("Bounty has expired already")]
    Expired,
    #[msg("This address is not the winner of the bounty")]
    WrongWinner,
    #[msg("Pyth price is too old")]
    StalePrice,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Price confidence too low")]
    LowConfidence,
    #[msg("Invalid price exponent")]
    InvalidExponent,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid Token Mint")]
    InvalidMint,
    #[msg("Bounty is not an SPL token bounty")]
    NotSplBounty,
    #[msg("Wrong token mint for this bounty")]
    WrongTokenMint,
    #[msg("Hunter token account does not match winner")]
    WrongHunterAccount,
}
