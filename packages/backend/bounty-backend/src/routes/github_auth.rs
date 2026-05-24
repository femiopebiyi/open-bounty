use axum::{
    Json, Router,
    extract::{Query, State},
    http::StatusCode,
    response::Redirect,
};
use serde::{Deserialize, Serialize};

use crate::{AppState, auth::issue_jwt};

pub async fn github_login(State(state): State<AppState>) -> Redirect {
    let url = format!(
        "https://github.com/login/oauth/authorize?client_id={}&scope=read:user,user:email",
        state.github_client_id
    );
    Redirect::to(&url)
}

#[derive(Deserialize)]
pub struct CallbackQuery {
    pub code: String,
}

#[derive(Deserialize)]
struct GithubTokenResponse {
    access_token: String,
}

#[derive(Deserialize)]
struct GithubUser {
    login: String,
    email: Option<String>,
}

pub async fn github_callback(
    State(state): State<AppState>,
    Query(params): Query<CallbackQuery>,
) -> Result<Redirect, (StatusCode, String)> {
    let frontend_url =
        std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3001".to_string());

    let client = state.http_client.clone();

    // 1. Exchange code for access token
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
        .header("User-Agent", "openbounty")
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .json::<GithubUser>()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 3. Upsert user
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

    // 4. Issue JWT
    let token = issue_jwt(&github_user.login, &state.jwt_secret)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 5. Redirect to frontend with token in query params
    let redirect_url = format!(
        "{}/auth/callback?token={}&github_username={}&email={}",
        frontend_url,
        token,
        github_user.login,
        github_user.email.unwrap_or_default()
    );

    tracing::info!(
        "GitHub login: {} → redirecting to frontend",
        github_user.login
    );

    Ok(Redirect::to(&redirect_url))
}

pub fn router() -> Router<AppState> {
    use axum::routing::get;
    Router::new()
        .route("/auth/github", get(github_login))
        .route("/auth/github/callback", get(github_callback))
}
