import { describe, it } from 'node:test';
import assert from 'node:assert';
import { constants, daysSince, checkGithubAccount, checkTransactionHistory } from '../faucetEligibility.js';

const {
    GH_ACCOUNT_AGE_MINIMUM_DAYS,
    GH_MIN_PUBLIC_REPOS,
    GH_MIN_FOLLOWERS,
    TRANSACTION_IP_LIMIT,
    TRANSACTION_WALLET_LIMIT,
    TRANSACTION_GITHUB_LIMIT,
    TRANSACTION_MONTHLY_LIMIT,
} = constants;

describe('checkGithubAccount', () => {
    it('should accept a valid user', async () => {
        const client = makeGithubClient(validUser());
        const result = await checkGithubAccount(client, 123);
        assert.deepStrictEqual(result, { valid: true });
    });

    it('should reject non-User account types', async () => {
        const client = makeGithubClient({ ...validUser(), type: "Organization" });
        const result = await checkGithubAccount(client, 123);
        assert.strictEqual(result.valid, false);
        assert.match(result.reason, /type is not allowed/);
    });

    it('should reject accounts younger than 30 days', async () => {
        const client = makeGithubClient({ ...validUser(), created_at: daysAgo(10) });
        const result = await checkGithubAccount(client, 123);
        assert.strictEqual(result.valid, false);
        assert.match(result.reason, /too new/);
    });

    it('should accept account exactly at minimum age', async () => {
        const client = makeGithubClient({ ...validUser(), created_at: daysAgo(GH_ACCOUNT_AGE_MINIMUM_DAYS) });
        const result = await checkGithubAccount(client, 123);
        assert.deepStrictEqual(result, { valid: true });
    });

    it('should reject account one day under minimum age', async () => {
        const client = makeGithubClient({ ...validUser(), created_at: daysAgo(GH_ACCOUNT_AGE_MINIMUM_DAYS - 1) });
        const result = await checkGithubAccount(client, 123);
        assert.strictEqual(result.valid, false);
        assert.match(result.reason, /too new/);
    });

    it('should reject when created_at is malformed (age is NaN)', async () => {
        const client = makeGithubClient({ ...validUser(), created_at: "not-a-date" });
        const result = await checkGithubAccount(client, 123);
        assert.strictEqual(result.valid, false);
        assert.match(result.reason, /too new/);
    });

    it('should reject accounts with zero public repos', async () => {
        const client = makeGithubClient({ ...validUser(), public_repos: 0 });
        const result = await checkGithubAccount(client, 123);
        assert.strictEqual(result.valid, false);
        assert.match(result.reason, /too few public repos/);
    });

    it('should accept accounts with exactly minimum public repos', async () => {
        const client = makeGithubClient({ ...validUser(), public_repos: GH_MIN_PUBLIC_REPOS });
        const result = await checkGithubAccount(client, 123);
        assert.deepStrictEqual(result, { valid: true });
    });

    it('should accept accounts with exactly minimum followers', async () => {
        const client = makeGithubClient({ ...validUser(), followers: GH_MIN_FOLLOWERS });
        const result = await checkGithubAccount(client, 123);
        assert.deepStrictEqual(result, { valid: true });
    });

    it('should not leak thresholds or account details in rejection messages', async () => {
        const client = makeGithubClient({ ...validUser(), created_at: daysAgo(10) });
        const result = await checkGithubAccount(client, 123);
        assert.doesNotMatch(result.reason, /\d/);
    });

    it('should check type before age (returns type error for new org)', async () => {
        const client = makeGithubClient({
            ...validUser(),
            type: "Organization",
            created_at: daysAgo(1),
        });
        const result = await checkGithubAccount(client, 123);
        assert.match(result.reason, /type is not allowed/);
    });

    it('should reject with "not found" when GitHub returns 404', async () => {
        const err = new Error("not found"); err.status = 404;
        const client = { request: async () => { throw err; } };
        const result = await checkGithubAccount(client, 999);
        assert.strictEqual(result.valid, false);
        assert.match(result.reason, /not found/);
    });

    it('should rethrow 403 errors', async () => {
        const err = new Error("forbidden"); err.status = 403;
        const client = { request: async () => { throw err; } };
        await assert.rejects(
            () => checkGithubAccount(client, 123),
            { message: "forbidden" }
        );
    });

    it('should rethrow unexpected errors', async () => {
        const client = { request: async () => { throw new Error("network failure"); } };
        await assert.rejects(
            () => checkGithubAccount(client, 123),
            { message: "network failure" }
        );
    });

    it('should rethrow errors with unexpected status', async () => {
        const err = new Error("server error"); err.status = 500;
        const client = { request: async () => { throw err; } };
        await assert.rejects(
            () => checkGithubAccount(client, 123),
            { message: "server error" }
        );
    });
});

describe('checkTransactionHistory', () => {
    it('should accept when all counts are under limits', async () => {
        const db = makeTransactionsDb({ ip_count: "10", wallet_count: "10", github_count: "10" }, 5);
        const result = await checkTransactionHistory(db, "1.2.3.4", "wallet1", "gh1");
        assert.deepStrictEqual(result, { valid: true });
    });

    it('should reject when IP limit is reached', async () => {
        const db = makeTransactionsDb({ ip_count: String(TRANSACTION_IP_LIMIT) });
        const result = await checkTransactionHistory(db, "1.2.3.4", "wallet1", "gh1");
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.reason, "IP address limit exceeded");
    });

    it('should reject when IP limit is exceeded', async () => {
        const db = makeTransactionsDb({ ip_count: String(TRANSACTION_IP_LIMIT + 50) });
        const result = await checkTransactionHistory(db, "1.2.3.4", "wallet1", "gh1");
        assert.strictEqual(result.valid, false);
        assert.match(result.reason, /IP address limit/);
    });

    it('should accept at IP count just under limit', async () => {
        const db = makeTransactionsDb({ ip_count: String(TRANSACTION_IP_LIMIT - 1) });
        const result = await checkTransactionHistory(db, "1.2.3.4", "wallet1", "gh1");
        assert.deepStrictEqual(result, { valid: true });
    });

    it('should reject when wallet limit is reached', async () => {
        const db = makeTransactionsDb({ wallet_count: String(TRANSACTION_WALLET_LIMIT) });
        const result = await checkTransactionHistory(db, "1.2.3.4", "wallet1", "gh1");
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.reason, "Wallet address limit exceeded");
    });

    it('should reject when GitHub ID limit is reached', async () => {
        const db = makeTransactionsDb({ github_count: String(TRANSACTION_GITHUB_LIMIT) });
        const result = await checkTransactionHistory(db, "1.2.3.4", "wallet1", "gh1");
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.reason, "Github ID limit exceeded");
    });

    it('should reject when monthly combo limit is reached', async () => {
        const db = makeTransactionsDb({}, TRANSACTION_MONTHLY_LIMIT);
        const result = await checkTransactionHistory(db, "1.2.3.4", "wallet1", "gh1");
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.reason, "Monthly request limit exceeded");
    });

    it('should check IP before wallet (returns IP error when both exceeded)', async () => {
        const db = makeTransactionsDb({ ip_count: String(TRANSACTION_IP_LIMIT), wallet_count: String(TRANSACTION_WALLET_LIMIT) });
        const result = await checkTransactionHistory(db, "1.2.3.4", "wallet1", "gh1");
        assert.match(result.reason, /IP address limit/);
    });

    it('should not leak counts or thresholds in rejection messages', async () => {
        const db = makeTransactionsDb({ ip_count: String(TRANSACTION_IP_LIMIT) });
        const result = await checkTransactionHistory(db, "1.2.3.4", "wallet1", "gh1");
        assert.doesNotMatch(result.reason, /\d/);
    });

    it('should reject with NaN warning when stats return undefined', async () => {
        const db = {
            getTransactionStats: async () => ({ ip_count: undefined, wallet_count: "0", github_count: "0" }),
            getMonthlyTransactionStats: async () => 0,
        };
        const result = await checkTransactionHistory(db, "1.2.3.4", "wallet1", "gh1");
        assert.strictEqual(result.valid, false);
        assert.match(result.reason, /Unable to verify/);
    });

    it('should reject with NaN warning when comboCount is undefined', async () => {
        const db = {
            getTransactionStats: async () => ({ ip_count: "0", wallet_count: "0", github_count: "0" }),
            getMonthlyTransactionStats: async () => undefined,
        };
        const result = await checkTransactionHistory(db, "1.2.3.4", "wallet1", "gh1");
        assert.strictEqual(result.valid, false);
        assert.match(result.reason, /Unable to verify/);
    });

    it('should handle string-to-number coercion from DB', async () => {
        const db = makeTransactionsDb({ ip_count: String(TRANSACTION_IP_LIMIT), wallet_count: "0", github_count: "0" }, 0);
        const result = await checkTransactionHistory(db, "1.2.3.4", "wallet1", "gh1");
        assert.strictEqual(result.valid, false);
        assert.match(result.reason, /IP address limit/);
    });
});

describe('daysSince', () => {
    const now = new Date('2025-06-15T12:00:00Z');

    it('should return 0 for the same day', () => {
        assert.strictEqual(daysSince('2025-06-15T00:00:00Z', now), 0);
    });

    it('should return whole days elapsed', () => {
        assert.strictEqual(daysSince('2025-06-10T12:00:00Z', now), 5);
    });

    it('should floor partial days', () => {
        // 2 days and 23 hours ago → should be 2, not 3
        assert.strictEqual(daysSince('2025-06-12T13:00:00Z', now), 2);
    });

    it('should return 0 for a date less than 24h ago', () => {
        assert.strictEqual(daysSince('2025-06-15T00:00:01Z', now), 0);
    });

    it('should handle large spans', () => {
        assert.strictEqual(daysSince('2024-06-15T12:00:00Z', now), 365);
    });

    it('should accept a Date object as input', () => {
        assert.strictEqual(daysSince(new Date('2025-06-14T12:00:00Z'), now), 1);
    });

    it('should return NaN for invalid date input', () => {
        assert.ok(Number.isNaN(daysSince('not-a-date', now)));
    });
});

// --- Test helpers ---

function daysAgo(n) {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function makeGithubClient(userData) {
    return { request: async () => ({ data: userData }) };
}

function validUser() {
    return {
        type: "User",
        created_at: daysAgo(60),
        public_repos: 5,
        followers: 10,
    };
}

function makeTransactionsDb(stats = {}, comboCount = 0) {
    return {
        getTransactionStats: async () => ({
            ip_count: stats.ip_count ?? "0",
            wallet_count: stats.wallet_count ?? "0",
            github_count: stats.github_count ?? "0",
        }),
        getMonthlyTransactionStats: async () => comboCount,
    };
}
