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

pub async fn select_winner(
    client: &RpcClient,
    authority: &Keypair,
    program_id: Pubkey,
    bounty_id: u64,
    poster: &str,
    winner_wallet: &str,
) -> anyhow::Result<String> {
    let poster_key = Pubkey::from_str(poster)?;
    let winner_key = Pubkey::from_str(winner_wallet)?;

    // Derive bounty PDA — must match seeds in PickWinner accounts
    let (bounty_pda, _bump) = Pubkey::find_program_address(
        &[b"bounty", poster_key.as_ref(), &bounty_id.to_le_bytes()],
        &program_id,
    );

    // Anchor discriminator: sha256("global:pick_winner")[..8]
    let discriminator = {
        let hash = Sha256::digest(b"global:pick_winner");
        hash[..8].to_vec()
    };

    // Instruction data = discriminator + winner pubkey (32 bytes)
    let mut data = discriminator;
    data.extend_from_slice(winner_key.as_ref());

    let ix = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(authority.pubkey(), true), // signer
            AccountMeta::new(bounty_pda, false),        // bounty PDA
        ],
        data,
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
