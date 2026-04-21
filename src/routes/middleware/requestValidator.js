import { ZodError } from "zod";

/**
 * @typedef {Object} RequestSchemas
 * @property {import("zod").ZodTypeAny} [body]
 * @property {import("zod").ZodTypeAny} [params]
 * @property {import("zod").ZodTypeAny} [query]
 */

const SOURCES = ["body", "params", "query"];

/**
 * Returns an Express middleware that parses req.body / req.params / req.query
 * with the supplied Zod schemas. On failure responds 400 with a structured
 * list of field-level issues. On success, the parsed (coerced, stripped)
 * values overwrite the originals so handlers operate on trusted input.
 *
 * @param {RequestSchemas} schemas
 */
export function validateRequest(schemas) {
    return (req, res, next) => {
        try {
            for (const source of SOURCES) {
                const schema = schemas[source];
                if (!schema) continue;
                const parsed = schema.parse(req[source]);
                if (source === "query") {
                    // Express 5 makes req.query a getter; assign keys individually
                    // to stay compatible across versions.
                    for (const key of Object.keys(req.query)) delete req.query[key];
                    Object.assign(req.query, parsed);
                } else {
                    req[source] = parsed;
                }
            }
            next();
        } catch (err) {
            if (err instanceof ZodError) {
                return res.status(400).json({
                    error: "Validation failed",
                    details: err.issues.map((i) => ({
                        path: i.path.join("."),
                        message: i.message,
                    })),
                });
            }
            next(err);
        }
    };
}
