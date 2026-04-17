import { describe, it } from 'node:test';
import assert from 'node:assert';
import { truncateAddress } from '../index.js';

describe('truncateAddress', () => {
    it('should truncate a full-length Solana address', () => {
        const addr = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
        assert.strictEqual(truncateAddress(addr), '7EcD...FLtV');
    });

    it('should use default chars=4', () => {
        assert.strictEqual(truncateAddress('abcdefghijkl'), 'abcd...ijkl');
    });

    it('should accept a custom chars value', () => {
        assert.strictEqual(truncateAddress('abcdefghijkl', 2), 'ab...kl');
    });

    it('should return the full string when length equals chars*2', () => {
        assert.strictEqual(truncateAddress('abcdefgh'), 'abcdefgh');
    });

    it('should return the full string when shorter than chars*2', () => {
        assert.strictEqual(truncateAddress('abc'), 'abc');
    });

    it('should return "[invalid]" for non-string input', () => {
        assert.strictEqual(truncateAddress(123), '[invalid]');
        assert.strictEqual(truncateAddress(null), '[invalid]');
        assert.strictEqual(truncateAddress(undefined), '[invalid]');
        assert.strictEqual(truncateAddress({}), '[invalid]');
    });

    it('should return "[invalid]" for an empty string', () => {
        assert.strictEqual(truncateAddress(''), '[invalid]');
    });

    it('should handle a single-character string', () => {
        assert.strictEqual(truncateAddress('a'), 'a');
    });

    it('should handle chars=0 gracefully', () => {
        assert.strictEqual(truncateAddress('abcdef', 0), 'abcdef');
    });
});
