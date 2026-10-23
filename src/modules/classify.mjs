import { settings } from '../config.mjs';
import { chatText } from '../navy.mjs';
import { sendError } from '../errors.mjs';

const DEFAULT_LABELS = ['joy', 'anger', 'surprise', 'sadness', 'fear', 'love'];

export default async function classifyModule(fastify) {
    const instruction = settings.prompts.classification?.instruction ?? 'Classify this text.';
    const labels = settings.prompts.classification?.labels ?? DEFAULT_LABELS;
    const classificationModel = settings.models.classification ?? 'glm-5.3-flash';
    const systemPrompt = `${instruction}\n${labels.join(', ')}`;

    fastify.get('/api/classify/labels', async (_request, reply) => {
        return reply.send({ labels });
    });

    fastify.post('/api/classify', async (request, reply) => {
        const text = request.body?.text;

        if (typeof text !== 'string' || !text.trim()) {
            return reply.code(400).send({ error: 'Missing "text"' });
        }

        try {
            const answer = (await chatText(classificationModel, [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text },
            ])).toLowerCase();

            const label = labels.find((candidate) => answer.trim() === candidate.toLowerCase())
                ?? labels.find((candidate) => answer.includes(candidate.toLowerCase()));

            if (!label) {
                throw new Error(`Model answered "${answer.slice(0, 100)}" which matches no label`);
            }

            return reply.send({ classification: [{ label, score: 1.0 }] });
        } catch (error) {
            return sendError(reply, 'CLASSIFY', error);
        }
    });
}
