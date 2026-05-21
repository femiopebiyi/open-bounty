use anyhow::anyhow;
use ed25519_dalek::{Signature, VerifyingKey};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};

// ── JWT Claims ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
}

// ── Issue a JWT ───────────────────────────────────────────────────────────────

pub fn issue_jwt(github_username: &str, secret: &str) -> anyhow::Result<String> {
    let now = chrono::Utc::now().timestamp() as usize;

    let claims = Claims {
        sub: github_username.to_string(),
        exp: now + 60 * 60 * 24 * 7,
        iat: now,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| anyhow!("JWT encode error: {e}"))
}

// ── Issue a JWT with wallet attached (after wallet linking) ───────────────────

// ── Verify a JWT ──────────────────────────────────────────────────────────────

pub fn verify_jwt(token: &str, secret: &str) -> anyhow::Result<Claims> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|e| anyhow!("JWT decode error: {e}"))
}

// ── Verify wallet signature ───────────────────────────────────────────────────

pub fn verify_wallet_signature(
    wallet_pubkey: &str,
    message: &str,
    signature_b58: &str,
) -> anyhow::Result<()> {
    let pubkey_bytes = bs58::decode(wallet_pubkey)
        .into_vec()
        .map_err(|e| anyhow!("Invalid pubkey base58: {e}"))?;

    let sig_bytes = bs58::decode(signature_b58)
        .into_vec()
        .map_err(|e| anyhow!("Invalid signature base58: {e}"))?;

    let verifying_key = VerifyingKey::from_bytes(
        pubkey_bytes
            .as_slice()
            .try_into()
            .map_err(|_| anyhow!("Pubkey must be 32 bytes"))?,
    )
    .map_err(|e| anyhow!("Invalid verifying key: {e}"))?;

    let signature = Signature::from_bytes(
        sig_bytes
            .as_slice()
            .try_into()
            .map_err(|_| anyhow!("Signature must be 64 bytes"))?,
    );

    verifying_key
        .verify_strict(message.as_bytes(), &signature)
        .map_err(|_| anyhow!("Signature verification failed"))
}

// ── Axum extractors ───────────────────────────────────────────────────────────

use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{StatusCode, request::Parts},
};

// Extracts github_username from JWT — works for everyone
pub struct AuthUser(pub String);

// Extracts github_username AND wallet — only works after wallet is linked

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
    S: AsRef<String>,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let claims = extract_claims(parts, state.as_ref())?;
        Ok(AuthUser(claims.sub))
    }
}

// Shared helper to pull and verify JWT from Authorization header
fn extract_claims(parts: &mut Parts, secret: &str) -> Result<Claims, (StatusCode, &'static str)> {
    let auth_header = parts
        .headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or((StatusCode::UNAUTHORIZED, "Missing Authorization header"))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or((StatusCode::UNAUTHORIZED, "Invalid Authorization format"))?;

    verify_jwt(token, secret).map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid or expired token"))
}
