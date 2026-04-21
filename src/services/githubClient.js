import { Octokit } from "@octokit/rest";
import { logger } from "../logger.js";

const log = logger.child({ component: "GithubClient" });

export class GithubClientError extends Error {
    /**
     * @param {string} message
     * @param {{ cause?: Error, status?: number, retryAfterSeconds?: number }} [options]
     */
    constructor(message, { cause, status, retryAfterSeconds } = {}) {
        super(message, { cause });
        this.name = "GithubClientError";
        this.status = status ?? cause?.status;
        if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
    }
}

const GH_TOKENS = process.env.GH_TOKENS?.split(',').map(t => t.trim()).filter(Boolean) || [];

// Fallback cooldown when GitHub sends a rate-limit 403 without a parseable reset.
const DEFAULT_COOLDOWN_MS = 60_000;

class GithubClient {
    /**
     * @param {Array} [clients] - Optional pre-built Octokit instances (for testing).
     *                             When omitted, clients are created from GH_TOKENS.
     * @param {{ now?: () => number }} [options] - Injection points for tests.
     */
    constructor(clients, options = {}) {
        if (clients) {
            this.clients = clients;
        } else {
            // Fail at construction, not at import — lets the module be loaded
            // safely in code paths that may not need GitHub access.
            if (GH_TOKENS.length === 0) {
                throw new Error("GitHub tokens not configured.");
            }
            this.clients = GH_TOKENS.map((token) => new Octokit({ auth: token }));
        }
        if (this.clients.length === 0) {
            throw new Error("At least one GitHub client is required.");
        }
        this._now = options.now ?? (() => Date.now());
        this._cursor = 0;
        // Parallel to this.clients: ms timestamp before which a token should
        // be skipped. 0 means the token is available.
        this._cooldownUntil = new Array(this.clients.length).fill(0);
    }

    /**
     * Atomically snapshots and advances the round-robin cursor.
     * Read + write happen in one synchronous statement, so concurrent callers
     * each get a unique starting index without racing on shared state.
     * @returns {number}
     */
    _nextStart() {
        const s = this._cursor;
        this._cursor = (s + 1) % this.clients.length;
        return s;
    }

    /**
     * Sends a request to the GitHub API, skipping tokens known to be in cooldown
     * and rotating through the rest on rate-limit 403s.
     *
     * @param {string} endpoint - GitHub API endpoint (e.g. "GET /user/{user_id}")
     * @param {object} params - Parameters forwarded to Octokit's request method
     * @returns {Promise<object>} The Octokit response
     * @throws {GithubClientError} On non-rate-limit failures, or status 429 when
     *   all tokens are in cooldown (message includes retry hint in seconds)
     */
    async request(endpoint, params) {
        const start = this._nextStart();
        const now = this._now();

        // Build the attempt order: healthy tokens only, rotated by cursor.
        const order = [];
        for (let i = 0; i < this.clients.length; i++) {
            const idx = (start + i) % this.clients.length;
            if (this._cooldownUntil[idx] <= now) order.push(idx);
        }

        if (order.length === 0) {
            throw this._exhaustedError(endpoint, now);
        }

        let lastError;
        for (const idx of order) {
            try {
                return await this.clients[idx].request(endpoint, params);
            } catch (err) {
                lastError = err;
                const cooldownUntil = parseCooldown(err, this._now());
                if (cooldownUntil !== undefined) {
                    this._cooldownUntil[idx] = cooldownUntil;
                    log.warn(
                        { tokenIndex: idx, cooldownUntil: new Date(cooldownUntil).toISOString() },
                        'token rate-limited'
                    );
                    continue;
                }
                throw new GithubClientError(
                    `GitHub request failed: ${endpoint}`,
                    { cause: err }
                );
            }
        }

        // Every token we tried was freshly rate-limited during this call.
        throw this._exhaustedError(endpoint, this._now(), lastError);
    }

    /**
     * @param {string} endpoint
     * @param {number} now
     * @param {Error} [cause]
     */
    _exhaustedError(endpoint, now, cause) {
        const soonest = Math.min(...this._cooldownUntil);
        const waitSeconds = Math.max(0, Math.ceil((soonest - now) / 1000));
        log.error({ endpoint, waitSeconds }, 'all tokens rate-limited');
        return new GithubClientError(
            `All GitHub tokens rate-limited for ${endpoint}; retry in ~${waitSeconds}s`,
            { status: 429, retryAfterSeconds: waitSeconds, cause }
        );
    }
}

/**
 * Returns the ms timestamp at which a rate-limited token becomes usable again,
 * or undefined if the error is not a GitHub rate limit.
 *
 * Primary rate limit: x-ratelimit-remaining=0 and x-ratelimit-limit present,
 * with x-ratelimit-reset as epoch seconds.
 * Secondary rate limit: retry-after (seconds) with "rate limit" in the message —
 * "rate limit" in the message disambiguates from proxy-set retry-after headers.
 *
 * @param {Error & { status?: number, response?: { headers?: Record<string, string> } }} err
 * @param {number} now - ms timestamp, injected for testability
 * @returns {number | undefined}
 */
function parseCooldown(err, now) {
    if (err.status !== 403) return undefined;
    const headers = err.response?.headers;
    if (!headers) return undefined;

    if (headers["x-ratelimit-remaining"] === "0" && headers["x-ratelimit-limit"]) {
        const reset = Number(headers["x-ratelimit-reset"]);
        return Number.isFinite(reset) ? reset * 1000 : now + DEFAULT_COOLDOWN_MS;
    }

    if (headers["retry-after"] && /rate limit/i.test(err.message)) {
        const retryAfter = Number(headers["retry-after"]);
        return Number.isFinite(retryAfter) ? now + retryAfter * 1000 : now + DEFAULT_COOLDOWN_MS;
    }

    return undefined;
}

let sharedClient;

/**
 * Returns a lazily-constructed, process-wide GithubClient.
 * Deferring construction to first use lets the app boot without GH_TOKENS —
 * only routes that actually need GitHub will error at request time.
 */
export function getGithubClient() {
    if (!sharedClient) sharedClient = new GithubClient();
    return sharedClient;
}

/**
 * Test-only: swap the shared client for a fake, or pass null to reset.
 * On reset, the next getGithubClient() call will construct a real one (and
 * throw if GH_TOKENS is unset), so tests should always set a fake before
 * hitting routes that use GitHub.
 */
export function setGithubClientForTests(client) {
    sharedClient = client;
}

export default GithubClient;
