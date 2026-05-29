use crate::AppState;
use axum::{Json, extract::State, http::StatusCode};
use serde::Serialize;

#[derive(Serialize)]
pub struct PollResponse {
    pub bounties_checked: usize,
}

pub async fn trigger_poll(
    State(state): State<AppState>,
) -> Result<Json<PollResponse>, (StatusCode, String)> {
    let count = crate::poller::poll_all_open_bounties(&state)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(PollResponse {
        bounties_checked: count,
    }))
}

pub fn router() -> axum::Router<AppState> {
    use axum::routing::post;
    axum::Router::new().route("/admin/poll", post(trigger_poll))
}
