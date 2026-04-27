import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

import transactionsRoute from '../transactionsRoute.js';

const SAMPLE_WALLET = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

describe('transactionsRoute', () => {
    it('rejects oversized /transactions/last count values before querying transactions', async () => {
        const app = express();
        app.use('/api', transactionsRoute);

        const res = await request(app)
            .get('/api/transactions/last')
            .query({ wallet_address: SAMPLE_WALLET, ip_address: "19216811", count: 101 })
            .expect(400);

        assert.deepEqual(res.body, {
            error: "Validation failed",
            details: [{ path: "count", message: "must be 100 or fewer" }],
        });
    });
});
