use resend_rs::{Resend, types::CreateEmailBaseOptions};

fn format_amount(amount: i64, token_mint: &Option<String>) -> String {
    let value = amount as f64 / 1_000_000.0;
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
) -> anyhow::Result<()> {
    let resend = Resend::new(api_key);
    let amount_str = format_amount(amount, &token_mint);

    let email = CreateEmailBaseOptions::new(
        "Bounty Board <notifications@yourdomain.com>",
        vec![poster_email],
        "Your bounty has been posted",
    )
    .with_html(&format!(
        r#"
        <h2>Bounty posted successfully</h2>
        <p>Hi {poster_username},</p>
        <p>Your bounty <strong>#{bounty_id}</strong> has been posted successfully.</p>
        <p><strong>Issue:</strong> <a href="{github_issue_url}">{github_issue_url}</a></p>
        <p><strong>Amount:</strong> {amount_str}</p>
        <p>Hunters can now register and start working on it.</p>
        "#,
    ));

    resend.emails.send(email).await?;
    Ok(())
}

pub async fn send_hunter_registered(
    api_key: &str,
    hunter_email: &str,
    hunter_username: &str,
    bounty_id: i64,
    github_issue_url: &str,
    amount: i64,
    token_mint: Option<String>,
) -> anyhow::Result<()> {
    let resend = Resend::new(api_key);
    let amount_str = format_amount(amount, &token_mint);

    let email = CreateEmailBaseOptions::new(
        "Bounty Board <notifications@yourdomain.com>",
        vec![hunter_email],
        "You have registered for a bounty",
    )
    .with_html(&format!(
        r#"
        <h2>Bounty registration confirmed</h2>
        <p>Hi {hunter_username},</p>
        <p>You have successfully registered for bounty <strong>#{bounty_id}</strong>.</p>
        <p><strong>Issue:</strong> <a href="{github_issue_url}">{github_issue_url}</a></p>
        <p><strong>Prize:</strong> {amount_str}</p>
        <p>Fix the issue, open a PR with <code>Closes #{bounty_id}</code> in the description, and get it merged to win.</p>
        "#,
    ));

    resend.emails.send(email).await?;
    Ok(())
}

pub async fn send_winner_notification(
    api_key: &str,
    winner_email: &str,
    winner_username: &str,
    bounty_id: i64,
    amount: i64,
    token_mint: Option<String>,
) -> anyhow::Result<()> {
    let resend = Resend::new(api_key);
    let amount_str = format_amount(amount, &token_mint);

    let email = CreateEmailBaseOptions::new(
        "Bounty Board <notifications@yourdomain.com>",
        vec![winner_email],
        "You won a bounty!",
    )
    .with_html(&format!(
        r#"
        <h2>Congratulations! You won bounty #{bounty_id}</h2>
        <p>Hi {winner_username},</p>
        <p>Your PR was merged and you have been selected as the winner.</p>
        <p><strong>Prize:</strong> {amount_str}</p>
        <p>Go back to the app and claim your reward.</p>
        "#,
    ));

    resend.emails.send(email).await?;
    Ok(())
}
