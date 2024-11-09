import express from 'express';
import rateLimitRoute from './rateLimitRoute.js'; // Import the rate limit routes

const router = express.Router();

// Use rate limit routes
router.use(rateLimitRoute);

export default router;