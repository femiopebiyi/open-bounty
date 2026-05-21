-- Add migration script here
CREATE TABLE bounties (
    bounty_id BIGINT PRIMARY KEY,
    wallet_pubkey TEXT NOT NULL,
    github_username TEXT NOT NULL DEFAULT '',
    amount_in_sol BIGINT NOT NULL,
    usd_amount_at_the_time BIGINT NOT NULL,
    expiry_date BIGINT NOT NULL,
    github_issue_url TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'open',
    winner_github TEXT,
    winner_wallet TEXT,
    tx_sig TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);