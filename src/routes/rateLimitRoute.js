import express from 'express';
import rateLimits from '../db/rateLimits.js'; // Import the CRUD methods for the rate limits table

const router = express.Router();

// CREATE a new rate limit
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

// READ a rate limit by key
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

// UPDATE timestamps for a rate limit by key
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

export default router;