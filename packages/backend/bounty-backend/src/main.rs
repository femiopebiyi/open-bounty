use axum::{
    Router,
    routing::{get, post},
};
use solana_sdk::{pubkey::Pubkey, signature::Keypair, signer::Signer};
use std::{str::FromStr, sync::Arc};
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};

mod auth;
mod db;
mod email;
mod github;
mod routes;
mod solana;

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub rpc_client: Arc<solana_client::rpc_client::RpcClient>,
    pub authority: Arc<solana_sdk::signature::Keypair>, // loaded from env
    pub gh_secret: String,                              // GitHub webhook secret
    pub program_id: solana_sdk::pubkey::Pubkey,
    pub jwt_secret: String,
    pub github_client_id: String,
    pub github_client_secret: String,
    pub github_token: String,
    pub resend_api_key: String,
}

impl AsRef<String> for AppState {
    fn as_ref(&self) -> &String {
        &self.jwt_secret
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let rpc_url =
        std::env::var("RPC_URL").unwrap_or_else(|_| "https://api.devnet.solana.com".to_string());
    let jwt_secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let port = std::env::var("PORT").unwrap_or_else(|_| "3001".to_string());
    let authority =
        std::env::var("AUTHORITY_KEYPAIR_JSON").expect("AUTHORITY_KEYPAIR_JSON must be set");
    let program_id = std::env::var("PROGRAM_ID").expect("PROGRAM_ID must be set");
    let github_client_id = std::env::var("GITHUB_CLIENT_ID").expect("GITHUB_CLIENT_ID must be set");
    let gh_secret =
        std::env::var("GITHUB_WEBHOOK_SECRET").expect("GITHUB_WEBHOOK_SECRET must be set");
    let github_client_secret =
        std::env::var("GITHUB_CLIENT_SECRET").expect("GITHUB_CLIENT_SECRET must be set");
    let github_token = std::env::var("GITHUB_TOKEN").expect("GITHUB_TOKEN must be set");
    let resend_api_key = std::env::var("RESEND_API_KEY").expect("RESEND_API_KEY must be set");

    let db = db::connect(&database_url).await?;
    tracing::info!("Database connected!!!");

    let rpc = Arc::new(solana_client::rpc_client::RpcClient::new(rpc_url));
    tracing::info!("RPC client initialised");

    let bytes: Vec<u8> = serde_json::from_str(&authority)
        .expect("AUTHORITY_KEYPAIR_JSON must be a valid JSON array of bytes");

    let executor_keypair = Arc::new(
        Keypair::try_from(bytes.as_slice())
            .expect("Invalid keypair bytes in AUTHORITY_KEYPAIR_JSON"),
    );

    tracing::info!("Executor keypair loaded: {}", executor_keypair.pubkey());

    let state = AppState {
        db,
        rpc_client: rpc,
        authority: executor_keypair,
        gh_secret,
        program_id: Pubkey::from_str(&program_id)?,
        jwt_secret,
        github_client_id,
        github_client_secret,
        github_token,
        resend_api_key,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .merge(routes::bounties::router())
        .merge(routes::auth::router())
        .merge(routes::github_auth::router())
        .merge(routes::webhook::router())
        .merge(routes::claim::router())
        .layer(cors)
        .with_state(state);

    let addr = format!("0.0.0.0:{port}");
    let listener = TcpListener::bind(&addr).await?;
    tracing::info!("Board bounty backend listening on {addr}");

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health() -> &'static str {
    "ok"
}
