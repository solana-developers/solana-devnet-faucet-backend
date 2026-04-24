import express from 'express';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import createRoutes from './routes/index.js';
import { validateGoogleToken } from './routes/middleware/authorization.js';
import GithubClient from './services/githubClient.js';
import { logger } from './logger.js';

/**
 * @param {object} [deps]
 * @param {() => GithubClient} [deps.getGithubClient] - Override the GitHub
 *   client provider; tests inject a fake here. The default lazy-caches a
 *   `new GithubClient()` so the app can boot without GH_TOKENS — only
 *   /validate requests will trip the env requirement.
 */
export function createApp({ getGithubClient } = {}) {
    let cachedGithub;
    const githubProvider = getGithubClient ?? (() => {
        if (!cachedGithub) cachedGithub = new GithubClient();
        return cachedGithub;
    });

    const app = express();
    app.use(express.json());
    app.use(pinoHttp({
        logger,
        // Honor an upstream request ID if the load balancer sent one; fall
        // back to a UUID so every log line and trace can be correlated.
        genReqId: (req) => req.headers['x-request-id'] ?? randomUUID(),
    }));
    app.use('/api', validateGoogleToken, createRoutes({ getGithubClient: githubProvider }));
    app.use((err, req, res, next) => {
        req.log.error({ err }, 'unhandled error');
        res.status(500).send('Something broke!');
    });
    return app;
}
