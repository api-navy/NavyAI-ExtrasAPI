import { settings } from '../config.mjs';
import { chatText } from '../navy.mjs';
import { guessImageMime } from '../images.mjs';
import { sendError } from '../errors.mjs';

export default async function captionModule(fastify) {
    const captioningPrompt = settings.prompts.captioning ?? 'Describe this image.';
    const captioningModel = settings.models.captioning ?? 'glm-5.3-flash';

    fastify.post('/api/caption', async (request, reply) => {
        const image = request.body?.image;

        if (typeof image !== 'string' || !image) {
            return reply.code(400).send({ error: 'Missing "image"' });
        }

        try {
            const url = image.startsWith('data:') ? image : `data:${guessImageMime(image)};base64,${image}`;

            const caption = await chatText(captioningModel, [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: captioningPrompt },
                        { type: 'image_url', image_url: { url } },
                    ],
                },
            ]);

            if (!caption) {
                throw new Error('Empty caption in response');
            }

            return reply.send({ caption });
        } catch (error) {
            return sendError(reply, 'CAPTION', error);
        }
    });
}
