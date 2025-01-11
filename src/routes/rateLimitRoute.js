import express from 'express';
import rateLimits from '../db/rateLimits.js'; // Import the CRUD methods for the rate limits table

const router = express.Router();

// POST a new rate limit
router.post('/rate-limits', async (req, res, next) => {
    const { key, timestamps } = req.body;

    try {
        const newRateLimit = await rateLimits.createRateLimit(key, timestamps);
        res.status(201).json(newRateLimit);
    } catch (error) {
        console.error(`Error creating rate limit for key "${key}":`, error);
        next(error); // Pass errors to global error handler
    }
});

// GET a rate limit by key
router.get('/rate-limits/:key', async (req, res, next) => {
    const { key } = req.params;

    try {
        const rateLimit = await rateLimits.getRateLimit(key);
        if (rateLimit) {
            res.status(200).json(rateLimit);
        } else {
            console.warn(`Rate limit not found for key "${key}"`);
            res.status(404).json({ message: 'Rate limit not found' });
        }
    } catch (error) {
        console.error(`Error retrieving rate limit for key "${key}":`, error);
        next(error);
    }
});

// PUT timestamps for a rate limit by key
router.put('/rate-limits/:key', async (req, res, next) => {
    const { key } = req.params;
    const { timestamps } = req.body;

    try {
        const updatedRateLimit = await rateLimits.updateRateLimit(key, timestamps);
        if (updatedRateLimit) {
            res.status(200).json(updatedRateLimit);
        } else {
            console.warn(`Rate limit not found for key "${key}"`);
            res.status(404).json({ message: 'Rate limit not found' });
        }
    } catch (error) {
        console.error(`Error updating rate limit for key "${key}":`, error);
        next(error);
    }
});

// POST rate limit combination
router.post('/rate-limits-combo', async (req, res, next) => {
    const { ip_address, wallet_address, github_userid } = req.body;

    // Validate the input
    if (!ip_address || !wallet_address) {
        return res.status(400).json({ message: 'All fields (ip_address, wallet_address, github_username) are required.' });
    }

    try {
        // Insert the new combination into the database
        const newCombo = await rateLimits.createRateLimitCombo(ip_address, wallet_address, github_userid ?? '');

        res.status(201).json(newCombo);
    } catch (error) {
        if (error.code === '23505') { // Unique violation error code for PostgreSQL
            console.warn('Duplicate rate limit combo:', error.detail);
            res.status(409).json({ message: 'Combination of ip_address, wallet_address, and github_userid already exists.' });
        } else {
            console.error('Error creating rate limit combo:', error);
            next(error);
        }
    }
});

export default router;