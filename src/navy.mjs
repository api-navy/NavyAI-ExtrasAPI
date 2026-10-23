import { settings } from './config.mjs';

const { apiKey, baseUrl, timeoutMs } = settings.navy;

export class NavyError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'NavyError';
        this.status = status;
    }
}

/**
 * POST to the NavyAI API and return the parsed JSON body.
 * @param {string} path e.g. '/chat/completions'
 * @param {{ json?: object, form?: FormData }} payload Exactly one of json or form
 */
export async function navyPost(path, { json, form }) {
    const headers = { Authorization: `Bearer ${apiKey}` };
    let body = form;

    if (json !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(json);
    }

    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new NavyError(`NavyAI ${path} failed (${response.status}): ${text.slice(0, 1000)}`, response.status);
    }

    return response.json();
}

/**
 * Run a chat completion and return the assistant message object (or null).
 */
export async function chatCompletion(model, messages, extra = {}) {
    const result = await navyPost('/chat/completions', { json: { model, messages, ...extra } });
    return result.choices?.[0]?.message ?? null;
}

/**
 * Return the assistant's text content for a chat completion.
 */
export async function chatText(model, messages) {
    const message = await chatCompletion(model, messages);
    const content = message?.content;

    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        return content
            .filter((part) => part?.type === 'text' && typeof part.text === 'string')
            .map((part) => part.text)
            .join('');
    }

    return '';
}
