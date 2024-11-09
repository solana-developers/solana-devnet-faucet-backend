import dotenv from 'dotenv';
import { Pool } from 'pg'; // Use 'mysql2/promise' if using MySQL

dotenv.config();

const pgClient = new Pool({
    connectionString: process.env.POSTGRES_STRING, // Single connection string from .env
});

const query = (text, params) => pgClient.query(text, params);
const getClient = () => pgClient.connect(); // For transactions if needed

export default {
    query,
    getClient,
};