use anyhow::Result;
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use std::str::FromStr;

use crate::{
    AppState,
    auth::{self, AuthUser},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/bounties", get(list_all).post(create_bounty))
        .route("/bounties/register", post(register_for_bounty))
        .route("/bounties/poster/:github_username", get(list_by_poster))
}

#[derive(Deserialize)]
pub struct RegisterBountyRequest {
    pub bounty_id: i64,
    pub payout_wallet: String,
    pub alert_mail: Option<String>,
}

// ── Request / Response types ──────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct BountyRequest {
    pub bounty_id: i64,
    pub amount_in_sol: i64,
    pub usd_amount_at_the_time: i64,
    pub expiry_date: i64,
    pub github_issue_url: String,
    pub wallet: String,
    pub nonce: String,
    pub signature: String,
    pub tx_sig: String,
    pub token_mint: Option<String>,
    pub languages: Option<Vec<String>>, // new
    pub hunter_limit: Option<i32>,      // new
}

#[derive(Serialize)]
pub struct BountyResponse {
    pub bounty_id: i64,
    pub wallet_pubkey: String,
    pub github_username: String,
    pub amount_in_sol: i64,
    pub usd_amount_at_the_time: i64,
    pub expiry_date: i64,
    pub github_issue_url: String,
    pub status: String,
    pub winner_github: Option<String>,
    pub winner_wallet: Option<String>,
    pub token_mint: Option<String>,
    pub languages: Option<Vec<String>>, // new
    pub hunter_limit: Option<i32>,      // new
}

#[derive(Deserialize)]
pub struct ListAllQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Deserialize)]
pub struct ListByPosterQuery {
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// ── POST /bounties ────────────────────────────────────────────────────────────

async fn create_bounty(
    State(state): State<AppState>,
    AuthUser(github_username): AuthUser,
    Json(body): Json<BountyRequest>,
) -> Result<Json<BountyResponse>, (StatusCode, String)> {
    // 1. Look up nonce — must exist and not be expired
    let record = sqlx::query!(
        "SELECT wallet, nonce FROM nonces
         WHERE nonce = $1
           AND wallet = $2
           AND expires_at > now()",
        body.nonce,
        body.wallet,
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((
        StatusCode::UNAUTHORIZED,
        "Nonce not found or expired".to_string(),
    ))?;

    // 2. Verify wallet signature
    let message = format!(
        "authentication\nWallet: {}\nNonce: {}\n\nSign this message to log in.",
        record.wallet, record.nonce
    );
    auth::verify_wallet_signature(&body.wallet, &message, &body.signature)
        .map_err(|e| (StatusCode::UNAUTHORIZED, e.to_string()))?;

    // 3. Delete nonce — single use
    sqlx::query!("DELETE FROM nonces WHERE nonce = $1", body.nonce)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 4. Update wallet on users table — does not affect existing bounty wallets
    sqlx::query!(
        "UPDATE users SET wallet_pubkey = $1 WHERE github_username = $2",
        body.wallet,
        github_username,
    )
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let bounty_token_mint = body.token_mint.clone();

    // validate token_mint is a valid pubkey if provided
    if let Some(ref mint) = bounty_token_mint {
        solana_sdk::pubkey::Pubkey::from_str(mint).map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                "Invalid token mint address".to_string(),
            )
        })?;
    }

    let record = sqlx::query!(
        r#"
    INSERT INTO bounties
        (bounty_id, wallet_pubkey, github_username, amount_in_sol,
         usd_amount_at_the_time, expiry_date, github_issue_url,
         token_mint, tx_sig, languages, hunter_limit)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING
        bounty_id, wallet_pubkey, github_username, amount_in_sol,
        usd_amount_at_the_time, expiry_date, github_issue_url,
        status, winner_github, winner_wallet, token_mint,
        languages, hunter_limit
    "#,
        body.bounty_id,
        body.wallet,
        github_username,
        body.amount_in_sol,
        body.usd_amount_at_the_time,
        body.expiry_date,
        body.github_issue_url,
        body.token_mint,
        body.tx_sig,
        body.languages.as_deref(), // &Option<[String]>
        body.hunter_limit,
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // After successful insert
    let user = sqlx::query!(
        "SELECT email FROM users WHERE github_username = $1",
        github_username,
    )
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    if let Some(user) = user {
        if let Some(email) = user.email {
            tokio::spawn(async move {
                if let Err(e) = crate::email::send_bounty_posted(
                    &state.resend_api_key,
                    &email,
                    &github_username,
                    body.bounty_id,
                    &body.github_issue_url,
                    if bounty_token_mint.is_none() {
                        body.amount_in_sol
                    } else {
                        body.usd_amount_at_the_time
                    },
                    bounty_token_mint, // Option<String>
                    &state.http_client,
                )
                .await
                {
                    tracing::error!("Failed to send bounty posted email: {e}");
                }
                tracing::info!("Email sent successfully!!")
            });
        }
    }

    Ok(Json(BountyResponse {
        bounty_id: record.bounty_id,
        wallet_pubkey: record.wallet_pubkey,
        github_username: record.github_username,
        amount_in_sol: record.amount_in_sol,
        usd_amount_at_the_time: record.usd_amount_at_the_time,
        expiry_date: record.expiry_date,
        github_issue_url: record.github_issue_url,
        status: record.status,
        winner_github: record.winner_github,
        winner_wallet: record.winner_wallet,
        token_mint: record.token_mint,
        languages: record.languages,
        hunter_limit: record.hunter_limit,
    }))
}

// ── GET /bounties ─────────────────────────────────────────────────────────────

async fn list_all(
    State(state): State<AppState>,
    Query(params): Query<ListAllQuery>,
) -> Result<Json<Vec<BountyResponse>>, (StatusCode, String)> {
    let limit = params.limit.unwrap_or(20).min(100);
    let offset = params.offset.unwrap_or(0);

    let records = sqlx::query!(
        r#"
        SELECT
            bounty_id, wallet_pubkey, github_username, amount_in_sol,
            usd_amount_at_the_time, expiry_date, github_issue_url,
            status, winner_github, winner_wallet, token_mint,
            languages, hunter_limit
        FROM bounties
        WHERE status = 'open'
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        "#,
        limit,
        offset,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let bounties = records
        .into_iter()
        .map(|r| BountyResponse {
            bounty_id: r.bounty_id,
            wallet_pubkey: r.wallet_pubkey,
            github_username: r.github_username,
            amount_in_sol: r.amount_in_sol,
            usd_amount_at_the_time: r.usd_amount_at_the_time,
            expiry_date: r.expiry_date,
            github_issue_url: r.github_issue_url,
            status: r.status,
            winner_github: r.winner_github,
            winner_wallet: r.winner_wallet,
            token_mint: r.token_mint,
            languages: r.languages,
            hunter_limit: r.hunter_limit,
        })
        .collect();

    Ok(Json(bounties))
}

async fn list_by_poster(
    State(state): State<AppState>,
    Path(github_username): Path<String>,
    Query(params): Query<ListByPosterQuery>,
) -> Result<Json<Vec<BountyResponse>>, (StatusCode, String)> {
    let limit = params.limit.unwrap_or(20).min(100);
    let offset = params.offset.unwrap_or(0);

    let records = sqlx::query!(
        r#"
        SELECT
            bounty_id, wallet_pubkey, github_username, amount_in_sol,
            usd_amount_at_the_time, expiry_date, github_issue_url,
            status, winner_github, winner_wallet, token_mint,
            languages, hunter_limit
        FROM bounties
        WHERE github_username = $1
          AND ($4::text IS NULL OR status = $4)
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        "#,
        github_username,
        limit,
        offset,
        params.status,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let bounties = records
        .into_iter()
        .map(|r| BountyResponse {
            bounty_id: r.bounty_id,
            wallet_pubkey: r.wallet_pubkey,
            github_username: r.github_username,
            amount_in_sol: r.amount_in_sol,
            usd_amount_at_the_time: r.usd_amount_at_the_time,
            expiry_date: r.expiry_date,
            github_issue_url: r.github_issue_url,
            status: r.status,
            winner_github: r.winner_github,
            winner_wallet: r.winner_wallet,
            token_mint: r.token_mint,
            languages: r.languages,
            hunter_limit: r.hunter_limit,
        })
        .collect();

    Ok(Json(bounties))
}
async fn register_for_bounty(
    State(state): State<AppState>,
    AuthUser(github_username): AuthUser,
    Json(body): Json<RegisterBountyRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    // 1. Validate payout wallet is a legitimate Solana pubkey
    solana_sdk::pubkey::Pubkey::from_str(&body.payout_wallet).map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            "Invalid Solana wallet address".to_string(),
        )
    })?;

    // 2. Check bounty exists and is open, get poster username
    let bounty = sqlx::query!(
    "SELECT github_username, github_issue_url, token_mint, amount_in_sol, usd_amount_at_the_time FROM bounties WHERE bounty_id = $1 AND status = 'open'",
    body.bounty_id,
)
.fetch_optional(&state.db)
.await
.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
.ok_or((
    StatusCode::NOT_FOUND,
    "Bounty not found or not open".to_string(),
))?;

    let bounty_token_mint = bounty.token_mint.clone();
    let bounty_amount_in_sol = bounty.amount_in_sol;
    let bounty_usd_amount = bounty.usd_amount_at_the_time;

    // 3. Prevent poster from registering for their own bounty
    // if bounty.github_username == github_username {
    //     return Err((
    //         StatusCode::FORBIDDEN,
    //         "You cannot register for your own bounty".to_string(),
    //     ));
    // }

    // 4. Store alert email if provided
    if let Some(ref email) = body.alert_mail {
        sqlx::query!(
            "UPDATE users SET email = $1 WHERE github_username = $2",
            email,
            github_username,
        )
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    // 5. Register for bounty with payout wallet
    sqlx::query!(
        r#"
        INSERT INTO bounty_hunters (bounty_id, github_username, payout_wallet)
        VALUES ($1, $2, $3)
        ON CONFLICT (bounty_id, github_username) DO NOTHING
        "#,
        body.bounty_id,
        github_username,
        body.payout_wallet,
    )
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // After successful insert into bounty_hunters
    let user = sqlx::query!(
        "SELECT email FROM users WHERE github_username = $1",
        github_username,
    )
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    if let Some(user) = user {
        if let Some(email) = user.email {
            let state = state.clone();
            let github_username = github_username.clone();
            let github_issue_url = bounty.github_issue_url.clone();
            tokio::spawn(async move {
                if let Err(e) = crate::email::send_hunter_registered(
                    &state.resend_api_key,
                    &email,
                    &github_username,
                    body.bounty_id,
                    &github_issue_url,
                    if bounty_token_mint.is_none() {
                        bounty_amount_in_sol
                    } else {
                        bounty_usd_amount
                    },
                    bounty_token_mint,
                    &state.http_client,
                )
                .await
                {
                    tracing::error!("Failed to send hunter registered email: {e}");
                }
                tracing::info!("Email sent successfully!!")
            });
        }
    }

    Ok(StatusCode::CREATED)
}
