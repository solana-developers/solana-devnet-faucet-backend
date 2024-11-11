import express from 'express';
import routes from './src/routes/index.js';
import { validateGoogleToken } from './src/routes/middleware/authorization.js';

// Initialize Express
const app = express();

// Middleware
app.use(express.json()); // Parse JSON request bodies
app.use('/api', validateGoogleToken, routes); // Secure all API routes

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});