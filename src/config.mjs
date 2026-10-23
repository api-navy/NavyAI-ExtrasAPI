import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const CONFIG_PATH = process.env.NAVY_EXTRAS_CONFIG ?? fileURLToPath(new URL('../config.json', import.meta.url));

function readConfigFile() {
    try {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (error) {
        console.error(`FATAL: Could not read config file at ${CONFIG_PATH}`, error.message);
        console.error('Please ensure config.json exists and is valid JSON.');
        process.exit(1);
    }
}

const raw = readConfigFile();
const server = raw.server ?? {};
const navy = raw.navy ?? {};

export const settings = Object.freeze({
    server: Object.freeze({
        port: Number(server.port ?? 5100),
        host: server.listen ? '0.0.0.0' : 'localhost',
        publicTunnel: Boolean(server.publicTunnel),
        apiKey: server.apiKey || '',
        bodyLimit: 100 * 1024 * 1024, // 100 MB
    }),
    navy: Object.freeze({
        apiKey: navy.apiKey || '',
        baseUrl: String(navy.apiEndpoint ?? 'https://api.navy/v1').replace(/\/+$/, ''),
        timeoutMs: Number(navy.timeoutMs ?? 120_000),
        imageApi: String(navy.imageApi ?? 'auto').toLowerCase(),
    }),
    models: navy.models ?? {},
    prompts: raw.prompts ?? {},
    disabledModules: new Set(raw.modules?.disabled ?? []),
});

if (!settings.navy.apiKey || settings.navy.apiKey === 'YOUR_NAVY_API_KEY_HERE') {
    console.warn('[CONFIG] navy.apiKey is not set. Every NavyAI request will fail until you add your key to config.json.');
}
