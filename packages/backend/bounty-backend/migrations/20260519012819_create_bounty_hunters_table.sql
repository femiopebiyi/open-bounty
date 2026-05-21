CREATE TABLE IF NOT EXISTS bounty_hunters (
    bounty_id BIGINT NOT NULL REFERENCES bounties(bounty_id),
    github_username TEXT NOT NULL REFERENCES users(github_username),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (bounty_id, github_username)
);