import { z } from "zod";

// Solana base58 pubkeys: 32–44 chars, excluding 0, O, I, l from the alphabet.
export const walletAddressSchema = z
    .string()
    .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "must be a valid Solana base58 address (32–44 chars)");

// Opaque client identifier. The faucet sends IPs with delimiters stripped
// (e.g. "192.168.1.1" → "19216811", "::1" → "1"). Stored as-is and used as a
// DB key, so we only bound length and don't validate IP format. If the
// frontend ever switches to raw IPs, stored rows must be migrated in lockstep
// or rate limiting will silently stop matching.
export const ipAddressSchema = z
    .string()
    .min(1, "must not be empty")
    .max(45, "must be 45 characters or fewer");

export const githubIdSchema = z
    .string()
    .max(20, "must be 20 characters or fewer")
    .regex(/^\d+$/, "must be a numeric GitHub user ID");
