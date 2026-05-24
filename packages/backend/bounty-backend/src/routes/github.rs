// src/routes/github.rs

use crate::AppState;
use crate::auth::AuthUser;
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct RepoQuery {
    pub per_page: Option<u32>,
}

pub async fn get_user_repos(
    State(state): State<AppState>,
    AuthUser(github_username): AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let res = state
        .http_client
        .get("https://api.github.com/user/repos")
        .header("Authorization", format!("Bearer {}", state.github_token))
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
    let url = format!("https://api.github.com/repos/{}/{}/issues", owner, repo);

    let res = state
        .http_client
        .get(&url)
        .header("Authorization", format!("Bearer {}", state.github_token))
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
