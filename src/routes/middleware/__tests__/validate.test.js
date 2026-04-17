import { describe, it } from 'node:test';
import assert from 'node:assert';
import { z } from 'zod';
import { validate } from '../validate.js';

describe('validate middleware', () => {
    it('should call next() when all schemas pass', () => {
        const mw = validate({ body: z.object({ x: z.string() }) });
        const req = { body: { x: "ok" } };
        const res = makeRes();
        let nextCalled = false;
        mw(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
        assert.strictEqual(res.statusCode, undefined);
    });

    it('should replace req.body with parsed output (strips unknown keys by default)', () => {
        const mw = validate({ body: z.object({ x: z.string() }) });
        const req = { body: { x: "ok", extra: "dropped" } };
        const res = makeRes();
        mw(req, res, () => {});
        assert.deepStrictEqual(req.body, { x: "ok" });
    });

    it('should reject extra fields when schema is strict', () => {
        const mw = validate({ body: z.object({ x: z.string() }).strict() });
        const req = { body: { x: "ok", extra: "boom" } };
        const res = makeRes();
        mw(req, res, () => {});
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.body.error, "Validation failed");
        assert.deepStrictEqual(res.body.details, [
            { path: "", message: 'Unrecognized key: "extra"' },
        ]);
    });

    it('should return 400 with structured details when body fails', () => {
        const mw = validate({
            body: z.object({
                name: z.string().min(3, "too short"),
                age: z.number(),
            }),
        });
        const req = { body: { name: "a", age: "not a number" } };
        const res = makeRes();
        mw(req, res, () => { assert.fail("next should not be called"); });
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.body.error, "Validation failed");
        const paths = res.body.details.map(d => d.path);
        assert.ok(paths.includes("name"));
        assert.ok(paths.includes("age"));
    });

    it('should validate params', () => {
        const mw = validate({ params: z.object({ id: z.string().regex(/^\d+$/) }) });
        const req = { params: { id: "abc" } };
        const res = makeRes();
        mw(req, res, () => { assert.fail("next should not be called"); });
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.body.details[0].path, "id");
    });

    it('should validate query and update req.query in place', () => {
        const mw = validate({ query: z.object({ page: z.string() }) });
        const req = { query: { page: "1", stray: "dropped" } };
        const res = makeRes();
        let nextCalled = false;
        mw(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
        assert.deepStrictEqual(req.query, { page: "1" });
    });

    it('should skip sources that have no schema', () => {
        const mw = validate({ body: z.object({ x: z.string() }) });
        const req = { body: { x: "ok" }, params: { anything: "goes" }, query: { foo: "bar" } };
        const res = makeRes();
        mw(req, res, () => {});
        assert.deepStrictEqual(req.params, { anything: "goes" });
        assert.deepStrictEqual(req.query, { foo: "bar" });
    });

    it('should forward non-Zod errors to next(err)', () => {
        const boom = new Error("schema blew up");
        const fakeSchema = { parse: () => { throw boom; } };
        const mw = validate({ body: fakeSchema });
        const req = { body: {} };
        const res = makeRes();
        let forwarded;
        mw(req, res, (err) => { forwarded = err; });
        assert.strictEqual(forwarded, boom);
        assert.strictEqual(res.statusCode, undefined);
    });

    it('should short-circuit at the first failing source', () => {
        let paramsCalled = false;
        const paramsSpy = {
            parse: (v) => { paramsCalled = true; return v; },
        };
        const mw = validate({
            body: z.object({ x: z.string() }),
            params: paramsSpy,
        });
        const req = { body: { x: 123 }, params: {} };
        const res = makeRes();
        mw(req, res, () => {});
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(paramsCalled, false);
    });
});

function makeRes() {
    return {
        statusCode: undefined,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    };
}
