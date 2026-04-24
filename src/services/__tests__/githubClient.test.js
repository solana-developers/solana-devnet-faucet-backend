import { describe, it } from 'node:test';
import assert from 'node:assert';
import GithubClient, { GithubClientError } from '../githubClient.js';

describe('GithubClient constructor', () => {
    it('should accept injected clients', () => {
        const client = new GithubClient([makeOctokitStub(() => {})]);
        assert.strictEqual(client.clients.length, 1);
    });

    it('should reject an empty clients array', () => {
        assert.throws(() => new GithubClient([]), /At least one GitHub client/);
    });
});

describe('GithubClient.request', () => {
    it('should return the response from the first client on success', async () => {
        const stub = makeOctokitStub(async () => ({ data: "ok" }));
        const client = new GithubClient([stub]);

        const result = await client.request("GET /test", {});
        assert.deepStrictEqual(result, { data: "ok" });
    });

    it('should pass endpoint and params through to the underlying client', async () => {
        let captured;
        const stub = makeOctokitStub(async (endpoint, params) => {
            captured = { endpoint, params };
            return { data: "ok" };
        });
        const client = new GithubClient([stub]);

        await client.request("GET /user/{id}", { id: 42 });
        assert.strictEqual(captured.endpoint, "GET /user/{id}");
        assert.deepStrictEqual(captured.params, { id: 42 });
    });

    it('should rotate to the next client on a rate-limit 403', async () => {
        const calls = [];
        const stub1 = makeOctokitStub(async () => {
            calls.push(1);
            throw rateLimitError();
        });
        const stub2 = makeOctokitStub(async () => {
            calls.push(2);
            return { data: "from-second" };
        });
        const client = new GithubClient([stub1, stub2]);

        const result = await client.request("GET /test", {});
        assert.deepStrictEqual(calls, [1, 2]);
        assert.deepStrictEqual(result, { data: "from-second" });
    });

    it('should rotate on a secondary rate-limit 403 (retry-after header)', async () => {
        const calls = [];
        const stub1 = makeOctokitStub(async () => {
            calls.push(1);
            throw secondaryRateLimitError();
        });
        const stub2 = makeOctokitStub(async () => {
            calls.push(2);
            return { data: "from-second" };
        });
        const client = new GithubClient([stub1, stub2]);

        const result = await client.request("GET /test", {});
        assert.deepStrictEqual(calls, [1, 2]);
        assert.deepStrictEqual(result, { data: "from-second" });
    });

    it('should throw GithubClientError immediately on a non-rate-limit 403', async () => {
        const stub1 = makeOctokitStub(async () => { throw forbiddenError(); });
        const stub2 = makeOctokitStub(async () => ({ data: "should not reach" }));
        const client = new GithubClient([stub1, stub2]);

        await assert.rejects(
            () => client.request("GET /test", {}),
            (err) => {
                assert.ok(err instanceof GithubClientError);
                assert.strictEqual(err.status, 403);
                assert.strictEqual(err.cause.message, "forbidden");
                return true;
            }
        );
    });

    it('should throw GithubClientError on a 404 with original as cause', async () => {
        const stub1 = makeOctokitStub(async () => { throw notFoundError(); });
        const stub2 = makeOctokitStub(async () => ({ data: "should not reach" }));
        const client = new GithubClient([stub1, stub2]);

        await assert.rejects(
            () => client.request("GET /test", {}),
            (err) => {
                assert.ok(err instanceof GithubClientError);
                assert.strictEqual(err.status, 404);
                assert.strictEqual(err.cause.message, "not found");
                return true;
            }
        );
    });

    it('should not rotate on a 403 with retry-after but no rate-limit message (e.g. proxy)', async () => {
        const err = new Error("gateway timeout");
        err.status = 403;
        err.response = { headers: { "retry-after": "30" } };
        const stub1 = makeOctokitStub(async () => { throw err; });
        const stub2 = makeOctokitStub(async () => ({ data: "should not reach" }));
        const client = new GithubClient([stub1, stub2]);

        await assert.rejects(
            () => client.request("GET /test", {}),
            (e) => {
                assert.ok(e instanceof GithubClientError);
                assert.strictEqual(e.status, 403);
                return true;
            }
        );
    });

    it('should not rotate on a 403 with x-ratelimit-remaining 0 but no x-ratelimit-limit', async () => {
        const err = new Error("abuse detection");
        err.status = 403;
        err.response = { headers: { "x-ratelimit-remaining": "0" } };
        const stub1 = makeOctokitStub(async () => { throw err; });
        const stub2 = makeOctokitStub(async () => ({ data: "should not reach" }));
        const client = new GithubClient([stub1, stub2]);

        await assert.rejects(
            () => client.request("GET /test", {}),
            (e) => {
                assert.ok(e instanceof GithubClientError);
                assert.strictEqual(e.status, 403);
                return true;
            }
        );
    });

    it('should throw 429 GithubClientError with retry hint after all clients are rate-limited', async () => {
        const stub1 = makeOctokitStub(async () => { throw rateLimitError(); });
        const stub2 = makeOctokitStub(async () => { throw rateLimitError(); });
        const client = new GithubClient([stub1, stub2]);

        await assert.rejects(
            () => client.request("GET /test", {}),
            (err) => {
                assert.ok(err instanceof GithubClientError);
                assert.strictEqual(err.status, 429);
                assert.match(err.message, /All GitHub tokens rate-limited/);
                assert.match(err.message, /retry in ~\d+s/);
                return true;
            }
        );
    });

    it('should try each client exactly once when all are rate-limited', async () => {
        const calls = [];
        const stubs = [0, 1, 2].map(i =>
            makeOctokitStub(async () => { calls.push(i); throw rateLimitError(); })
        );
        const client = new GithubClient(stubs);

        await assert.rejects(
            () => client.request("GET /test", {}),
            (err) => err instanceof GithubClientError
        );
        assert.strictEqual(calls.length, 3);
        // Each stub called exactly once
        assert.deepStrictEqual(calls.sort(), [0, 1, 2]);
    });
});

describe('GithubClient round-robin', () => {
    it('should start successive requests on different clients', async () => {
        const calls = [];
        const stubs = [0, 1, 2].map(i =>
            makeOctokitStub(async () => { calls.push(i); return { data: i }; })
        );
        const client = new GithubClient(stubs);

        await client.request("GET /a", {});
        await client.request("GET /b", {});
        await client.request("GET /c", {});

        // Each request should hit a different client
        assert.deepStrictEqual(calls, [0, 1, 2]);
    });

    it('should wrap around when index exceeds client count', async () => {
        const calls = [];
        const stubs = [0, 1].map(i =>
            makeOctokitStub(async () => { calls.push(i); return { data: i }; })
        );
        const client = new GithubClient(stubs);

        await client.request("GET /a", {});
        await client.request("GET /b", {});
        await client.request("GET /c", {});

        assert.deepStrictEqual(calls, [0, 1, 0]);
    });

    it('should handle concurrent requests independently', async () => {
        const calls = [];
        const stubs = [0, 1].map(i =>
            makeOctokitStub(async () => {
                // Simulate async delay so requests overlap
                await new Promise(r => setTimeout(r, 10));
                calls.push(i);
                return { data: i };
            })
        );
        const client = new GithubClient(stubs);

        const [r1, r2] = await Promise.all([
            client.request("GET /a", {}),
            client.request("GET /b", {}),
        ]);

        // Both requests should complete, hitting different clients
        assert.strictEqual(calls.length, 2);
        assert.deepStrictEqual(new Set([r1.data, r2.data]), new Set([0, 1]));
    });

    it('should skip a token whose cooldown has not expired on subsequent requests', async () => {
        const now = 1_000_000_000;
        const resetSeconds = (now + 60_000) / 1000;
        const calls = { 0: 0, 1: 0 };
        const stub0 = makeOctokitStub(async () => {
            calls[0]++;
            throw rateLimitError({ resetSeconds });
        });
        const stub1 = makeOctokitStub(async () => {
            calls[1]++;
            return { data: "ok" };
        });
        const client = new GithubClient([stub0, stub1], { now: () => now });

        // First request: stub0 gets rate-limited, stub1 succeeds.
        await client.request("GET /a", {});
        assert.strictEqual(calls[0], 1);
        assert.strictEqual(calls[1], 1);

        // Second request: stub0 is still in cooldown; should skip it entirely.
        await client.request("GET /b", {});
        assert.strictEqual(calls[0], 1, "stub0 should not be retried while cooled down");
        assert.strictEqual(calls[1], 2);
    });

    it('should retry a token after its cooldown expires', async () => {
        let now = 1_000_000_000;
        const resetSeconds = (now + 60_000) / 1000;
        const calls = { 0: 0, 1: 0 };
        let stub0ThrowsOnce = true;
        const stub0 = makeOctokitStub(async () => {
            calls[0]++;
            if (stub0ThrowsOnce) {
                stub0ThrowsOnce = false;
                throw rateLimitError({ resetSeconds });
            }
            return { data: "stub0-healthy" };
        });
        const stub1 = makeOctokitStub(async () => {
            calls[1]++;
            return { data: "stub1-ok" };
        });
        const client = new GithubClient([stub0, stub1], { now: () => now });

        // Trigger cooldown on stub0.
        await client.request("GET /a", {});
        assert.strictEqual(calls[0], 1);

        // Before reset: stub0 stays skipped.
        now += 30_000;
        const callsBeforeExpiry = calls[0];
        await client.request("GET /b", {});
        assert.strictEqual(calls[0], callsBeforeExpiry, "stub0 stays cooled within window");

        // After reset: both cursor positions should put stub0 back in rotation.
        now += 60_000;
        await client.request("GET /c", {});
        await client.request("GET /d", {});
        assert.ok(calls[0] > callsBeforeExpiry, "stub0 should be retried after cooldown expires");
    });

    it('should fast-fail with 429 and retry hint when all tokens are cooled down', async () => {
        let now = 1_000_000_000;
        const resetSeconds = (now + 60_000) / 1000;
        const calls = [];
        const stubs = [0, 1].map((i) =>
            makeOctokitStub(async () => {
                calls.push(i);
                throw rateLimitError({ resetSeconds });
            })
        );
        const client = new GithubClient(stubs, { now: () => now });

        // First request: exhausts all tokens.
        await assert.rejects(() => client.request("GET /a", {}));
        assert.strictEqual(calls.length, 2);

        // Second request: all in cooldown; should throw without any network call.
        now += 1_000; // still before reset
        await assert.rejects(
            () => client.request("GET /b", {}),
            (err) => {
                assert.ok(err instanceof GithubClientError);
                assert.strictEqual(err.status, 429);
                assert.match(err.message, /retry in ~\d+s/);
                return true;
            }
        );
        assert.strictEqual(calls.length, 2, "no additional client calls should be made");
    });

    it('should record cooldown from retry-after on secondary rate limit', async () => {
        let now = 1_000_000_000;
        const calls = { 0: 0, 1: 0 };
        const stub0 = makeOctokitStub(async () => {
            calls[0]++;
            throw secondaryRateLimitError({ retryAfterSeconds: 30 });
        });
        const stub1 = makeOctokitStub(async () => {
            calls[1]++;
            return { data: "ok" };
        });
        const client = new GithubClient([stub0, stub1], { now: () => now });

        // Call 1: stub0 rate-limited via retry-after, stub1 succeeds.
        await client.request("GET /a", {});
        assert.strictEqual(calls[0], 1);

        // Within the 30s window: stub0 stays skipped.
        now += 20_000;
        await client.request("GET /b", {});
        assert.strictEqual(calls[0], 1, "stub0 stays cooled within retry-after window");

        // After 30s: stub0 re-enters rotation and gets re-limited.
        now += 15_000;
        await client.request("GET /c", {});
        assert.strictEqual(calls[0], 2, "stub0 retried after retry-after window");
    });

    it('should not record a cooldown for non-rate-limit 403s', async () => {
        const calls = { 0: 0, 1: 0 };
        const stub0 = makeOctokitStub(async () => {
            calls[0]++;
            throw forbiddenError();
        });
        const stub1 = makeOctokitStub(async () => {
            calls[1]++;
            return { data: "ok" };
        });
        const client = new GithubClient([stub0, stub1]);

        // Call 1: stub0 throws forbidden → no cooldown recorded.
        await assert.rejects(() => client.request("GET /a", {}));
        // Call 2: cursor=1, hits stub1 successfully.
        await client.request("GET /b", {});
        // Call 3: cursor wraps to stub0, which throws again — proves no cooldown
        // was recorded (otherwise stub0 would have been skipped).
        await assert.rejects(() => client.request("GET /c", {}));
        assert.strictEqual(calls[0], 2, "stub0 retried because no cooldown was recorded");
    });

    it('concurrent requests should not skip clients on rate-limit rotation', async () => {
        let call1Count = 0;
        // Client 0: rate-limited on first call, succeeds after
        const stub0 = makeOctokitStub(async () => {
            call1Count++;
            if (call1Count === 1) throw rateLimitError();
            return { data: "0-retry" };
        });
        const stub1 = makeOctokitStub(async () => {
            await new Promise(r => setTimeout(r, 10));
            return { data: "1-ok" };
        });
        const client = new GithubClient([stub0, stub1]);

        // Request A starts on client 0 (rate-limited, falls through to client 1)
        // Request B starts on client 1 (succeeds)
        const [rA, rB] = await Promise.all([
            client.request("GET /a", {}),
            client.request("GET /b", {}),
        ]);

        // Both should succeed — neither should fail because the other
        // request mutated shared state
        assert.ok(rA.data);
        assert.ok(rB.data);
    });
});

// --- Helpers ---

function makeOctokitStub(fn) {
    return { request: fn };
}

function rateLimitError({ resetSeconds } = {}) {
    const err = new Error("rate limit");
    err.status = 403;
    const headers = { "x-ratelimit-remaining": "0", "x-ratelimit-limit": "5000" };
    if (resetSeconds !== undefined) headers["x-ratelimit-reset"] = String(resetSeconds);
    err.response = { headers };
    return err;
}

function secondaryRateLimitError({ retryAfterSeconds = 60 } = {}) {
    const err = new Error("You have exceeded a secondary rate limit");
    err.status = 403;
    err.response = { headers: { "retry-after": String(retryAfterSeconds) } };
    return err;
}

function forbiddenError() {
    const err = new Error("forbidden");
    err.status = 403;
    err.response = { headers: {} };
    return err;
}

function notFoundError() {
    const err = new Error("not found");
    err.status = 404;
    return err;
}
