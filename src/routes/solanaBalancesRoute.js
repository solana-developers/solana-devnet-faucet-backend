import express from 'express';
import solanaBalances from '../db/solanaBalances.js'; // Import the CRUD methods

const router = express.Router();

// CREATE a new Solana balance
router.post('/solana-balances', async (req, res, next) => {
    const { account, balance } = req.body;

    try {
        const newBalance = await solanaBalances.createSolanaBalance(account, balance);
        res.status(201).json(newBalance);
    } catch (error) {
        console.error(`Error creating Solana balance for account: ${account}, Error: ${error.message}`);
        next(error);
    }
});

// READ all Solana balances for an account
router.get('/solana-balances/account/:account', async (req, res, next) => {
    const { account } = req.params;

    try {
        const balances = await solanaBalances.getSolanaBalancesByAccount(account);
        res.status(200).json(balances);
    } catch (error) {
        console.error(`Error retrieving Solana balances for account: ${account}, Error: ${error.message}`);
        next(error);
    }
});

// GET recent Solana balances (last month)
router.get('/solana-balances/recent', async (req, res, next) => {
    try {
        const recentBalances = await solanaBalances.getRecentBalances();
        res.status(200).json(recentBalances);
    } catch (error) {
        console.error(`Error retrieving recent Solana balances, Error: ${error.message}`);
        next(error);
    }
});

export default router;