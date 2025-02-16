import express from 'express';
import rateLimitRoute from './rateLimitRoute.js';
import transactionsRoute from './transactionsRoute.js';
import solanaBalancesRoute from "./solanaBalancesRoute.js";
import githubValidationRoute from "./githubValidationRoute.js";

const router = express.Router();

// Use rate limit routes
router.use(rateLimitRoute);

// Use transactions routes
router.use(transactionsRoute);

// Use Solana balances routes
router.use(solanaBalancesRoute);

// Use Github validation routes
router.use(githubValidationRoute);

export default router;