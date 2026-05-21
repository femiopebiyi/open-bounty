CREATE TABLE IF NOT EXISTS users (
    github_username TEXT PRIMARY KEY,
    wallet_pubkey TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);