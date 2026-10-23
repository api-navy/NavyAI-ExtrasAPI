import { settings } from './config.mjs';

const BASE64_MAGIC = [
    ['/9j/', 'image/jpeg'],
    ['iVBOR', 'image/png'],
    ['R0lGOD', 'image/gif'],
    ['UklGR', 'image/webp'],
];

/**
 * Guess the MIME type of a base64 image from its leading bytes.
 */
export function guessImageMime(base64) {
    const match = BASE64_MAGIC.find(([prefix]) => base64.startsWith(prefix));
    return match ? match[1] : 'image/jpeg';
}

const DATA_URI_RE = /data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)/i;
const HTTP_URL_RE = /https?:\/\/[^\s)"'<>]+/i;

/**
 * Turn an image reference (data URI, remote URL, raw base64, or text that
 * contains one of those) into raw base64. Returns null if nothing usable.
 */
export async function resolveImageToBase64(source) {
    if (typeof source !== 'string' || !source) {
        return null;
    }

    const dataUri = source.match(DATA_URI_RE);
    if (dataUri) {
        return dataUri[1].replace(/\s+/g, '');
    }

    const url = source.match(HTTP_URL_RE);
    if (url) {
        const response = await fetch(url[0], { signal: AbortSignal.timeout(settings.navy.timeoutMs) });
        if (!response.ok) {
            throw new Error(`Failed to download generated image (${response.status})`);
        }
        return Buffer.from(await response.arrayBuffer()).toString('base64');
    }

    if (source.length > 100 && /^[A-Za-z0-9+/]+={0,2}$/.test(source.trim())) {
        return source.trim();
    }

    return null;
}
