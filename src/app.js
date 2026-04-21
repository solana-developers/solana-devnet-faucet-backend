import express from 'express';
import routes from './routes/index.js';
import { validateGoogleToken } from './routes/middleware/authorization.js';

export function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api', validateGoogleToken, routes);
    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).send('Something broke!');
    });
    return app;
}
