import dotenv from 'dotenv';
import pg from 'pg'; // Use 'mysql2/promise' if using MySQL
const { Pool } = pg;

dotenv.config();

const pgClient = new Pool(process.env.DB_CONNECTION_NAME ? {
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    host: `/cloudsql/${process.env.DB_CONNECTION_NAME}`
} : {
    connectionString: process.env.POSTGRES_STRING
});

const query = (text, params) => pgClient.query(text, params);
const getClient = () => pgClient.connect(); // For transactions if needed

export default {
    query,
    getClient,
};