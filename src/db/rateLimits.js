import db from './config.js'; // Import the database config

const createRateLimit = async (key, timestamps) => {
    const query = `
    INSERT INTO faucet.rate_limits (key, timestamps)
    VALUES ($1, $2)
    RETURNING *;
  `;
    const values = [key, timestamps];
    const result = await db.query(query, values);
    return result.rows[0];
};

const getRateLimit = async (key) => {
    const query = `
    SELECT * FROM faucet.rate_limits
    WHERE key = $1;
  `;
    const values = [key];
    const result = await db.query(query, values);
    return result.rows[0];
};

const updateRateLimit = async (key, timestamps) => {
    const query = `
    UPDATE faucet.rate_limits
    SET timestamps = $2
    WHERE key = $1
    RETURNING *;
  `;
    const values = [key, timestamps];
    const result = await db.query(query, values);
    return result.rows[0];
};

const deleteRateLimit = async (key) => {
    const query = `
    DELETE FROM faucet.rate_limits
    WHERE key = $1
    RETURNING *;
  `;
    const values = [key];
    const result = await db.query(query, values);
    return result.rows[0];
};

async function createRateLimitCombo(ip_address, wallet_address, github_userid ) {
    const query = `
        INSERT INTO faucet.rate_limits_combo (ip_address, wallet_address, github_userid)
        VALUES ($1, $2, $3)
        RETURNING *;
    `;

    const values = [ip_address, wallet_address, github_userid];
    const result = await db.query(query, values);

    return result.rows[0];
}

export default {
    createRateLimit,
    getRateLimit,
    updateRateLimit,
    deleteRateLimit,
    createRateLimitCombo
};