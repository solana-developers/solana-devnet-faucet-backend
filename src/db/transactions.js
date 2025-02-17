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

const getLastTransaction = async ({ wallet_address, github_id, ip_address, queryLimit }) => {
    let query;
    let values;

    if (github_id) {
        query = `
        SELECT * FROM faucet.transactions
        WHERE 
            (wallet_address = $1) OR
            (ip_address = $2) OR
            (github_id = $3)
        ORDER BY timestamp DESC
        LIMIT $4;
        `;
        values = [wallet_address, ip_address, github_id, queryLimit];
    } else {
        query = `
        SELECT * FROM faucet.transactions
        WHERE 
            (wallet_address = $1) OR
            (ip_address = $2)
        ORDER BY timestamp DESC
        LIMIT $3;
        `;
        values = [wallet_address, ip_address, queryLimit];
    }

    const result = await db.query(query, values);
    return result.rows;
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