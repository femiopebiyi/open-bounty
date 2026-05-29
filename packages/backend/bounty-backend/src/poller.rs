use std::sync::Arc;
use tokio::time::{Duration, interval};

use crate::AppState;

const POLL_INTERVAL_SECS: u64 = 300; // 5 minutes

// ── Entry point — called once from main ──────────────────────────────────────

pub fn start(state: AppState) {
    tokio::spawn(async move {
        let mut ticker = interval(Duration::from_secs(POLL_INTERVAL_SECS));
        loop {
            ticker.tick().await;
            tracing::info!("Poller: starting poll cycle");
            match poll_all_open_bounties(&state).await {
                Ok(processed) => {
                    tracing::info!("Poller: cycle complete — {} bounties checked", processed)
                }
                Err(e) => tracing::error!("Poller: cycle failed — {e}"),
            }
        }
    });
}

// ── Main poll loop ────────────────────────────────────────────────────────────

pub async fn poll_all_open_bounties(state: &AppState) -> anyhow::Result<usize> {
    // Only fetch open bounties — status check is the first guard
    let bounties = sqlx::query!(
        r#"
        SELECT bounty_id, github_issue_url, wallet_pubkey, created_at
        FROM bounties
        WHERE status = 'open'
        "#
    )
    .fetch_all(&state.db)
    .await?;

    let count = bounties.len();

    for bounty in bounties {
        let result = check_bounty(
            state,
            bounty.bounty_id,
            &bounty.github_issue_url,
            &bounty.wallet_pubkey,
            bounty.created_at,
        )
        .await;

        if let Err(e) = result {
            // Log and continue — one failed bounty should not stop the loop
            tracing::error!("Poller: error checking bounty {} — {e}", bounty.bounty_id);
        }
    }

    process_expired_bounties(state).await?;

    Ok(count)
}

// ── Check a single bounty ─────────────────────────────────────────────────────

async fn check_bounty(
    state: &AppState,
    bounty_id: i64,
    issue_url: &str,
    poster_wallet: &str,
    bounty_created_at: chrono::DateTime<chrono::Utc>,
) -> anyhow::Result<()> {
    // Parse owner / repo / issue number from the stored URL
    let repo_info = parse_issue_url(issue_url)
        .ok_or_else(|| anyhow::anyhow!("Could not parse issue URL: {issue_url}"))?;

    tracing::debug!(
        "Poller: checking bounty {} → {}/{} issue #{}",
        bounty_id,
        repo_info.owner,
        repo_info.repo,
        repo_info.issue_number,
    );

    // Query GitHub GraphQL to see if this issue was closed by a merged PR
    let closing_pr = fetch_closing_pr(
        state,
        &repo_info.owner,
        &repo_info.repo,
        repo_info.issue_number,
    )
    .await?;

    let pr = match closing_pr {
        Some(p) => p,
        None => {
            tracing::debug!("Poller: bounty {} — issue still open", bounty_id);
            return Ok(());
        }
    };

    tracing::info!(
        "Poller: bounty {} — issue closed by PR #{} from @{}",
        bounty_id,
        pr.number,
        pr.author,
    );

    // Guard: PR must have been merged AFTER the bounty was posted
    // Prevents exploiting old merged PRs against newly created bounties
    if pr.merged_at < bounty_created_at {
        tracing::warn!(
            "Poller: bounty {} — PR merged ({}) before bounty was created ({}) — skipping",
            bounty_id,
            pr.merged_at,
            bounty_created_at,
        );
        return Ok(());
    }

    // Look up the hunter — PR author must be a registered hunter for this bounty
    let hunter = sqlx::query!(
        r#"
        SELECT bh.payout_wallet, u.email
        FROM bounty_hunters bh
        JOIN users u ON u.github_username = bh.github_username
        WHERE bh.bounty_id = $1
          AND bh.github_username = $2
        "#,
        bounty_id,
        pr.author,
    )
    .fetch_optional(&state.db)
    .await?;

    let hunter = match hunter {
        Some(h) => h,
        None => {
            tracing::warn!(
                "Poller: bounty {} — @{} is not a registered hunter — skipping",
                bounty_id,
                pr.author,
            );
            return Ok(());
        }
    };

    tracing::info!(
        "Poller: bounty {} — selecting @{} as winner, payout to {}",
        bounty_id,
        pr.author,
        hunter.payout_wallet,
    );

    // Call pick_winner on-chain
    let tx_sig = crate::solana::select_winner::select_winner(
        &state.rpc_client,
        &state.authority,
        state.program_id,
        bounty_id as u64,
        poster_wallet,
        &hunter.payout_wallet,
    )
    .await
    .map_err(|e| anyhow::anyhow!("pick_winner failed for bounty {bounty_id}: {e}"))?;

    tracing::info!(
        "Poller: bounty {} — pick_winner succeeded. Tx: {}",
        bounty_id,
        tx_sig,
    );

    // Update bounty status in DB
    // Do this AFTER the on-chain tx confirms to avoid status/chain mismatch
    sqlx::query!(
        r#"
        UPDATE bounties
        SET status       = 'winner_selected',
            winner_github = $1,
            winner_wallet = $2
        WHERE bounty_id  = $3
          AND status     = 'open'
        "#,
        pr.author,
        hunter.payout_wallet,
        bounty_id,
    )
    .execute(&state.db)
    .await?;

    tracing::info!(
        "Poller: bounty {} — DB updated to winner_selected",
        bounty_id
    );

    // Send winner notification email in background
    // Don't let email failure block or error the poll cycle
    if let Some(email) = hunter.email {
        let resend_key = state.resend_api_key.clone();
        let http_client = state.http_client.clone();
        let winner_username = pr.author.clone();

        tokio::spawn(async move {
            if let Err(e) = crate::email::send_winner_notification(
                &resend_key,
                &email,
                &winner_username,
                bounty_id,
                0,
                None,
                &http_client,
            )
            .await
            {
                tracing::error!(
                    "Poller: failed to send winner email for bounty {}: {e}",
                    bounty_id
                );
            } else {
                tracing::info!(
                    "Poller: winner notification sent to {} for bounty {}",
                    email,
                    bounty_id
                );
            }
        });
    } else {
        tracing::info!(
            "Poller: @{} has no email — skipping notification for bounty {}",
            pr.author,
            bounty_id,
        );
    }

    Ok(())
}

// ── GitHub GraphQL ────────────────────────────────────────────────────────────

struct RepoInfo {
    owner: String,
    repo: String,
    issue_number: u64,
}

struct ClosingPr {
    number: u64,
    author: String,
    merged_at: chrono::DateTime<chrono::Utc>,
}

fn parse_issue_url(url: &str) -> Option<RepoInfo> {
    // matches: https://github.com/owner/repo/issues/42
    let parts: Vec<&str> = url.trim_end_matches('/').split('/').collect();
    if parts.len() < 7 {
        return None;
    }
    let owner = parts[parts.len() - 4].to_string();
    let repo = parts[parts.len() - 3].to_string();
    let issue_number = parts[parts.len() - 1].parse().ok()?;

    Some(RepoInfo {
        owner,
        repo,
        issue_number,
    })
}

async fn fetch_closing_pr(
    state: &AppState,
    owner: &str,
    repo: &str,
    issue_number: u64,
) -> anyhow::Result<Option<ClosingPr>> {
    // Use the timeline CLOSED_EVENT to find which PR actually closed the issue.
    // This is more reliable than closingIssuesReferences (which goes PR → issues)
    // because we're going issues → PR.
    let query = serde_json::json!({
        "query": format!(
            r#"{{
                repository(owner: "{owner}", name: "{repo}") {{
                    issue(number: {issue_number}) {{
                        state
                        stateReason
                        timelineItems(first: 25, itemTypes: [CLOSED_EVENT]) {{
                            nodes {{
                                ... on ClosedEvent {{
                                    createdAt
                                    closer {{
                                        ... on PullRequest {{
                                            number
                                            merged
                                            mergedAt
                                            author {{
                                                login
                                            }}
                                        }}
                                    }}
                                }}
                            }}
                        }}
                    }}
                }}
            }}"#
        )
    });

    let res = state
        .http_client
        .post("https://api.github.com/graphql")
        .header("Authorization", format!("Bearer {}", state.github_token))
        .header("User-Agent", "openbounty-poller")
        .json(&query)
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    // Check for GraphQL errors
    if let Some(errors) = res["errors"].as_array() {
        if !errors.is_empty() {
            return Err(anyhow::anyhow!(
                "GitHub GraphQL error: {}",
                errors[0]["message"].as_str().unwrap_or("unknown")
            ));
        }
    }

    let issue = &res["data"]["repository"]["issue"];

    // Issue must be closed with COMPLETED reason (merged PR), not NOT_PLANNED (won't fix)
    let state_reason = issue["stateReason"].as_str().unwrap_or("");
    if issue["state"].as_str() != Some("CLOSED") || state_reason != "COMPLETED" {
        return Ok(None);
    }

    // Find the closing PR in the timeline
    let nodes = match issue["timelineItems"]["nodes"].as_array() {
        Some(n) => n,
        None => return Ok(None),
    };

    for node in nodes {
        let closer = &node["closer"];

        // Skip if closer is not a PR (could be a commit or direct close)
        if closer.is_null() || closer["merged"].is_null() {
            continue;
        }

        // Must be merged — not just closed
        if closer["merged"].as_bool() != Some(true) {
            continue;
        }

        let merged_at_str = match closer["mergedAt"].as_str() {
            Some(t) => t,
            None => continue,
        };

        let author = match closer["author"]["login"].as_str() {
            Some(a) => a,
            None => continue,
        };

        let number = closer["number"].as_u64().unwrap_or(0);

        let merged_at = chrono::DateTime::parse_from_rfc3339(merged_at_str)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .map_err(|e| anyhow::anyhow!("Failed to parse mergedAt: {e}"))?;

        return Ok(Some(ClosingPr {
            number,
            author: author.to_string(),
            merged_at,
        }));
    }

    // Issue is closed but not by a merged PR (e.g. closed manually)
    Ok(None)
}

async fn process_expired_bounties(state: &AppState) -> anyhow::Result<()> {
    let now = chrono::Utc::now().timestamp();

    let expired = sqlx::query!(
        r#"
        SELECT bounty_id, wallet_pubkey, token_mint
        FROM bounties
        WHERE status = 'open'
          AND expiry_date < $1
        "#,
        now,
    )
    .fetch_all(&state.db)
    .await?;

    if expired.is_empty() {
        return Ok(());
    }

    tracing::info!("Poller: {} expired bounties to refund", expired.len());

    for bounty in expired {
        tracing::info!(
            "Poller: refunding expired bounty {} — token_mint: {:?}",
            bounty.bounty_id,
            bounty.token_mint,
        );

        // Choose refund path based on token type
        let result = match &bounty.token_mint {
            Some(mint) => {
                // USDC refund
                crate::solana::refund_bounty::refund_bounty_usdc(
                    &state.rpc_client,
                    &state.authority,
                    state.program_id,
                    bounty.bounty_id as u64,
                    &bounty.wallet_pubkey,
                    mint,
                )
                .await
            }
            None => {
                // SOL refund
                crate::solana::refund_bounty::refund_bounty(
                    &state.rpc_client,
                    &state.authority,
                    state.program_id,
                    bounty.bounty_id as u64,
                    &bounty.wallet_pubkey,
                )
                .await
            }
        };

        match result {
            Ok(sig) => {
                tracing::info!("Poller: bounty {} refunded. Tx: {}", bounty.bounty_id, sig);

                sqlx::query!(
                    "UPDATE bounties SET status = 'expired' WHERE bounty_id = $1",
                    bounty.bounty_id,
                )
                .execute(&state.db)
                .await?;

                tracing::info!(
                    "Poller: bounty {} marked as expired in DB",
                    bounty.bounty_id
                );
            }
            Err(e) => {
                tracing::error!(
                    "Poller: refund failed for bounty {} — {e}",
                    bounty.bounty_id
                );
            }
        }
    }

    Ok(())
}
