import express from 'express';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import routes from './routes/index.js';
import { validateGoogleToken } from './routes/middleware/authorization.js';
import { logger } from './logger.js';

export function createApp() {
    const app = express();
    app.use(express.json());
    app.use(pinoHttp({
        logger,
        // Honor an upstream request ID if the load balancer sent one; fall
        // back to a UUID so every log line and trace can be correlated.
        genReqId: (req) => req.headers['x-request-id'] ?? randomUUID(),
    }));
    app.use('/api', validateGoogleToken, routes);
    app.use((err, req, res, next) => {
        req.log.error({ err }, 'unhandled error');
        res.status(500).send('Something broke!');
    });
    return app;
}
