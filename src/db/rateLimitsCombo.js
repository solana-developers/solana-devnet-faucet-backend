import db from './config.js'; // Import the database configuration

const addRateLimitCombo = async (ip_address, wallet_address, github_username) => {
    const query = `
    INSERT INTO faucet.rate_limits_combo (ip_address, wallet_address, github_username)
    VALUES ($1, $2, $3)
    ON CONFLICT (ip_address, wallet_address, github_username) DO NOTHING
    RETURNING *;
  `;
    const values = [ip_address, wallet_address, github_username];

    try {
        const result = await db.query(query, values);

        if (result.rowCount === 0) {
            console.log('Duplicate combination found:', {ip_address, wallet_address, github_username});
        } else {
            console.log('New combo inserted:', result.rows[0]);
        }

        return result.rows[0];
    } catch (error) {
        console.error('Error during combo creation:', error);
        throw error;
    }
};

export default {
    addRateLimitCombo,
};