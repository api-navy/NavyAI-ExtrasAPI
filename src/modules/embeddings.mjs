import { settings } from '../config.mjs';
import { navyPost } from '../navy.mjs';
import { sendError } from '../errors.mjs';

export default async function embeddingsModule(fastify) {
    const embeddingModel = settings.models.embedding ?? 'text-embedding-3-small';

    fastify.post('/api/embeddings/compute', async (request, reply) => {
        const text = request.body?.text;
        const valid = typeof text === 'string' ? text.length > 0 : Array.isArray(text) && text.length > 0;

        if (!valid) {
            return reply.code(400).send({ error: 'Missing "text"' });
        }

        try {
            const result = await navyPost('/embeddings', { json: { model: embeddingModel, input: text } });

            if (!result.data?.length) {
                throw new Error('No embeddings in response');
            }

            const embedding = typeof text === 'string'
                ? result.data[0].embedding
                : result.data.map((item) => item.embedding);

            return reply.send({ embedding });
        } catch (error) {
            return sendError(reply, 'EMBEDDINGS', error);
        }
    });
}
