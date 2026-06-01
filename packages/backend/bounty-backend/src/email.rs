use serde::Serialize;

#[derive(Serialize)]
struct EmailPayload<'a> {
    from: &'a str,
    to: Vec<&'a str>,
    subject: &'a str,
    html: String,
    reply_to: &'a str,
}

async fn send_email(
    client: &reqwest::Client,
    api_key: &str,
    to: &str,
    subject: &str,
    html: String,
) -> anyhow::Result<()> {
    let payload = EmailPayload {
        from: "OpenBounty <notifications@openbounty.tech>",
        to: vec![to],
        subject,
        html,
        reply_to: "support@openbounty.tech",
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

fn wrap(content: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-text-size-adjust:100%;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;max-width:100%;">
<tr><td style="padding:24px 32px;border-bottom:1px solid #f4f4f5;">
  <span style="font-size:16px;font-weight:600;color:#09090b;">OpenBounty</span>
</td></tr>
<tr><td style="padding:32px;font-size:14px;color:#3f3f46;line-height:1.6;">
{content}
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #f4f4f5;background:#fafafa;">
  <p style="margin:0;font-size:11px;color:#a1a1aa;line-height:1.5;">
    This is a transactional email from <a href="https://openbounty.tech" style="color:#71717a;text-decoration:none;">OpenBounty</a> related to your account activity.
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"#
    )
}

fn btn(href: &str, label: &str, bg: &str) -> String {
    format!(
        r#"<a href="{href}" style="display:inline-block;padding:10px 20px;background:{bg};color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;mso-padding-alt:0;text-underline-color:{bg};">
<!--[if mso]><i style="letter-spacing:20px;mso-font-width:-100%;mso-text-raise:30pt;">&nbsp;</i><![endif]-->
<span style="mso-text-raise:15pt;">{label}</span>
<!--[if mso]><i style="letter-spacing:20px;mso-font-width:-100%;">&nbsp;</i><![endif]-->
</a>"#
    )
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
    let view_btn = btn(&bounty_url, "View bounty", "#09090b");

    let html = wrap(&format!(
        r#"<p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#09090b;">Your bounty is live</p>
<p style="margin:0 0 12px;">Hi {poster_username},</p>
<p style="margin:0 0 20px;">Your bounty of <strong>{amount_str}</strong> has been posted and is now open for hunters.</p>
<table style="margin:0 0 20px;width:100%;border:1px solid #e4e4e7;border-radius:8px;border-collapse:separate;">
<tr><td style="padding:12px 16px;font-size:13px;color:#71717a;">Issue</td></tr>
<tr><td style="padding:0 16px 12px;"><a href="{github_issue_url}" style="color:#09090b;font-size:13px;word-break:break-all;">{github_issue_url}</a></td></tr>
</table>
{view_btn}
<p style="margin:20px 0 0;font-size:13px;color:#71717a;">When a hunter opens a PR that closes your issue and it gets merged, OpenBounty automatically selects them as the winner.</p>"#
    ));

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
    let view_btn = btn(&bounty_url, "View bounty", "#09090b");

    let issue_ref = github_issue_url
        .split("/issues/")
        .nth(1)
        .unwrap_or("the issue");

    let repo = github_issue_url
        .trim_start_matches("https://github.com/")
        .split("/issues/")
        .next()
        .unwrap_or("the repository");

    let html = wrap(&format!(
        r#"<p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#09090b;">You're registered</p>
<p style="margin:0 0 12px;">Hi {hunter_username},</p>
<p style="margin:0 0 20px;">You're registered for a <strong>{amount_str}</strong> bounty. Here's how to win:</p>
<table style="margin:0 0 20px;width:100%;font-size:14px;">
<tr><td style="padding:6px 0;color:#3f3f46;">1. Fork <strong>{repo}</strong></td></tr>
<tr><td style="padding:6px 0;color:#3f3f46;">2. Fix <a href="{github_issue_url}" style="color:#09090b;">issue #{issue_ref}</a></td></tr>
<tr><td style="padding:6px 0;color:#3f3f46;">3. Open a PR with <code style="background:#f4f4f5;padding:2px 6px;border-radius:4px;font-size:13px;">Closes #{issue_ref}</code> in the description</td></tr>
<tr><td style="padding:6px 0;color:#3f3f46;">4. Get it merged — OpenBounty detects it automatically</td></tr>
<tr><td style="padding:6px 0;color:#3f3f46;">5. Come back to claim your reward</td></tr>
</table>
{view_btn}
<p style="margin:20px 0 0;font-size:13px;color:#71717a;">You must be registered before the PR merges to be eligible.</p>"#
    ));

    send_email(
        client,
        api_key,
        hunter_email,
        "You're registered — here's how to win",
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
    let claim_btn = btn(&bounty_url, "Claim reward", "#059669");
    let profile_btn = btn(&profile_url, "View profile", "#09090b");

    let html = wrap(&format!(
        r#"<p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#09090b;">You won!</p>
<p style="margin:0 0 12px;">Hi {winner_username},</p>
<p style="margin:0 0 12px;">Your PR was merged and you've been selected as the winner.</p>
<p style="margin:0 0 20px;">Your reward of <strong>{amount_str}</strong> is locked in escrow and ready to claim. Connect the same wallet you registered with.</p>
<table cellpadding="0" cellspacing="0" style="margin:0 0 4px;">
<tr><td style="padding-right:8px;">{claim_btn}</td><td>{profile_btn}</td></tr>
</table>"#
    ));

    send_email(
        client,
        api_key,
        winner_email,
        "You won — claim your reward",
        html,
    )
    .await
}
