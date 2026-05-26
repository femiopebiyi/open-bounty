use crate::AppState;
use axum::{Json, extract::State, http::StatusCode};
use serde::Serialize;

#[derive(Serialize)]
pub struct SolPriceResponse {
    pub usd_per_sol: f64,
    pub lamports_per_dollar: u64,
}

pub async fn get_sol_price(
    State(state): State<AppState>,
) -> Result<Json<SolPriceResponse>, (StatusCode, String)> {
    let res = state
        .http_client
        .get("https://price.jup.ag/v6/price?ids=SOL")
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let body = res
        .text()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let parsed: serde_json::Value = serde_json::from_str(&body).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to parse Jupiter response: {e} — body: {body}"),
        )
    })?;

    let usd_per_sol = parsed["data"]["SOL"]["price"].as_f64().ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        format!("Price field missing in response: {body}"),
    ))?;

    let lamports_per_dollar = ((1.0 / usd_per_sol) * 1_000_000_000.0) as u64;

    tracing::info!("SOL price: ${usd_per_sol:.2} — {lamports_per_dollar} lamports/dollar");

    Ok(Json(SolPriceResponse {
        usd_per_sol,
        lamports_per_dollar,
    }))
}

pub fn router() -> axum::Router<AppState> {
    use axum::routing::get;
    axum::Router::new().route("/price/sol", get(get_sol_price))
}
