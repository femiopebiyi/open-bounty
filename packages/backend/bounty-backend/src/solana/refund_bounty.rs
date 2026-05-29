use anyhow::anyhow;
use sha2::{Digest, Sha256};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::Transaction,
};
use std::str::FromStr;

pub async fn refund_bounty(
    client: &RpcClient,
    authority: &Keypair,
    program_id: Pubkey,
    bounty_id: u64,
    poster_wallet: &str,
) -> anyhow::Result<String> {
    let poster_key = Pubkey::from_str(poster_wallet)?;

    let (bounty_pda, _bump) = Pubkey::find_program_address(
        &[b"bounty", poster_key.as_ref(), &bounty_id.to_le_bytes()],
        &program_id,
    );

    let discriminator = {
        let hash = Sha256::digest(b"global:refund_bounty");
        hash[..8].to_vec()
    };

    let ix = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(poster_key, false), // poster — receives refund
            AccountMeta::new(bounty_pda, false), // bounty PDA — closed
            AccountMeta::new_readonly(authority.pubkey(), true), // authority signer
            AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
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
        .map_err(|e| anyhow!("Refund transaction failed: {e}"))?;

    Ok(sig.to_string())
}

pub async fn refund_bounty_usdc(
    client: &RpcClient,
    authority: &Keypair,
    program_id: Pubkey,
    bounty_id: u64,
    poster_wallet: &str,
    token_mint: &str,
) -> anyhow::Result<String> {
    let poster_key = Pubkey::from_str(poster_wallet)?;
    let mint_key = Pubkey::from_str(token_mint)?;

    let (bounty_pda, _bump) = Pubkey::find_program_address(
        &[b"bounty", poster_key.as_ref(), &bounty_id.to_le_bytes()],
        &program_id,
    );

    let bounty_token_account =
        spl_associated_token_account::get_associated_token_address(&bounty_pda, &mint_key);

    let poster_token_account =
        spl_associated_token_account::get_associated_token_address(&poster_key, &mint_key);

    let discriminator = {
        let hash = Sha256::digest(b"global:refund_bounty_usdc");
        hash[..8].to_vec()
    };

    let ix = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(authority.pubkey(), true),
            AccountMeta::new(bounty_pda, false),
            AccountMeta::new(bounty_token_account, false),
            AccountMeta::new(poster_token_account, false),
            AccountMeta::new(poster_key, false),
            AccountMeta::new_readonly(mint_key, false),
            AccountMeta::new_readonly(spl_associated_token_account::ID, false),
            AccountMeta::new_readonly(spl_token::ID, false),
            AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
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
        .map_err(|e| anyhow!("USDC refund transaction failed: {e}"))?;

    Ok(sig.to_string())
}
