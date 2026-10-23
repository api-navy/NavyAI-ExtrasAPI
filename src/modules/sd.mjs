import { settings } from '../config.mjs';
import { chatCompletion, navyPost } from '../navy.mjs';
import { resolveImageToBase64 } from '../images.mjs';
import { sendError } from '../errors.mjs';

const DEFAULT_MODEL = 'flux.2-klein';

export function usesChatImageApi(model, mode = settings.navy.imageApi) {
    if (mode === 'chat') return true;
    if (mode === 'images') return false;

    const id = model.toLowerCase();
    return id.includes('nano-banana') || (id.includes('gemini') && id.includes('image'));
}

function imageCandidatesFromMessage(message) {
    const candidates = [];

    for (const image of message?.images ?? []) {
        if (typeof image === 'string') {
            candidates.push(image);
        } else if (image) {
            candidates.push(image.image_url?.url, image.url, image.b64_json, image.data);
        }
    }

    const content = message?.content;
    if (typeof content === 'string') {
        candidates.push(content);
    } else if (Array.isArray(content)) {
        for (const part of content) {
            if (!part) continue;
            candidates.push(part.image_url?.url, part.url, part.b64_json, part.data, part.text);
        }
    }

    return candidates.filter((candidate) => typeof candidate === 'string' && candidate);
}

async function generateImageViaChat(prompt, model) {
    const message = await chatCompletion(model, [{ role: 'user', content: prompt }], {
        extra_body: { google: { response_modalities: ['IMAGE'] } },
    });

    if (!message) {
        throw new Error('No message in chat completion response');
    }

    for (const candidate of imageCandidatesFromMessage(message)) {
        const base64 = await resolveImageToBase64(candidate);
        if (base64) {
            return base64;
        }
    }

    const refusal = typeof message.content === 'string' ? message.content.slice(0, 300) : '';
    throw new Error(`No image in chat completion response${refusal ? `: ${refusal}` : ''}`);
}

async function generateImageViaImagesApi(prompt, model, size) {
    const result = await navyPost('/images/generations', { json: { model, prompt, size, n: 1 } });
    const image = result.data?.[0];

    if (!image) {
        throw new Error('No image data in /images/generations response');
    }

    const base64 = image.b64_json ?? await resolveImageToBase64(image.url);
    if (!base64) {
        throw new Error('No usable image data in /images/generations response');
    }
    return base64;
}

export default async function sdModule(fastify) {
    const imageModels = [settings.models.image ?? DEFAULT_MODEL]
        .flat()
        .map((model) => String(model).trim())
        .filter(Boolean);
    let currentImageModel = imageModels[0] ?? DEFAULT_MODEL;

    fastify.post('/api/image', async (request, reply) => {
        const body = request.body ?? {};
        const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

        if (!prompt) {
            return reply.code(400).send({ error: 'Missing "prompt"' });
        }

        const width = Number.parseInt(body.width, 10) || 1024;
        const height = Number.parseInt(body.height, 10) || 1024;
        const size = `${width}x${height}`;
        const model = currentImageModel;

        try {
            let base64;
            if (usesChatImageApi(model)) {
                console.log(`[IMAGE] ${model} via chat completions (size ${size} is decided by the model)`);
                base64 = await generateImageViaChat(prompt, model);
            } else {
                console.log(`[IMAGE] ${model} via images/generations, size ${size}`);
                base64 = await generateImageViaImagesApi(prompt, model, size);
            }

            console.log(`[IMAGE] OK (${base64.length} base64 chars)`);
            return reply.send({ image: base64 });
        } catch (error) {
            return sendError(reply, 'IMAGE', error);
        }
    });

    fastify.get('/api/image/models', async (_request, reply) => {
        const models = imageModels.includes(currentImageModel) ? imageModels : [currentImageModel, ...imageModels];
        return reply.send({ models });
    });

    fastify.get('/api/image/model', async (_request, reply) => {
        return reply.send({ model: currentImageModel });
    });

    fastify.post('/api/image/model', async (request, reply) => {
        const requested = typeof request.body?.model === 'string' ? request.body.model.trim() : '';
        const previous = currentImageModel;

        if (requested) {
            currentImageModel = requested;
            console.log(`[IMAGE] Model switched: ${previous} -> ${currentImageModel}`);
        }

        return reply.send({ previous_model: previous, current_model: currentImageModel });
    });

    fastify.get('/api/image/samplers', async (_request, reply) => {
        return reply.send({ samplers: ['N/A'] });
    });
}
