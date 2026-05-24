use axum::{
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use hmac::{Hmac, Mac};
use serde::Deserialize;
use sha2::Sha256;

use crate::AppState;
use anyhow::anyhow;

// ── GitHub payload types ──────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct WebhookPayload {
    pub action: String,
    pub pull_request: Option<PullRequest>,
    pub repository: Repository,
}

#[derive(Deserialize)]
pub struct PullRequest {
    pub number: u64,
    pub merged: Option<bool>,
    pub merged_at: Option<String>, // ISO 8601 timestamp
    pub user: GitHubUser,
}

#[derive(Deserialize)]
pub struct Repository {
    pub full_name: String, // "owner/repo"
}

#[derive(Deserialize)]
pub struct GitHubUser {
    pub login: String,
}

#[derive(Deserialize)]
struct GraphQLResponse {
    data: GraphQLData,
}

#[derive(Deserialize)]
struct GraphQLData {
    repository: GraphQLRepository,
}

#[derive(Deserialize)]
struct GraphQLRepository {
    #[serde(rename = "pullRequest")]
    pull_request: Option<GraphQLPullRequest>,
}

#[derive(Deserialize)]
struct GraphQLPullRequest {
    #[serde(rename = "closingIssuesReferences")]
    closing_issues_references: ClosingIssues,
}

#[derive(Deserialize)]
struct ClosingIssues {
    nodes: Vec<IssueNode>,
}

#[derive(Deserialize)]
struct IssueNode {
    url: String,
}

// ── POST /webhooks/github ─────────────────────────────────────────────────────

pub async fn github_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> StatusCode {
    // 1. Verify HMAC-SHA256 signature
    if !verify_signature(&body, &state.gh_secret, &headers) {
        tracing::warn!("Invalid GitHub webhook signature");
        return StatusCode::UNAUTHORIZED;
    }

    tracing::info!("Webhook received");

    // 2. Parse payload
    let payload: WebhookPayload = match serde_json::from_slice(&body) {
        Ok(p) => p,
        Err(e) => {
            tracing::error!("Failed to parse webhook payload: {e}");
            return StatusCode::BAD_REQUEST;
        }
    };

    // 3. Only act on merged PRs
    let pr = match payload.pull_request {
        Some(pr) if payload.action == "closed" && pr.merged == Some(true) => pr,
        _ => return StatusCode::OK,
    };

    tracing::info!(
        "PR #{} merged by {} in {}",
        pr.number,
        pr.user.login,
        payload.repository.full_name
    );

    // 4. Get closing issues via GitHub GraphQL API
    let parts: Vec<&str> = payload.repository.full_name.split('/').collect();
    let (owner, repo) = match parts.as_slice() {
        [owner, repo] => (*owner, *repo),
        _ => {
            tracing::error!("Invalid repo full_name: {}", payload.repository.full_name);
            return StatusCode::OK;
        }
    };

    let issue_urls = match get_closing_issues(&state.github_token, owner, repo, pr.number).await {
        Ok(urls) => urls,
        Err(e) => {
            tracing::error!("Failed to fetch closing issues: {e}");
            return StatusCode::OK;
        }
    };

    if issue_urls.is_empty() {
        tracing::info!("PR #{} has no closing issues — skipping", pr.number);
        return StatusCode::OK;
    }

    // 5. Find matching bounty in database
    for issue_url in &issue_urls {
        let bounty = sqlx::query!(
            "SELECT bounty_id, github_username, wallet_pubkey, created_at, token_mint, amount_in_sol, usd_amount_at_the_time FROM bounties
     WHERE github_issue_url = $1 AND status = 'open'",
            issue_url,
        )
        .fetch_optional(&state.db)
        .await;

        let bounty = match bounty {
            Ok(Some(b)) => b,
            Ok(None) => {
                tracing::info!("No open bounty found for issue {issue_url}");
                continue;
            }
            Err(e) => {
                tracing::error!("DB error looking up bounty: {e}");
                continue;
            }
        };

        let bounty_token_mint = bounty.token_mint.clone();
        let bounty_amount_in_sol = bounty.amount_in_sol;
        let bounty_usd_amount = bounty.usd_amount_at_the_time;

        // Ensure PR was merged after the bounty was created
        if let Some(ref merged_at_str) = pr.merged_at {
            match chrono::DateTime::parse_from_rfc3339(merged_at_str) {
                Ok(merged_at) => {
                    if merged_at < bounty.created_at {
                        tracing::warn!(
                            "PR merged at {} but bounty {} was created at {} — skipping",
                            merged_at,
                            bounty.bounty_id,
                            bounty.created_at,
                        );
                        continue;
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to parse merged_at timestamp: {e}");
                    continue;
                }
            }
        } else {
            // merged_at should always be present on a merged PR — skip if missing
            tracing::warn!("PR #{} has no merged_at timestamp — skipping", pr.number);
            continue;
        }

        // 6. Find the hunter registration matching the PR author
        let hunter = sqlx::query!(
            "SELECT bh.payout_wallet, u.email
             FROM bounty_hunters bh
             JOIN users u ON u.github_username = bh.github_username
             WHERE bh.bounty_id = $1
               AND bh.github_username = $2",
            bounty.bounty_id,
            pr.user.login,
        )
        .fetch_optional(&state.db)
        .await;

        let hunter = match hunter {
            Ok(Some(h)) => h,
            Ok(None) => {
                tracing::warn!(
                    "PR author {} not registered for bounty {}",
                    pr.user.login,
                    bounty.bounty_id
                );
                continue;
            }
            Err(e) => {
                tracing::error!("DB error looking up hunter: {e}");
                continue;
            }
        };

        // 7. Call select_winner on-chain
        match crate::solana::select_winner::select_winner(
            &state.rpc_client,
            &state.authority,
            state.program_id,
            bounty.bounty_id as u64,
            &bounty.wallet_pubkey,
            &hunter.payout_wallet,
        )
        .await
        {
            Ok(sig) => {
                tracing::info!(
                    "select_winner called for bounty {}. Tx: {sig}",
                    bounty.bounty_id
                );

                // 8. Update bounty status in DB
                sqlx::query!(
                    "UPDATE bounties
                     SET status = 'winner_selected',
                         winner_github = $1,
                         winner_wallet = $2
                     WHERE bounty_id = $3",
                    pr.user.login,
                    hunter.payout_wallet,
                    bounty.bounty_id,
                )
                .execute(&state.db)
                .await
                .ok();

                // 9. Send email notification if hunter provided one
                if let Some(email) = hunter.email {
                    tracing::info!("TODO: send winner notification to {email}");
                    let state = state.clone();
                    let winner_username = pr.user.login.clone();
                    tokio::spawn(async move {
                        if let Err(e) = crate::email::send_winner_notification(
                            &state.resend_api_key,
                            &email,
                            &winner_username,
                            bounty.bounty_id,
                            if bounty_token_mint.is_none() {
                                bounty_amount_in_sol
                            } else {
                                bounty_usd_amount
                            }, // fetch usd amount if needed
                            bounty_token_mint,
                            &state.http_client,
                        )
                        .await
                        {
                            tracing::error!("Failed to send winner notification email: {e}");
                        }

                        tracing::info!("Email sent successfully!!");
                    });
                }
            }
            Err(e) => {
                tracing::error!("select_winner failed for bounty {}: {e}", bounty.bounty_id);
            }
        }
    }

    StatusCode::OK
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn verify_signature(body: &Bytes, secret: &str, headers: &HeaderMap) -> bool {
    let sig_header = match headers.get("X-Hub-Signature-256") {
        Some(v) => v.to_str().unwrap_or(""),
        None => return false,
    };

    let expected = match sig_header.strip_prefix("sha256=") {
        Some(s) => s,
        None => return false,
    };

    let mut mac =
        Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("HMAC accepts any key length");
    mac.update(body);
    let computed = hex::encode(mac.finalize().into_bytes());

    computed == expected
}

async fn get_closing_issues(
    token: &str,
    owner: &str,
    repo: &str,
    pr_number: u64,
) -> anyhow::Result<Vec<String>> {
    let query = format!(
        r#"{{
            "query": "{{ repository(owner: \"{owner}\", name: \"{repo}\") {{ pullRequest(number: {pr_number}) {{ closingIssuesReferences(first: 10) {{ nodes {{ url }} }} }} }} }}"
        }}"#
    );

    let client = reqwest::Client::new();
    let res = client
        .post("https://api.github.com/graphql")
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "bounty-board")
        .header("Content-Type", "application/json")
        .body(query)
        .send()
        .await?;

    // Log raw response before deserializing
    let text = res.text().await?;
    tracing::info!("GitHub GraphQL response: {text}");

    let res: GraphQLResponse = serde_json::from_str(&text)
        .map_err(|e| anyhow!("Failed to deserialize GraphQL response: {e}\nBody: {text}"))?;

    let urls = match res.data.repository.pull_request {
        None => {
            tracing::warn!("PR #{pr_number} not found in {owner}/{repo}");
            return Ok(vec![]);
        }
        Some(pr) => pr
            .closing_issues_references
            .nodes
            .into_iter()
            .map(|n| n.url)
            .collect(),
    };

    Ok(urls)
}

pub fn router() -> axum::Router<AppState> {
    use axum::routing::post;
    axum::Router::new().route("/webhooks/github", post(github_webhook))
}
