import express from 'express';
import { z } from 'zod';
import solanaBalances from '../db/solanaBalances.js'; // Import the CRUD methods
import { validate } from './middleware/validate.js';

const router = express.Router();

// `account` is treated as an opaque key (TEXT in the schema, written by a
// monitor job not by user input) — bound length but don't enforce base58
// here, since fixture rows like "acct-1" are valid call sites too.
const createSolanaBalanceBodySchema = z.object({
    account: z.string().min(1, "must not be empty").max(100, "must be 100 characters or fewer"),
    balance: z.number().nonnegative(),
}).strict();

// CREATE a new Solana balance
router.post('/solana-balances', validate({ body: createSolanaBalanceBodySchema }), async (req, res, next) => {
    const { account, balance } = req.body;

    try {
        const newBalance = await solanaBalances.createSolanaBalance(account, balance);
        res.status(201).json(newBalance);
    } catch (err) {
        req.log.error({ err, account }, 'failed to create solana balance');
        next(err);
    }
});

// GET recent Solana balances (last month)
router.get('/solana-balances/recent', async (req, res, next) => {
    try {
        const recentBalances = await solanaBalances.getRecentBalances();
        res.status(200).json(recentBalances);
    } catch (err) {
        req.log.error({ err }, 'failed to fetch recent solana balances');
        next(err);
    }
});

export default router;