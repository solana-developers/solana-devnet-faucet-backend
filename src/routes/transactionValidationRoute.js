import express from "express";
import { z } from "zod";

import GithubClient from "../services/githubClient.js";
import transactions from "../db/transactions.js";
import { validGithubAccount, validTransactionHistory } from "../services/faucetEligibility.js";
import { truncateAddress } from "../utils/index.js";
import { validate } from "./middleware/validate.js";

const router = express.Router();

const githubClient = new GithubClient();

// Solana base58 pubkeys: 32–44 chars, excluding 0, O, I, l from the alphabet.
const SOLANA_BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Contract: the faucet frontend sends `ip_address` with delimiters stripped
// (e.g. "192.168.1.1" → "19216811", "::1" → "1") and stores it in the same
// shape via POST /transactions. We use it as an opaque DB key here, so we
// only bound its length and don't validate IP format. If the frontend ever
// switches to raw IPs, stored rows must be migrated in lockstep or rate
// limiting will silently stop matching.
const validateBodySchema = z.object({
    ip_address: z
        .string()
        .min(1, "must not be empty")
        .max(45, "must be 45 characters or fewer"),
    wallet_address: z
        .string()
        .regex(SOLANA_BASE58_RE, "must be a valid Solana base58 address (32–44 chars)"),
    github_id: z
        .string()
        .max(20, "must be 20 characters or fewer")
        .regex(/^\d+$/, "must be a numeric GitHub user ID"),
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
        const githubResult = await validGithubAccount(githubClient, github_id);
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
