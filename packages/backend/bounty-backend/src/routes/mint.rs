use crate::AppState;
use axum::{Json, extract::State, http::StatusCode};
use serde::{Deserialize, Serialize};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    native_token::LAMPORTS_PER_SOL, pubkey::Pubkey, signature::Signer, system_instruction,
    transaction::Transaction,
};
use spl_associated_token_account::{
    get_associated_token_address, instruction::create_associated_token_account_idempotent,
};
use spl_token::instruction as token_instruction;
use std::str::FromStr;

const FAUCET_AMOUNT_SOL: u64 = 1 * LAMPORTS_PER_SOL;
const FAUCET_AMOUNT_USDC: u64 = 10_000 * 1_000_000; // 10,000 USDC (6 decimals)
const COOLDOWN_HOURS: i64 = 24;

#[derive(Deserialize)]
pub struct FaucetRequest {
    pub wallet: String,
}

#[derive(Serialize)]
pub struct FaucetResponse {
    pub sol_sig: String,
    pub usdc_sig: Option<String>,
}

pub async fn request_faucet(
    State(state): State<AppState>,
    Json(body): Json<FaucetRequest>,
) -> Result<Json<FaucetResponse>, (StatusCode, String)> {
    // 1. Validate wallet address
    let recipient = Pubkey::from_str(&body.wallet).map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            "Invalid wallet address".to_string(),
        )
    })?;

    // 2. Check 24hr cooldown in DB
    let last_claim = sqlx::query!(
        r#"
        SELECT claimed_at FROM faucet_claims
        WHERE wallet_pubkey = $1
        ORDER BY claimed_at DESC
        LIMIT 1
        "#,
        body.wallet,
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(record) = last_claim {
        let hours_since = chrono::Utc::now()
            .signed_duration_since(record.claimed_at)
            .num_hours();

        if hours_since < COOLDOWN_HOURS {
            let hours_left = COOLDOWN_HOURS - hours_since;
            return Err((
                StatusCode::TOO_MANY_REQUESTS,
                format!("Come back in {} hours", hours_left),
            ));
        }
    }

    // 3. Send SOL
    let sol_sig = send_sol(&state.rpc_client, &state.authority, &recipient)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tracing::info!("Faucet: sent 1 SOL to {} — {}", body.wallet, sol_sig);

    // 4. Send USDC if mint is configured
    let usdc_sig = if let Ok(mint_str) =
        std::env::var("NEXT_PUBLIC_USDC_MINT").or_else(|_| std::env::var("USDC_MINT"))
    {
        match Pubkey::from_str(&mint_str) {
            Ok(mint) => match send_usdc(&state.rpc_client, &state.authority, &recipient, &mint) {
                Ok(sig) => {
                    tracing::info!("Faucet: sent 10,000 USDC to {} — {}", body.wallet, sig);
                    Some(sig)
                }
                Err(e) => {
                    tracing::error!("USDC faucet failed: {e}");
                    None
                }
            },
            Err(_) => None,
        }
    } else {
        tracing::warn!("USDC_MINT not set — skipping USDC airdrop");
        None
    };

    // 5. Record the claim
    sqlx::query!(
        "INSERT INTO faucet_claims (wallet_pubkey) VALUES ($1)",
        body.wallet,
    )
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(FaucetResponse { sol_sig, usdc_sig }))
}

fn send_sol(
    client: &RpcClient,
    authority: &solana_sdk::signature::Keypair,
    recipient: &Pubkey,
) -> anyhow::Result<String> {
    let ix = system_instruction::transfer(&authority.pubkey(), recipient, FAUCET_AMOUNT_SOL);

    let blockhash = client.get_latest_blockhash()?;
    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&authority.pubkey()),
        &[authority],
        blockhash,
    );

    let sig = client.send_and_confirm_transaction(&tx)?;
    Ok(sig.to_string())
}

fn send_usdc(
    client: &RpcClient,
    authority: &solana_sdk::signature::Keypair,
    recipient: &Pubkey,
    mint: &Pubkey,
) -> anyhow::Result<String> {
    let authority_ata = get_associated_token_address(&authority.pubkey(), mint);
    let recipient_ata = get_associated_token_address(recipient, mint);

    // Create recipient ATA if it doesn't exist
    let create_ata_ix = create_associated_token_account_idempotent(
        &authority.pubkey(),
        recipient,
        mint,
        &spl_token::id(),
    );

    // Transfer USDC
    let transfer_ix = token_instruction::transfer(
        &spl_token::id(),
        &authority_ata,
        &recipient_ata,
        &authority.pubkey(),
        &[],
        FAUCET_AMOUNT_USDC,
    )?;

    let blockhash = client.get_latest_blockhash()?;
    let tx = Transaction::new_signed_with_payer(
        &[create_ata_ix, transfer_ix],
        Some(&authority.pubkey()),
        &[authority],
        blockhash,
    );

    let sig = client.send_and_confirm_transaction(&tx)?;
    Ok(sig.to_string())
}

pub fn router() -> axum::Router<AppState> {
    use axum::routing::post;
    axum::Router::new().route("/faucet", post(request_faucet))
}
