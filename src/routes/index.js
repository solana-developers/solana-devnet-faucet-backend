import express from 'express';
import rateLimitRoute from './rateLimitRoute.js';
import solanaBalancesRoute from "./solanaBalancesRoute.js"; // Import the rate limit routes

const router = express.Router();

// Use rate limit routes
router.use(rateLimitRoute);

// Use solana balances routes
router.use(solanaBalancesRoute);

export default router;