import { pino } from 'pino';

// App Engine / Cloud Logging reads `severity` from structured JSON on stdout;
// pino emits numeric `level` by default, so we map it to the string Cloud
// Logging expects. Everything else stays as plain pino.
export const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    formatters: {
        level: (label) => ({ severity: label.toUpperCase() }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});
