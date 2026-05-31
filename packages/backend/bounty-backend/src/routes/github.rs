use crate::{AppState, auth::AuthUser};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};

pub async fn get_user_repos(
    State(state): State<AppState>,
    AuthUser(github_username): AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Fetch the user's own GitHub access token
    let user = sqlx::query!(
        "SELECT github_access_token FROM users WHERE github_username = $1",
        github_username,
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::UNAUTHORIZED, "User not found".to_string()))?;

    let token = user.github_access_token.ok_or((
        StatusCode::UNAUTHORIZED,
        "No GitHub token — please sign in again".to_string(),
    ))?;

    let res = state
        .http_client
        .get("https://api.github.com/user/repos")
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "openbounty")
        .query(&[
            ("per_page", "100"),
            ("sort", "updated"),
            ("affiliation", "owner,collaborator"),
        ])
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(res))
}

pub async fn get_repo_issues(
    State(state): State<AppState>,
    AuthUser(github_username): AuthUser,
    Path((owner, repo)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = sqlx::query!(
        "SELECT github_access_token FROM users WHERE github_username = $1",
        github_username,
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::UNAUTHORIZED, "User not found".to_string()))?;

    let token = user.github_access_token.ok_or((
        StatusCode::UNAUTHORIZED,
        "No GitHub token — please sign in again".to_string(),
    ))?;

    let url = format!("https://api.github.com/repos/{}/{}/issues", owner, repo);

    let res = state
        .http_client
        .get(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "openbounty")
        .query(&[("state", "open"), ("per_page", "50")])
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(res))
}

pub fn router() -> axum::Router<AppState> {
    use axum::routing::get;
    axum::Router::new()
        .route("/github/repos", get(get_user_repos))
        .route("/github/repos/:owner/:repo/issues", get(get_repo_issues))
}
