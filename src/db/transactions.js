import db from './config.js';

const createTransaction = async (signature, ip_address, wallet_address, github_username, timestamp) => {
    const query = `
    INSERT INTO faucet.transactions (signature, ip_address, wallet_address, github_username, timestamp)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
    const values = [signature, ip_address, wallet_address, github_username, timestamp];
    const result = await db.query(query, values);
    return result.rows[0];
};

const getLastTransaction = async ({ wallet_address, github_username, ip_address }) => {
    const query = `
    SELECT * FROM faucet.transactions
    WHERE 
        (wallet_address = $1) OR
        (github_username = $2) OR
        (ip_address = $3)
    ORDER BY timestamp DESC
    LIMIT 1;
  `;

    const values = [wallet_address || null, github_username || null, ip_address || null];
    const result = await db.query(query, values);
    return result.rows[0]; // Returns the most recent transaction found
};

// Not currently needed, but may be used for implementing TTL
const deleteTransaction = async (signature) => {
    const query = `
    DELETE FROM faucet.transactions
    WHERE signature = $1
    RETURNING *;
  `;
    const values = [signature];
    const result = await db.query(query, values);
    return result.rows[0];
};

export default {
    createTransaction,
    getLastTransaction,
    deleteTransaction
};