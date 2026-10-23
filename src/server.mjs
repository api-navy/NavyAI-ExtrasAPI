import Fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyCors from '@fastify/cors';
import localtunnel from '@security-patched/localtunnel';
import { settings } from './config.mjs';
import { MODULES } from './modules/index.mjs';

const { server } = settings;
const enabledModules = Object.keys(MODULES).filter((name) => !settings.disabledModules.has(name));

export async function buildServer() {
    const fastify = Fastify({
        logger: { level: 'warn' },
        bodyLimit: server.bodyLimit,
    });

    await fastify.register(fastifyCors);
    await fastify.register(fastifyMultipart, { limits: { fileSize: server.bodyLimit } });

    if (server.apiKey) {
        const expectedKey = `Bearer ${server.apiKey}`;
        fastify.addHook('onRequest', async (request, reply) => {
            if (request.method === 'OPTIONS') {
                return;
            }
            if (request.headers.authorization !== expectedKey) {
                return reply.code(401).send('Unauthorized');
            }
        });
    }

    fastify.get('/', async (_request, reply) => {
        return reply.send('Extras API is working, enter the URL in SillyTavern > Extensions > Extras API.');
    });

    fastify.get('/api/modules', async (_request, reply) => {
        return reply.send({ modules: enabledModules });
    });

    for (const name of enabledModules) {
        await fastify.register(MODULES[name]);
    }

    return fastify;
}

export async function start() {
    const fastify = await buildServer();

    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.once(signal, async () => {
            await fastify.close();
            process.exit(0);
        });
    }

    try {
        await fastify.listen({ port: server.port, host: server.host });
        console.log(`NavyAI Extras API is running on http://${server.host}:${server.port}`);
        console.log(`Enabled modules: ${enabledModules.join(', ') || 'none'}`);

        if (server.publicTunnel) {
            const tunnel = await localtunnel({ port: server.port });
            console.log(`Public tunnel is running on ${tunnel.url}`);
            tunnel.on('error', (error) => console.error('[TUNNEL]', error.message));
        }
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
