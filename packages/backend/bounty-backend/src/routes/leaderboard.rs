use crate::AppState;
use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct LeaderboardQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Serialize)]
pub struct LeaderboardEntry {
    pub github_username: String,
    pub total_earned: i64,
    pub bounties_won: i64,
}

pub async fn get_leaderboard(
    State(state): State<AppState>,
    Query(params): Query<LeaderboardQuery>,
) -> Result<Json<Vec<LeaderboardEntry>>, (StatusCode, String)> {
    let limit = params.limit.unwrap_or(10).min(50);
    let offset = params.offset.unwrap_or(0);

    // Only count bounties that have been fully claimed
    // usd_amount_at_the_time is the source of truth for dollar value
    let records = sqlx::query!(
        r#"
    SELECT
        github_username,
        total_earned,
        bounties_won
    FROM (
        SELECT
            winner_github as github_username,
            SUM(usd_amount_at_the_time)::bigint as total_earned,
            COUNT(*)::bigint as bounties_won
        FROM bounties
        WHERE status = 'claimed'
          AND winner_github IS NOT NULL
        GROUP BY winner_github
    ) ranked
    ORDER BY total_earned DESC
    LIMIT $1 OFFSET $2
    "#,
        limit,
        offset,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let entries = records
        .into_iter()
        .map(|r| LeaderboardEntry {
            github_username: r.github_username.unwrap_or_default(),
            total_earned: r.total_earned.unwrap_or(0),
            bounties_won: r.bounties_won.unwrap_or(0),
        })
        .collect();

    Ok(Json(entries))
}

pub fn router() -> axum::Router<AppState> {
    use axum::routing::get;
    axum::Router::new().route("/leaderboard", get(get_leaderboard))
}
