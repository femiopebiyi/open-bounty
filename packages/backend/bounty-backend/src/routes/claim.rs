use axum::{Json, Router, extract::State, http::StatusCode, routing::post};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{AppState, auth::AuthUser};

pub fn router() -> Router<AppState> {
    Router::new().route("/bounties/claim", post(claim_bounty))
}

#[derive(Deserialize)]
pub struct ClaimRequest {
    pub bounty_id: i64,
}

#[derive(Serialize)]
pub struct ClaimResponse {
    pub tx_sig: String,
}

async fn claim_bounty(
    State(state): State<AppState>,
    AuthUser(github_username): AuthUser,
    Json(body): Json<ClaimRequest>,
) -> Result<Json<ClaimResponse>, (StatusCode, String)> {
    // 1. Fetch bounty — must be winner_selected status
    let bounty = sqlx::query!(
        r#"
        SELECT bounty_id, wallet_pubkey, winner_github, winner_wallet, token_mint
        FROM bounties
        WHERE bounty_id = $1
          AND status = 'winner_selected'
        "#,
        body.bounty_id,
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((
        StatusCode::NOT_FOUND,
        "Bounty not found or not in winner_selected state".to_string(),
    ))?;

    // 2. Confirm the caller is the winner
    if bounty.winner_github.as_deref() != Some(&github_username) {
        return Err((
            StatusCode::FORBIDDEN,
            "You are not the winner of this bounty".to_string(),
        ));
    }

    let winner_wallet = bounty.winner_wallet.ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        "Winner wallet not set".to_string(),
    ))?;

    // 3. Call claim on-chain
    let tx_sig = crate::solana::claim_bounty::claim_bounty(
        bounty.token_mint,
        &state.rpc_client,
        &state.authority,
        state.program_id,
        bounty.bounty_id as u64,
        &bounty.wallet_pubkey,
        &winner_wallet,
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 4. Update bounty status in DB
    sqlx::query!(
        "UPDATE bounties SET status = 'claimed', tx_sig = $1 WHERE bounty_id = $2",
        tx_sig,
        body.bounty_id,
    )
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ClaimResponse { tx_sig }))
}
