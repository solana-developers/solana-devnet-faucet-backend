-- Local-dev schema, inferred from src/db/*.js. Column types are a best guess;
-- verify against the production schema before using for anything beyond smoke tests.

CREATE SCHEMA IF NOT EXISTS faucet;

CREATE TABLE IF NOT EXISTS faucet.transactions (
    signature      TEXT PRIMARY KEY,
    ip_address     TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    github_id      TEXT,
    timestamp      BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS transactions_wallet_idx    ON faucet.transactions (wallet_address);
CREATE INDEX IF NOT EXISTS transactions_ip_idx        ON faucet.transactions (ip_address);
CREATE INDEX IF NOT EXISTS transactions_github_idx    ON faucet.transactions (github_id);
CREATE INDEX IF NOT EXISTS transactions_timestamp_idx ON faucet.transactions (timestamp DESC);

CREATE TABLE IF NOT EXISTS faucet.solana_balances (
    id      SERIAL PRIMARY KEY,
    account TEXT NOT NULL,
    balance NUMERIC NOT NULL,
    date    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS solana_balances_account_idx ON faucet.solana_balances (account);
CREATE INDEX IF NOT EXISTS solana_balances_date_idx    ON faucet.solana_balances (date DESC);
