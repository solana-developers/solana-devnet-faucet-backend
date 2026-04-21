import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { PostgreSqlContainer } from "@testcontainers/postgresql";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INIT_SQL_PATH = path.resolve(__dirname, "../../docker/init.sql");

/**
 * Boot a throwaway Postgres container, apply docker/init.sql, and return
 * a connection string + a pool for direct DB access from tests.
 */
export async function startPostgres() {
    const container = await new PostgreSqlContainer("postgres:16-alpine")
        .withDatabase("faucet")
        .withUsername("faucet")
        .withPassword("faucet")
        .start();

    const connectionString = container.getConnectionUri();
    const pool = new Pool({ connectionString });

    const initSql = await readFile(INIT_SQL_PATH, "utf8");
    await pool.query(initSql);

    return { container, connectionString, pool };
}

export async function truncateAll(pool) {
    await pool.query(
        "TRUNCATE faucet.transactions, faucet.solana_balances RESTART IDENTITY CASCADE"
    );
}

/**
 * Bulk-insert transaction rows directly via pool — bypasses the HTTP route
 * when seeding large fixtures (e.g. rate-limit scenarios).
 */
export async function seedTransactions(pool, rows) {
    if (rows.length === 0) return;
    const placeholders = rows
        .map((_, i) => `($${5 * i + 1}, $${5 * i + 2}, $${5 * i + 3}, $${5 * i + 4}, $${5 * i + 5})`)
        .join(",");
    const values = rows.flatMap((r) => [
        r.signature,
        r.ip_address,
        r.wallet_address,
        r.github_id ?? "",
        r.timestamp,
    ]);
    await pool.query(
        `INSERT INTO faucet.transactions (signature, ip_address, wallet_address, github_id, timestamp) VALUES ${placeholders}`,
        values
    );
}

/**
 * Fake GithubClient matching the shape that faucetEligibility.validGithubAccount
 * consumes: a single request() method returning { data }.
 */
export function fakeGithubClient(userData) {
    return {
        request: async () => ({ data: userData }),
    };
}

/**
 * Fake GithubClient that throws — used to simulate 404s and other failures.
 */
export function throwingGithubClient(status, message = "fake github error") {
    return {
        request: async () => {
            const err = new Error(message);
            err.status = status;
            throw err;
        },
    };
}

/**
 * A GitHub user payload that passes every eligibility check. Tests override
 * specific fields to trigger individual rejection paths.
 */
export function validUserData() {
    const thirtyOneDaysAgoIso = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    return {
        type: "User",
        created_at: thirtyOneDaysAgoIso,
        public_repos: 5,
        followers: 10,
    };
}

/**
 * A valid Solana base58 pubkey (44 chars) — meets the wallet_address regex.
 */
export const SAMPLE_WALLET = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
