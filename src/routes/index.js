import express from 'express';
import transactionsRoute from './transactionsRoute.js';
import createTransactionValidationRoute from './transactionValidationRoute.js';
import solanaBalancesRoute from "./solanaBalancesRoute.js";

/**
 * Builds the API router. Routes that need request-time dependencies (currently
 * just /validate, which talks to GitHub) get them via the deps argument so
 * tests can inject fakes without module-level singletons.
 */
export default function createRoutes({ getGithubClient }) {
    const router = express.Router();
    router.use(transactionsRoute);
    router.use(createTransactionValidationRoute({ getGithubClient }));
    router.use(solanaBalancesRoute);
    return router;
}
