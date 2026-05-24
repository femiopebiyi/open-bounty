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
        from: "Bounty Board <notifications@opebiyi.dev>", // use resend test domain until yours is verified
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
    let value = amount as f64 / 1_000_000_000.0;
    let unit = if token_mint.is_none() { "SOL" } else { "USDC" };
    format!("{:.2} {}", value, unit)
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
    let html = format!(
        r#"<h2>Bounty posted successfully</h2>
        <p>Hi {poster_username},</p>
        <p>Your bounty <strong>#{bounty_id}</strong> has been posted.</p>
        <p><strong>Issue:</strong> <a href="{github_issue_url}">{github_issue_url}</a></p>
        <p><strong>Amount:</strong> {amount_str}</p>
        <p>Hunters can now register and start working on it.</p>"#,
    );
    send_email(
        client,
        api_key,
        poster_email,
        "Your bounty has been posted",
        html,
    )
    .await
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
    let html = format!(
        r#"<h2>Bounty registration confirmed</h2>
        <p>Hi {hunter_username},</p>
        <p>You registered for bounty <strong>#{bounty_id}</strong>.</p>
        <p><strong>Issue:</strong> <a href="{github_issue_url}">{github_issue_url}</a></p>
        <p><strong>Prize:</strong> {amount_str}</p>
        <p>Fix the issue, open a PR with <code>Closes #{bounty_id}</code> in the description, and get it merged to win.</p>"#,
    );
    send_email(
        client,
        api_key,
        hunter_email,
        "You have registered for a bounty",
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
    let html = format!(
        r#"<h2>Congratulations! You won bounty #{bounty_id}</h2>
        <p>Hi {winner_username},</p>
        <p>Your PR was merged and you have been selected as the winner.</p>
        <p><strong>Prize:</strong> {amount_str}</p>
        <p><a href="https://yourdapp.com">Go to the app to claim your reward.</a></p>"#,
    );
    send_email(client, api_key, winner_email, "You won a bounty!", html).await
}
