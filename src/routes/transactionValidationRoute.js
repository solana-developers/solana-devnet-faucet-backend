import express from "express";
import { z } from "zod";

import transactions from "../db/transactions.js";
import { checkGithubAccount, checkTransactionHistory } from "../services/faucetEligibility.js";
import { truncateAddress } from "../utils/index.js";
import { validateRequest } from "./middleware/requestValidator.js";
import { walletAddressSchema, ipAddressSchema, githubIdSchema } from "./schemas.js";

const validateBodySchema = z.object({
    ip_address: ipAddressSchema,
    wallet_address: walletAddressSchema,
    github_id: githubIdSchema,
}).strict();

/**
 * Builds the /validate route. The GithubClient is supplied via factory so the
 * app can lazy-construct the default singleton (avoids requiring GH_TOKENS at
 * boot) while tests inject a fake.
 *
 * @param {{ getGithubClient: () => import("../services/githubClient.js").default }} deps
 */
export default function createTransactionValidationRoute({ getGithubClient }) {
    const router = express.Router();

    /**
     * POST /validate
     * Validates whether a faucet request should be allowed.
     * Runs GitHub account checks first, then transaction rate-limit checks.
     */
    router.post("/validate", validateRequest({ body: validateBodySchema }), async (req, res) => {
        const { ip_address, wallet_address, github_id } = req.body;
        const log = req.log.child({ githubId: github_id, wallet: truncateAddress(wallet_address) });

        let githubResult;
        try {
            githubResult = await checkGithubAccount(getGithubClient(), github_id);
        } catch (err) {
            log.error({ err }, 'github eligibility check failed');
            // 429 = GitHub rate limit (all tokens exhausted). Anything else
            // — invalid PAT, GitHub 5xx, network failure, missing GH_TOKENS
            // — means we couldn't reach a verdict, so signal "upstream
            // unavailable" instead of a generic 500. Lets the frontend
            // distinguish "retry shortly" from a real server bug.
            if (err.status === 429) {
                if (err.retryAfterSeconds !== undefined) {
                    res.set("Retry-After", String(err.retryAfterSeconds));
                }
                return res.status(429).json({ valid: false, reason: "GitHub rate limit exceeded." });
            }
            return res.status(503).json({ valid: false, reason: "Identity provider unavailable." });
        }

        if (!githubResult.valid) {
            log.warn({ reason: githubResult.reason }, 'faucet validation rejected (github)');
            return res.status(200).json({ valid: false, reason: githubResult.reason });
        }

        try {
            const txResult = await checkTransactionHistory(transactions, ip_address, wallet_address, github_id);
            if (!txResult.valid) {
                log.warn({ reason: txResult.reason }, 'faucet validation rejected (transaction history)');
                return res.status(200).json({ valid: false, reason: txResult.reason });
            }
            res.status(200).json({ valid: true });
        } catch (err) {
            log.error({ err }, 'transaction history check failed');
            res.status(500).json({ valid: false, reason: "Internal server error." });
        }
    });

    return router;
}
