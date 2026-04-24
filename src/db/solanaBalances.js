import db from './config.js'; // Import the database config

// CREATE a new Solana balance
const createSolanaBalance = async (account, balance) => {
    const query = `
        INSERT INTO faucet.solana_balances (account, balance)
        VALUES ($1, $2)
        RETURNING *;
    `;
    const values = [account, balance];
    const result = await db.query(query, values);
    return result.rows[0];
};

const getRecentBalances = async () => {
    const query = `
        SELECT account, balance, date 
        FROM faucet.solana_balances
        WHERE date >= CURRENT_DATE - INTERVAL '1 month'
        ORDER BY date;
    `;
    const result = await db.query(query);
    return result.rows;
};

export default {
    createSolanaBalance,
    getRecentBalances,
};