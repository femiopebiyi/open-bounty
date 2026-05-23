use std::str::FromStr;

use anyhow::anyhow;
use axum::http::StatusCode;
use sha2::{Digest, Sha256};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::Transaction,
};

use spl_associated_token_account::ID as ASSOCIATED_TOKEN_PROGRAM_ID;
use spl_associated_token_account::get_associated_token_address;
use spl_token::ID as TOKEN_PROGRAM_ID;

pub async fn claim_bounty(
    token_mint: Option<String>,
    client: &RpcClient,
    authority: &Keypair,
    program_id: Pubkey,
    bounty_id: u64,
    poster: &str,
    winner_wallet: &str,
) -> anyhow::Result<String> {
    match token_mint {
        Some(mint) => {
            claim_bounty_usdc(
                client,
                authority,
                program_id,
                bounty_id,
                poster,
                winner_wallet,
                &mint,
            )
            .await
        }
        None => {
            claim_bounty_sol(
                client,
                authority,
                program_id,
                bounty_id,
                poster,
                winner_wallet,
            )
            .await
        }
    }
}

pub async fn claim_bounty_sol(
    client: &RpcClient,
    authority: &Keypair,
    program_id: Pubkey,
    bounty_id: u64,
    poster: &str,
    winner_wallet: &str,
) -> anyhow::Result<String> {
    let winner_key = Pubkey::from_str(winner_wallet)?;
    let poster_key = Pubkey::from_str(poster)?;

    let (bounty_pda, _bump) = Pubkey::find_program_address(
        &[b"bounty", poster_key.as_ref(), &bounty_id.to_le_bytes()],
        &program_id,
    );

    // Discriminator for claim_bounty_sol
    let discriminator = {
        let hash = Sha256::digest(b"global:claim_bounty_sol");
        hash[..8].to_vec()
    };

    let ix = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(authority.pubkey(), true), // authority — mut signer
            AccountMeta::new(bounty_pda, false),        // bounty PDA — mut
            AccountMeta::new(winner_key, false),        // winner — mut
        ],
        data: discriminator,
    };

    let blockhash = client
        .get_latest_blockhash()
        .map_err(|e| anyhow!("Failed to get blockhash: {e}"))?;

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&authority.pubkey()),
        &[authority],
        blockhash,
    );

    let sig = client
        .send_and_confirm_transaction(&tx)
        .map_err(|e| anyhow!("Transaction failed: {e}"))?;

    Ok(sig.to_string())
}

pub async fn claim_bounty_usdc(
    client: &RpcClient,
    authority: &Keypair,
    program_id: Pubkey,
    bounty_id: u64,
    poster: &str,
    winner_wallet: &str,
    token_mint: &str,
) -> anyhow::Result<String> {
    let poster_key = Pubkey::from_str(poster)?;
    let winner_key = Pubkey::from_str(winner_wallet)?;
    let mint_key = Pubkey::from_str(token_mint)?;

    // Derive bounty PDA
    let (bounty_pda, _bump) = Pubkey::find_program_address(
        &[b"bounty", poster_key.as_ref(), &bounty_id.to_le_bytes()],
        &program_id,
    );

    // Derive bounty's ATA (holds the USDC)
    let bounty_token_account = get_associated_token_address(&bounty_pda, &mint_key);

    // Derive winner's ATA (will be created if it doesn't exist)
    let hunter_token_account = get_associated_token_address(&winner_key, &mint_key);

    // Discriminator for claim_bounty_usdc
    let discriminator = {
        let hash = Sha256::digest(b"global:claim_bounty_usdc");
        hash[..8].to_vec()
    };

    let ix = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(authority.pubkey(), true),    // authority
            AccountMeta::new(bounty_pda, false),           // bounty
            AccountMeta::new(bounty_token_account, false), // bounty_token_account
            AccountMeta::new(hunter_token_account, false), // hunter_token_account
            AccountMeta::new(winner_key, false),           // winner
            AccountMeta::new_readonly(mint_key, false),    // token_mint
            AccountMeta::new_readonly(ASSOCIATED_TOKEN_PROGRAM_ID, false), // associated_token_program
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),            // token_program
            AccountMeta::new_readonly(solana_sdk::system_program::id(), false), // system_program
        ],
        data: discriminator,
    };

    let blockhash = client
        .get_latest_blockhash()
        .map_err(|e| anyhow!("Failed to get blockhash: {e}"))?;

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&authority.pubkey()),
        &[authority],
        blockhash,
    );

    let sig = client
        .send_and_confirm_transaction(&tx)
        .map_err(|e| anyhow!("Transaction failed: {e}"))?;

    Ok(sig.to_string())
}
