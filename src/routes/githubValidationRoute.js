import express from "express";
import { z } from "zod";

import GithubClient from "../services/githubClient.js";
import { validGithubAccount } from "../services/faucetEligibility.js";
import { validate } from "./middleware/validate.js";

const router = express.Router();

const githubClient = new GithubClient();

const ghValidationParamsSchema = z.object({
  userId: z
    .string()
    .max(20, "must be 20 characters or fewer")
    .regex(/^\d+$/, "must be a numeric GitHub user ID"),
});

/**
 * GET /gh-validation/:userId
 * Validates whether a GitHub account meets faucet eligibility requirements.
 *
 * @route GET /gh-validation/:userId
 * @param {string} req.params.userId - GitHub user ID to validate
 * @returns {200} {{ valid: boolean, reason?: string }} - Validation result
 * @returns {429} {{ error: string }} - GitHub tokens rate-limited (includes Retry-After header)
 * @returns {500} {{ error: string }} - Internal server error
 */
router.get(
  "/gh-validation/:userId",
  validate({ params: ghValidationParamsSchema }),
  async (req, res) => {
    const { userId } = req.params;

    try {
      const result = await validGithubAccount(githubClient, userId);
      if (!result.valid) {
        console.warn(`[gh-validation] userId=${userId} rejected: ${result.reason}`);
      }
      res.status(200).json(result);
    } catch (error) {
      console.error(`[gh-validation] userId=${userId} error:`, error);
      if (error.status === 429) {
        if (error.retryAfterSeconds !== undefined) {
          res.set("Retry-After", String(error.retryAfterSeconds));
        }
        return res.status(429).json({ error: "GitHub rate limit exceeded." });
      }
      res.status(500).json({ error: "Internal server error." });
    }
  }
);

export default router;
