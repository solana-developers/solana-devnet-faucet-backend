import express from "express";
import { z } from "zod";

import { getGithubClient } from "../services/githubClient.js";
import transactions from "../db/transactions.js";
import { validGithubAccount, validTransactionHistory } from "../services/faucetEligibility.js";
import { truncateAddress } from "../utils/index.js";
import { validate } from "./middleware/validate.js";
import { walletAddressSchema, ipAddressSchema, githubIdSchema } from "./schemas.js";

const router = express.Router();

const validateBodySchema = z.object({
    ip_address: ipAddressSchema,
    wallet_address: walletAddressSchema,
    github_id: githubIdSchema,
}).strict();

/**
 * POST /validate
 * Validates whether a faucet request should be allowed.
 * Runs GitHub account checks first, then transaction rate-limit checks.
 *
 * @body {string} ip_address - Requestor's IP address
 * @body {string} wallet_address - Solana wallet to receive devnet SOL
 * @body {string} github_id - GitHub user ID for identity verification
 * @returns {{ valid: boolean, reason?: string }}
 */
router.post("/validate", validate({ body: validateBodySchema }), async (req, res) => {
    const { ip_address, wallet_address, github_id } = req.body;

    try {
        const githubResult = await validGithubAccount(getGithubClient(), github_id);
        if (!githubResult.valid) {
            console.warn(
                `[faucet-validation] github_id=${github_id} rejected: ${githubResult.reason}`
            );
            return res.status(200).json({
                valid: false,
                reason: githubResult.reason
            });
        }

        const txResult = await validTransactionHistory(transactions, ip_address, wallet_address, github_id);
        if (!txResult.valid) {
            console.warn(
                `[faucet-validation] github_id=${github_id} wallet=${truncateAddress(wallet_address)} rejected: ${txResult.reason}`
            );
            return res.status(200).json({
                valid: false,
                reason: txResult.reason
            });
        }

        res.status(200).json({ valid: true });
    } catch (error) {
        console.error(`[faucet-validation] github_id=${github_id} wallet=${truncateAddress(wallet_address)} error:`, error);
        if (error.status === 429) {
            if (error.retryAfterSeconds !== undefined) {
                res.set("Retry-After", String(error.retryAfterSeconds));
            }
            return res.status(429).json({ valid: false, reason: "GitHub rate limit exceeded." });
        }
        res.status(500).json({ valid: false, reason: "Internal server error." });
    }
});

export default router;
