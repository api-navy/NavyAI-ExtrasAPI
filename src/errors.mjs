import { settings } from './config.mjs';

/**
 * Log an upstream failure and send the matching error response.
 */
export function sendError(reply, label, error) {
    const cause = error?.cause?.message ? ` (${error.cause.message})` : '';
    const message = (error?.message || String(error)) + cause;
    console.error(`[${label}] ${message}`);

    if (error?.name === 'TimeoutError') {
        return reply.code(504).send({ error: `${label} timed out after ${settings.navy.timeoutMs} ms` });
    }

    return reply.code(502).send({ error: message });
}
