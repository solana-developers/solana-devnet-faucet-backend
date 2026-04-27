import express from 'express';
import { z } from 'zod';
import transactions from '../db/transactions.js';
import { validateRequest } from './middleware/requestValidator.js';
import { walletAddressSchema, ipAddressSchema, githubIdSchema } from './schemas.js';

const router = express.Router();

// Solana transaction signatures are base58 ed25519 sigs (~88 chars). We don't
// regex them — `signature` is the table's primary key and any deviation will
// surface as a uniqueness/insert failure rather than a silent data issue.
const createTransactionBodySchema = z.object({
    signature: z.string().min(1, "must not be empty").max(100, "must be 100 characters or fewer"),
    ip_address: ipAddressSchema,
    wallet_address: walletAddressSchema,
    github_id: githubIdSchema.optional(),
    timestamp: z.number().int().positive(),
}).strict();

const LAST_TRANSACTION_COUNT_MAX = 100;

const lastTransactionQuerySchema = z.object({
    wallet_address: walletAddressSchema,
    ip_address: ipAddressSchema,
    github_id: githubIdSchema.optional(),
    // Express delivers query values as strings; coerce so handlers see a number.
    count: z.coerce
        .number()
        .int()
        .positive()
        .max(LAST_TRANSACTION_COUNT_MAX, `must be ${LAST_TRANSACTION_COUNT_MAX} or fewer`)
        .optional(),
});

// POST a new transaction
router.post('/transactions', validateRequest({ body: createTransactionBodySchema }), async (req, res, next) => {
    const { signature, ip_address, wallet_address, github_id, timestamp } = req.body;

    try {
        const newTransaction = await transactions.createTransaction(signature, ip_address, wallet_address, github_id ?? '', timestamp);
        res.status(201).json(newTransaction);
    } catch (err) {
        req.log.error({ err }, 'failed to create transaction');
        next(err);
    }
});

// GET the most recent transaction(s); wallet_address and ip_address are required, github_id is optional
router.get('/transactions/last', validateRequest({ query: lastTransactionQuerySchema }), async (req, res, next) => {
    const { wallet_address, github_id, ip_address, count } = req.query;
    const queryLimit = count ?? 1;

    try {
        const lastTransaction = await transactions.getLastTransaction({ wallet_address, github_id, ip_address, queryLimit });
        res.status(200).json(lastTransaction);
    } catch (err) {
        req.log.error({ err }, 'failed to fetch last transaction');
        next(err);
    }
});

export default router;
