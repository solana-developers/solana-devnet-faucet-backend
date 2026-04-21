import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import {
    startPostgres,
    truncateAll,
    seedTransactions,
    fakeGithubClient,
    throwingGithubClient,
    validUserData,
    SAMPLE_WALLET,
} from "./helpers.js";
import { setGithubClientForTests } from "../../src/services/githubClient.js";

let container;
let pool;
let app;

before(async () => {
    const started = await startPostgres();
    container = started.container;
    pool = started.pool;

    // POSTGRES_STRING must be set before db/config.js is imported (it wires
    // its pool at module load). Same for AUTH_DISABLED in authorization.js.
    // Dynamic import after env setup handles both.
    process.env.POSTGRES_STRING = started.connectionString;
    process.env.AUTH_DISABLED = "true";
    const { createApp } = await import("../../src/app.js");
    app = createApp();
});

after(async () => {
    // Drain the app's internal pool before stopping the container, otherwise
    // pg emits "terminating connection" async errors after tests have ended.
    const { default: db } = await import("../../src/db/config.js");
    await db.close();
    await pool?.end();
    await container?.stop();
});

beforeEach(async () => {
    await truncateAll(pool);
    setGithubClientForTests(null);
});

describe("POST /api/solana-balances", () => {
    it("creates a balance and returns the row", async () => {
        const res = await request(app)
            .post("/api/solana-balances")
            .send({ account: "acct-1", balance: 100.5 })
            .expect(201);

        assert.equal(res.body.account, "acct-1");
        assert.equal(res.body.balance, "100.5");
        assert.ok(res.body.date);
        assert.ok(res.body.id);
    });
});

describe("GET /api/solana-balances/recent", () => {
    it("returns an empty array when no rows exist", async () => {
        const res = await request(app).get("/api/solana-balances/recent").expect(200);
        assert.deepEqual(res.body, []);
    });

    it("returns rows within the last month", async () => {
        await request(app).post("/api/solana-balances").send({ account: "a", balance: 1 });
        await request(app).post("/api/solana-balances").send({ account: "b", balance: 2 });

        const res = await request(app).get("/api/solana-balances/recent").expect(200);
        assert.equal(res.body.length, 2);
        const accounts = res.body.map((r) => r.account).sort();
        assert.deepEqual(accounts, ["a", "b"]);
    });
});

describe("POST /api/transactions", () => {
    it("creates a transaction", async () => {
        const res = await request(app)
            .post("/api/transactions")
            .send({
                signature: "sig1",
                ip_address: "19216811",
                wallet_address: SAMPLE_WALLET,
                github_id: "12345",
                timestamp: 1714752000,
            })
            .expect(201);

        assert.equal(res.body.signature, "sig1");
        assert.equal(res.body.wallet_address, SAMPLE_WALLET);
    });

    it("rejects missing required fields", async () => {
        await request(app).post("/api/transactions").send({}).expect(400);
    });
});

describe("GET /api/transactions/last", () => {
    const seedRow = (overrides) => ({
        signature: `sig-${Math.random()}`,
        ip_address: "19216811",
        wallet_address: SAMPLE_WALLET,
        github_id: "12345",
        timestamp: 1714752000,
        ...overrides,
    });

    it("returns the most recent row matching wallet + ip", async () => {
        await seedTransactions(pool, [
            seedRow({ signature: "old", timestamp: 1 }),
            seedRow({ signature: "new", timestamp: 2 }),
        ]);

        const res = await request(app)
            .get("/api/transactions/last")
            .query({ wallet_address: SAMPLE_WALLET, ip_address: "19216811" })
            .expect(200);

        assert.equal(res.body[0].signature, "new");
    });

    it("honors the count query parameter", async () => {
        await seedTransactions(pool, [
            seedRow({ signature: "s1", timestamp: 1 }),
            seedRow({ signature: "s2", timestamp: 2 }),
            seedRow({ signature: "s3", timestamp: 3 }),
        ]);

        const res = await request(app)
            .get("/api/transactions/last")
            .query({ wallet_address: SAMPLE_WALLET, ip_address: "19216811", count: 2 })
            .expect(200);

        assert.equal(res.body.length, 2);
    });

    it("returns 400 when neither wallet nor ip is provided", async () => {
        await request(app).get("/api/transactions/last").expect(400);
    });

    it("returns 400 when wallet_address is missing", async () => {
        await request(app)
            .get("/api/transactions/last")
            .query({ ip_address: "19216811" })
            .expect(400);
    });

    it("returns 400 when ip_address is missing", async () => {
        await request(app)
            .get("/api/transactions/last")
            .query({ wallet_address: SAMPLE_WALLET })
            .expect(400);
    });

    it("returns 200 with an empty array when nothing matches", async () => {
        const res = await request(app)
            .get("/api/transactions/last")
            .query({ wallet_address: SAMPLE_WALLET, ip_address: "19216811" })
            .expect(200);
        assert.deepEqual(res.body, []);
    });
});

describe("POST /api/validate", () => {
    const validBody = {
        ip_address: "19216811",
        wallet_address: SAMPLE_WALLET,
        github_id: "12345",
    };

    it("returns valid when github + transaction history both pass", async () => {
        setGithubClientForTests(fakeGithubClient(validUserData()));

        const res = await request(app).post("/api/validate").send(validBody).expect(200);
        assert.deepEqual(res.body, { valid: true });
    });

    it("rejects a github account that is too new", async () => {
        setGithubClientForTests(
            fakeGithubClient({ ...validUserData(), created_at: new Date().toISOString() })
        );

        const res = await request(app).post("/api/validate").send(validBody).expect(200);
        assert.deepEqual(res.body, { valid: false, reason: "Github account is too new" });
    });

    it("rejects a non-User account type", async () => {
        setGithubClientForTests(fakeGithubClient({ ...validUserData(), type: "Organization" }));

        const res = await request(app).post("/api/validate").send(validBody).expect(200);
        assert.equal(res.body.reason, "Github account type is not allowed");
    });

    it("rejects when the github account is not found (404)", async () => {
        setGithubClientForTests(throwingGithubClient(404));

        const res = await request(app).post("/api/validate").send(validBody).expect(200);
        assert.equal(res.body.reason, "Github account not found");
    });

    it("rejects when the IP transaction limit is exceeded", async () => {
        setGithubClientForTests(fakeGithubClient(validUserData()));

        // TRANSACTION_IP_LIMIT = 300 — seed exactly that so the next request tips over.
        const rows = Array.from({ length: 300 }, (_, i) => ({
            signature: `seed-${i}`,
            ip_address: validBody.ip_address,
            wallet_address: "different_wallet_address",
            github_id: "99999",
            timestamp: i,
        }));
        await seedTransactions(pool, rows);

        const res = await request(app).post("/api/validate").send(validBody).expect(200);
        assert.equal(res.body.reason, "IP address limit exceeded");
    });

    it("returns 400 with structured details on malformed body", async () => {
        const res = await request(app)
            .post("/api/validate")
            .send({ ip_address: "", wallet_address: "too-short", github_id: "not-numeric" })
            .expect(400);

        assert.equal(res.body.error, "Validation failed");
        assert.ok(Array.isArray(res.body.details));
        const paths = res.body.details.map((d) => d.path).sort();
        assert.deepEqual(paths, ["github_id", "ip_address", "wallet_address"]);
    });
});
