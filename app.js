// Importing Express and Routes using ES Module syntax
import express from 'express';
import routes from './src/routes/index.js'; // Must include the .js extension in ES Modules

// Initialize Express
const app = express();

// Middleware
app.use(express.json()); // Parse JSON request bodies

// Routes
app.use('/api', routes); // Use routes from the /routes folder

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