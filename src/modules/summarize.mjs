import { settings } from '../config.mjs';
import { chatText } from '../navy.mjs';
import { sendError } from '../errors.mjs';

export default async function summarizeModule(fastify) {
    const summarizationPrompt = settings.prompts.summarization ?? 'Summarize this text.';
    const summarizationModel = settings.models.summarization ?? 'glm-5.3-flash';

    fastify.post('/api/summarize', async (request, reply) => {
        const text = request.body?.text;

        if (typeof text !== 'string' || !text.trim()) {
            return reply.code(400).send({ error: 'Missing "text"' });
        }

        try {
            const summary = await chatText(summarizationModel, [
                { role: 'system', content: summarizationPrompt },
                { role: 'user', content: text },
            ]);

            if (!summary) {
                throw new Error('Empty summary in response');
            }

            return reply.send({ summary });
        } catch (error) {
            return sendError(reply, 'SUMMARIZE', error);
        }
    });
}
