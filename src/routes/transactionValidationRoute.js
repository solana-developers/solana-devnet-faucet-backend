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

        try {
            const githubResult = await checkGithubAccount(getGithubClient(), github_id);
            if (!githubResult.valid) {
                log.warn({ reason: githubResult.reason }, 'faucet validation rejected (github)');
                return res.status(200).json({
                    valid: false,
                    reason: githubResult.reason
                });
            }

            const txResult = await checkTransactionHistory(transactions, ip_address, wallet_address, github_id);
            if (!txResult.valid) {
                log.warn({ reason: txResult.reason }, 'faucet validation rejected (transaction history)');
                return res.status(200).json({
                    valid: false,
                    reason: txResult.reason
                });
            }

            res.status(200).json({ valid: true });
        } catch (err) {
            log.error({ err }, 'faucet validation errored');
            if (err.status === 429) {
                if (err.retryAfterSeconds !== undefined) {
                    res.set("Retry-After", String(err.retryAfterSeconds));
                }
                return res.status(429).json({ valid: false, reason: "GitHub rate limit exceeded." });
            }
            res.status(500).json({ valid: false, reason: "Internal server error." });
        }
    });

    return router;
}
