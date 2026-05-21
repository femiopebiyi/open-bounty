use axum::{
    Json, Router,
    extract::{Query, State},
    http::StatusCode,
    routing::post,
};
use rand::Rng;
use serde::{Deserialize, Serialize};

use crate::{
    AppState,
    auth::{self, AuthUser},
};

// ── GET /auth/nonce?wallet=<pubkey> ───────────────────────────────────────────

#[derive(Deserialize)]
pub struct NonceQuery {
    pub wallet: String,
}

#[derive(Serialize)]
pub struct NonceResponse {
    pub nonce: String,
    pub message: String, // the full string the user must sign
}

pub async fn nonce(
    State(state): State<AppState>,
    Query(params): Query<NonceQuery>,
) -> Result<Json<NonceResponse>, (StatusCode, String)> {
    // Generate a random 32-byte nonce encoded as hex
    let raw: [u8; 32] = rand::thread_rng().r#gen();
    let nonce = hex::encode(raw);

    let message = format!(
        "authentication\nWallet: {}\nNonce: {}\n\nSign this message to log in.",
        params.wallet, nonce
    );

    // Store nonce in DB — expires in 5 minutes (set by migration default)
    sqlx::query!(
        "INSERT INTO nonces (wallet, nonce) VALUES ($1, $2)",
        params.wallet,
        nonce,
    )
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(NonceResponse { nonce, message }))
}

pub fn router() -> Router<AppState> {
    Router::new().route("/auth/nonce", axum::routing::get(nonce))
}
