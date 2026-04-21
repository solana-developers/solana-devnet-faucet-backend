import express from 'express';
import transactionsRoute from './transactionsRoute.js';
import transactionValidationRoute from './transactionValidationRoute.js';
import solanaBalancesRoute from "./solanaBalancesRoute.js";

const router = express.Router();

router.use(transactionsRoute);
router.use(transactionValidationRoute);
router.use(solanaBalancesRoute);

export default router;
