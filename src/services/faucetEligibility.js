/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the validation passed
 * @property {string} [reason] - Human-readable rejection reason (present when valid is false)
 */

/** @typedef {{ request: (endpoint: string, params: object) => Promise<{ data: object }> }} GithubClient */

/**
 * @typedef {Object} TransactionsDb
 * @property {(params: {ip_address: string, wallet_address: string, github_id: string}) => Promise<{ip_count: string, wallet_count: string, github_count: string}>} getTransactionStats
 * @property {(params: {ip_address: string, wallet_address: string, github_id: string}) => Promise<number>} getMonthlyTransactionStats
 */

const GH_ACCOUNT_AGE_MINIMUM_DAYS = 30;
const GH_MIN_PUBLIC_REPOS = 1;
const GH_MIN_FOLLOWERS = 0; // Intentionally 0 — threshold may be raised later

const TRANSACTION_IP_LIMIT = 300;
const TRANSACTION_WALLET_LIMIT = 200;
const TRANSACTION_GITHUB_LIMIT = 200;
const TRANSACTION_MONTHLY_LIMIT = 100;


/** Exported for use in tests. */
export const constants = {
    GH_ACCOUNT_AGE_MINIMUM_DAYS,
    GH_MIN_PUBLIC_REPOS,
    GH_MIN_FOLLOWERS,
    TRANSACTION_IP_LIMIT,
    TRANSACTION_WALLET_LIMIT,
    TRANSACTION_GITHUB_LIMIT,
    TRANSACTION_MONTHLY_LIMIT,
};

/**
 * Validates a GitHub account against faucet eligibility rules.
 * Checks (in order): account type, age, public repos, followers.
 * Returns on the first failing check.
 *
 * @param {GithubClient} githubClient - GitHub API client (injected for testability)
 * @param {string} github_id - GitHub user ID to validate
 * @returns {Promise<ValidationResult>}
 */
export const validGithubAccount = async (githubClient, github_id) => {
    let userData;
    try {
        const response = await githubClient.request(
            "GET /user/{user_id}",
            { user_id: github_id }
        );
        userData = response.data;
    } catch (err) {
        if (err.status === 404) {
            return { valid: false, reason: "Github account not found" };
        }
        throw err;
    }

    if (userData.type !== "User") {
        return { valid: false, reason: "Github account type is not allowed" };
    }
    const accountAge = daysSince(userData.created_at);
    if (Number.isNaN(accountAge) || accountAge < GH_ACCOUNT_AGE_MINIMUM_DAYS) {
        return { valid: false, reason: "Github account is too new" };
    }
    if (userData.public_repos < GH_MIN_PUBLIC_REPOS) {
        return { valid: false, reason: "Github account has too few public repos" };
    }
    if (userData.followers < GH_MIN_FOLLOWERS) {
        return { valid: false, reason: "Github account has too few followers" };
    }

    return { valid: true };
};

/**
 * Validates that a requestor has not exceeded any faucet rate limits.
 * Checks all-time limits per IP, wallet, and GitHub ID, plus a 30-day
 * rolling limit on the specific IP+wallet+GitHub combination.
 * Returns on the first failing check.
 *
 * @param {TransactionsDb} transactions - Database access layer (injected for testability)
 * @param {string} ip_address - Requestor's IP address
 * @param {string} wallet_address - Solana wallet address
 * @param {string} github_id - GitHub user ID
 * @returns {Promise<ValidationResult>}
 */
export const validTransactionHistory = async (transactions, ip_address, wallet_address, github_id) => {
    const [stats, comboCount] = await Promise.all([
        transactions.getTransactionStats({ ip_address, wallet_address, github_id }),
        transactions.getMonthlyTransactionStats({ ip_address, wallet_address, github_id }),
    ]);

    const ipCount = Number(stats.ip_count);
    const walletCount = Number(stats.wallet_count);
    const githubCount = Number(stats.github_count);
    const monthlyCount = Number(comboCount);

    if (Number.isNaN(ipCount) || Number.isNaN(walletCount) || Number.isNaN(githubCount) || Number.isNaN(monthlyCount)) {
        console.warn("[faucet-validation] Unexpected NaN from transaction stats:", { ip_count: stats.ip_count, wallet_count: stats.wallet_count, github_count: stats.github_count, comboCount });
        return { valid: false, reason: "Unable to verify transaction history" };
    }

    if (ipCount >= TRANSACTION_IP_LIMIT) {
        return { valid: false, reason: "IP address limit exceeded" };
    }
    if (walletCount >= TRANSACTION_WALLET_LIMIT) {
        return { valid: false, reason: "Wallet address limit exceeded" };
    }
    if (githubCount >= TRANSACTION_GITHUB_LIMIT) {
        return { valid: false, reason: "Github ID limit exceeded" };
    }
    if (monthlyCount >= TRANSACTION_MONTHLY_LIMIT) {
        return { valid: false, reason: "Monthly request limit exceeded" };
    }

    return { valid: true };
};

// --- Helpers ---

/**
 * Calculates the number of whole days between a given date and now.
 * @param {string | Date} date - ISO 8601 date string or Date object
 * @returns {number} Whole days elapsed (floored)
 */
export const daysSince = (date, now = new Date()) => {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((now - new Date(date)) / msPerDay);
};
