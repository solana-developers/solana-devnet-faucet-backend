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
            res.status(404).json({ message: 'Rate limit not found' });
        }
    } catch (error) {
        next(error);
    }
});

// UPDATE timestamps for a rate limit by key
router.put('/rate-limits/:key', async (req, res, next) => {
    const { key } = req.params;
    const { timestamps } = req.body;
    console.log(req.body);
    console.log(key);
    console.log("-----------");

    try {
        const updatedRateLimit = await rateLimits.updateRateLimit(key, timestamps);
        console.log("updatedRateLimit", updatedRateLimit);
        if (updatedRateLimit) {
            res.status(200).json(updatedRateLimit);
        } else {
            res.status(404).json({ message: 'Rate limit not found' });
        }
    } catch (error) {
        next(error);
    }
});

export default router;