import express from 'express';
import transactions from '../db/transactions.js';

const router = express.Router();

// POST a new transaction
router.post('/transactions', async (req, res, next) => {
    const { signature, ip_address, wallet_address, github_username, timestamp } = req.body;

    if (!signature || !ip_address || !wallet_address || !timestamp) {
        return res.status(400).json({ message: 'Missing required fields (signature, ip_address, wallet_address, timestamp).' });
    }

    try {
        const newTransaction = await transactions.createTransaction(signature, ip_address, wallet_address, github_username ?? '', timestamp);
        res.status(201).json(newTransaction);
    } catch (error) {
        console.error('Error creating transaction:', error);
        next(error);
    }
});

// GET the most recent transaction based on wallet, GitHub or IP
router.get('/transactions/last', async (req, res, next) => {
    const { wallet_address, github_id, ip_address, count } = req.query;

    if (!wallet_address || !ip_address) {
        return res.status(400).json({ message: 'At least one parameter (wallet_address, or ip_address) is required.' });
    }
    const queryLimit = !count ? 1 : Number(count);

    try {
        const lastTransaction = await transactions.getLastTransaction({ wallet_address, github_id, ip_address, queryLimit });

        if (lastTransaction) {
            res.status(200).json(lastTransaction);
        } else {
            res.status(204).json({ message: 'No transaction found for the given criteria.' });
        }
    } catch (error) {
        console.error('Error fetching last transaction:', error);
        next(error);
    }
});

// DELETE a transaction by signature
router.delete('/transactions/:signature', async (req, res, next) => {
    const { signature } = req.params;

    try {
        const deletedTransaction = await transactions.deleteTransaction(signature);
        if (deletedTransaction) {
            res.status(200).json(deletedTransaction);
        } else {
            console.warn(`Transaction not found for signature "${signature}"`);
            res.status(404).json({ message: 'Transaction not found' });
        }
    } catch (error) {
        console.error(`Error deleting transaction for signature "${signature}":`, error);
        next(error);
    }
});

export default router;