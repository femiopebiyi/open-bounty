use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::Redirect,
};
use serde::{Deserialize, Serialize};

use crate::{AppState, auth::issue_jwt};

// ── GET /auth/github ──────────────────────────────────────────────────────────

pub async fn github_login(State(state): State<AppState>) -> Redirect {
    let url = format!(
        "https://github.com/login/oauth/authorize?client_id={}&scope=read:user,user:email",
        state.github_client_id
    );
    Redirect::to(&url)
}

// ── GET /auth/github/callback ─────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CallbackQuery {
    pub code: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub github_username: String,
    pub email: Option<String>,
}

#[derive(Deserialize)]
struct GithubTokenResponse {
    access_token: String,
}

#[derive(Deserialize)]
struct GithubUser {
    login: String, // github username
    email: Option<String>,
}

pub async fn github_callback(
    State(state): State<AppState>,
    Query(params): Query<CallbackQuery>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    // 1. Exchange code for access token
    let client = reqwest::Client::new();

    let token_res = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .json(&serde_json::json!({
            "client_id": state.github_client_id,
            "client_secret": state.github_client_secret,
            "code": params.code,
        }))
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .json::<GithubTokenResponse>()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 2. Fetch GitHub user profile
    let github_user = client
        .get("https://api.github.com/user")
        .header(
            "Authorization",
            format!("Bearer {}", token_res.access_token),
        )
        .header("User-Agent", "bounty-board")
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .json::<GithubUser>()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 3. Upsert user into hunters table so every GitHub user has a record
    sqlx::query!(
        r#"
    INSERT INTO users (github_username, email)
    VALUES ($1, $2)
    ON CONFLICT (github_username)
    DO UPDATE SET email = COALESCE(EXCLUDED.email, users.email)
    "#,
        github_user.login,
        github_user.email,
    )
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 4. Issue JWT with github_username
    let token = issue_jwt(&github_user.login, &state.jwt_secret)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tracing::info!("{}", token);

    Ok(Json(AuthResponse {
        token,
        github_username: github_user.login,
        email: github_user.email,
    }))
}

use axum::Router;
use axum::routing::get;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/auth/github", get(github_login))
        .route("/auth/github/callback", get(github_callback))
}
