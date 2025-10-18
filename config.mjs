import * as fs from 'fs';

const CONFIG_PATH = './config.json';

/**
 * Reads the config file and returns the parsed object.
 * @returns {object} The configuration object
 */
export function getConfig() {
    try {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        return config;
    } catch (error) {
        console.error(`FATAL: Could not read config file at ${CONFIG_PATH}`, error);
        console.error('Please ensure config.json exists and is valid JSON.');
        process.exit(1);
    }
}