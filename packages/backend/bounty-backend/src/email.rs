use reqwest::Client;
use serde::Serialize;

#[derive(Serialize)]
struct EmailPayload<'a> {
    from: &'a str,
    to: Vec<&'a str>,
    subject: &'a str,
    html: String,
}

async fn send_email(
    client: &reqwest::Client,
    api_key: &str,
    to: &str,
    subject: &str,
    html: String,
) -> anyhow::Result<()> {
    let payload = EmailPayload {
        from: "OpenBounty <notifications@opebiyi.dev>",
        to: vec![to],
        subject,
        html,
    };

    let res = client
        .post("https://api.resend.com/emails")
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await?;

    if !res.status().is_success() {
        let body = res.text().await.unwrap_or_default();
        anyhow::bail!("Resend API error: {body}");
    }

    Ok(())
}

fn format_amount(amount: i64, token_mint: &Option<String>) -> String {
    if token_mint.is_none() {
        let value = amount as f64 / 1_000_000.0;
        format!("${:.2} (in SOL)", value)
    } else {
        let value = amount as f64 / 1_000_000.0;
        format!("{:.2} USDC", value)
    }
}

fn frontend_url() -> String {
    std::env::var("FRONTEND_URL").unwrap_or_else(|_| "https://openbounty.tech".to_string())
}

pub async fn send_bounty_posted(
    api_key: &str,
    poster_email: &str,
    poster_username: &str,
    bounty_id: i64,
    github_issue_url: &str,
    amount: i64,
    token_mint: Option<String>,
    client: &reqwest::Client,
) -> anyhow::Result<()> {
    let amount_str = format_amount(amount, &token_mint);
    let base = frontend_url();
    let bounty_url = format!("{base}/bounties/{bounty_id}");

    let html = format!(
        r#"
        <h2>Your bounty is live on OpenBounty</h2>
        <p>Hi {poster_username},</p>
        <p>Your bounty has been posted and is now open for hunters to register.</p>
        <p><strong>Amount:</strong> {amount_str}</p>
        <p><strong>GitHub Issue:</strong> <a href="{github_issue_url}">{github_issue_url}</a></p>
        <p>
          <a href="{bounty_url}" style="display:inline-block;padding:10px 20px;background:#09090b;color:white;text-decoration:none;border-radius:6px;font-size:14px;">
            View bounty
          </a>
        </p>
        <p style="color:#71717a;font-size:12px;">
          When a hunter opens a PR that closes your issue and it gets merged,
          OpenBounty will automatically select them as the winner.
        </p>
        "#,
    );

    send_email(client, api_key, poster_email, "Your bounty is live", html).await
}

pub async fn send_hunter_registered(
    api_key: &str,
    hunter_email: &str,
    hunter_username: &str,
    bounty_id: i64,
    github_issue_url: &str,
    amount: i64,
    token_mint: Option<String>,
    client: &reqwest::Client,
) -> anyhow::Result<()> {
    let amount_str = format_amount(amount, &token_mint);
    let base = frontend_url();
    let bounty_url = format!("{base}/bounties/{bounty_id}");

    // Extract issue number and repo from URL for the PR instruction
    let issue_ref = github_issue_url
        .split("/issues/")
        .nth(1)
        .unwrap_or("the issue");

    let repo = github_issue_url
        .trim_start_matches("https://github.com/")
        .split("/issues/")
        .next()
        .unwrap_or("the repository");

    let html = format!(
        r#"
        <h2>You're registered for a bounty</h2>
        <p>Hi {hunter_username},</p>
        <p>You have successfully registered for a <strong>{amount_str}</strong> bounty on OpenBounty.</p>
        <p><strong>Issue:</strong> <a href="{github_issue_url}">{github_issue_url}</a></p>
        <h3 style="margin-top:24px;">How to win</h3>
        <ol style="line-height:1.8;">
          <li>Fork or clone <strong>{repo}</strong></li>
          <li>Fix the issue linked above</li>
          <li>Open a pull request and include <code>Closes #{issue_ref}</code> in the PR description</li>
          <li>Get the PR merged, OpenBounty will automatically detect it and select you as winner</li>
          <li>Come back to OpenBounty to claim your reward</li>
        </ol>
        <p>
          <a href="{bounty_url}" style="display:inline-block;padding:10px 20px;background:#09090b;color:white;text-decoration:none;border-radius:6px;font-size:14px;">
            View bounty
          </a>
        </p>
        <p style="color:#71717a;font-size:12px;">
          Note: you must have registered before the PR is merged to be eligible.
        </p>
        "#,
    );

    send_email(
        client,
        api_key,
        hunter_email,
        "You're registered, here's how to win",
        html,
    )
    .await
}

pub async fn send_winner_notification(
    api_key: &str,
    winner_email: &str,
    winner_username: &str,
    bounty_id: i64,
    amount: i64,
    token_mint: Option<String>,
    client: &reqwest::Client,
) -> anyhow::Result<()> {
    let amount_str = format_amount(amount, &token_mint);
    let base = frontend_url();
    let bounty_url = format!("{base}/bounties/{bounty_id}");
    let profile_url = format!("{base}/profile/{winner_username}");

    let html = format!(
        r#"
        <h2>You won a bounty 🎉</h2>
        <p>Hi {winner_username},</p>
        <p>Your pull request was merged and you have been selected as the winner.</p>
        <p><strong>Prize:</strong> {amount_str}</p>
        <p>
          Your reward is locked in escrow and ready to claim.
          Connect the wallet you registered with to receive your funds.
        </p>
        <p>
          <a href="{bounty_url}" style="display:inline-block;padding:10px 20px;background:#059669;color:white;text-decoration:none;border-radius:6px;font-size:14px;margin-right:8px;">
            Claim reward
          </a>
          <a href="{profile_url}" style="display:inline-block;padding:10px 20px;background:#09090b;color:white;text-decoration:none;border-radius:6px;font-size:14px;">
            View profile
          </a>
        </p>
        <p style="color:#71717a;font-size:12px;">
          Make sure to connect the same wallet address you provided when registering for this bounty.
        </p>
        "#,
    );

    send_email(
        client,
        api_key,
        winner_email,
        "You won, claim your reward",
        html,
    )
    .await
}
