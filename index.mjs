import { getConfig } from './config.mjs';
import Fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyCors from '@fastify/cors';
import localtunnel from '@security-patched/localtunnel';
import { request as undiciRequest } from 'undici';
import FormData from 'form-data';

const fastify = Fastify({
    logger: { level: 'warn' },
    bodyLimit: 104857600, // 100MB
});

const config = getConfig();
const port = config.server?.port || 5100;
const hostname = config.server?.listen ? '0.0.0.0' : 'localhost';
const publicTunnel = config.server?.publicTunnel;
const apiKey = config.server?.apiKey;
const navyApiKey = config.navy?.apiKey;
const navyBaseUrl = config.navy?.apiEndpoint ?? 'https://api.navy/v1';
const disabledModules = config.modules?.disabled ?? [];

const isModuleEnabled = (module) => MODULES.includes(module) && !disabledModules.includes(module);

const MODULES = [
    'whisper-stt',
    'sd',
    'classify',
    'summarize',
    'caption',
    'embeddings',
];

await fastify.register(fastifyCors);

await fastify.register(fastifyMultipart, {
    limits: {
        fileSize: 104857600, // 100MB
    },
});

fastify.get('/', async (_request, reply) => {
    return reply.send('Extras API is working, enter the URL in SillyTavern > Extensions > Extras API.');
});

if (apiKey) {
    fastify.addHook('onRequest', async (request, reply) => {
        if (request.method === 'OPTIONS') {
            return;
        }

        const expectedKey = `Bearer ${apiKey}`;
        const actualKey = request.headers['authorization'];

        if (actualKey !== expectedKey) {
            reply.code(401).send('Unauthorized');
        }
    });
}

fastify.get('/api/modules', async (_request, reply) => {
    return reply.send({ modules: MODULES });
});

if (isModuleEnabled('sd')) {
    const navyImageModel = config.navy?.models?.image ?? 'flux.1-schnell';

    const GEMINI_IMAGE_MODELS = new Set([
        'gemini-3.1-flash-image-preview',
        'gemini-2.5-flash-image',
        'gemini-3-pro-image-preview'
    ]);

    function isGeminiImageModel(model) {
        return GEMINI_IMAGE_MODELS.has(model);
    }

    async function generateImageViaGemini(prompt, model) {
        const response = await undiciRequest(`${navyBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${navyApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'user', content: prompt },
                ],
                extra_body: {
                    google: {
                        response_modalities: ['IMAGE'],
                    },
                },
            }),
        });

        if (response.statusCode !== 200) {
            const errorText = await response.body.text();
            throw new Error(`Gemini image generation failed (${response.statusCode}): ${errorText}`);
        }

        const result = await response.body.json();
        const message = result.choices?.[0]?.message;

        if (!message) {
            throw new Error('No message in Gemini response');
        }

        if (message.images && Array.isArray(message.images) && message.images.length > 0) {
            const imageObj = message.images[0];
            const imageUrl = imageObj.image_url?.url || imageObj.url || '';

            if (imageUrl.startsWith('data:image/')) {
                const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
                if (base64Match) {
                    return base64Match[1];
                }
            }

            if (imageUrl.startsWith('http')) {
                const imgResponse = await undiciRequest(imageUrl);
                if (imgResponse.statusCode === 200) {
                    const buffer = await imgResponse.body.arrayBuffer();
                    return Buffer.from(buffer).toString('base64');
                }
            }
        }

        const content = message.content || '';
        if (content.startsWith('data:image/')) {
            const base64Match = content.match(/^data:image\/[^;]+;base64,(.+)$/);
            if (base64Match) {
                return base64Match[1];
            }
        }

        throw new Error('No image data found in Gemini response');
    }

    async function generateImageViaImageApi(prompt, model, size) {
        const response = await undiciRequest(`${navyBaseUrl}/images/generations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${navyApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                model,
                size,
            }),
        });

        if (response.statusCode !== 200) {
            const errorText = await response.body.text();
            throw new Error(`Image generation failed (${response.statusCode}): ${errorText}`);
        }

        const result = await response.body.json();

        if (!result.data?.[0]) {
            throw new Error('No image data found');
        }

        const imageData = result.data[0];

        if (imageData.b64_json) {
            return imageData.b64_json;
        }

        if (imageData.url) {
            if (imageData.url.startsWith('data:image/')) {
                const base64Match = imageData.url.match(/^data:image\/[^;]+;base64,(.+)$/);
                if (base64Match) {
                    return base64Match[1];
                }
                throw new Error('Invalid data URI format');
            }

            const imgResponse = await undiciRequest(imageData.url);
            if (imgResponse.statusCode !== 200) {
                throw new Error('Failed to fetch image from URL');
            }
            const buffer = await imgResponse.body.arrayBuffer();
            return Buffer.from(buffer).toString('base64');
        }

        throw new Error('No valid image data found in response');
    }

    fastify.post('/api/image', async (request, reply) => {
        try {
            const { width, height, prompt } = request.body;
            const size = `${width}x${height}`;
            console.log(`[IMAGE] Generating image: model=${navyImageModel}, size=${size}..."`);

            let b64_json;

            if (isGeminiImageModel(navyImageModel)) {
                console.log(`[IMAGE] Using Gemini chat completions for model: ${navyImageModel}`);
                b64_json = await generateImageViaGemini(prompt, navyImageModel);
            } else {
                console.log(`[IMAGE] Using images/generations API for model: ${navyImageModel}`);
                b64_json = await generateImageViaImageApi(prompt, navyImageModel, size);
            }

            console.log(`[IMAGE] Success, returning base64 image (${b64_json.length} chars)`);
            return reply.send({ image: b64_json });
        } catch (error) {
            console.error('[IMAGE] Generation failed:', error.message || error);
            if (error.stack) console.error('[IMAGE] Stack:', error.stack);
            return reply.code(500).send({ error: error.message || 'Image generation failed' });
        }
    });

    fastify.get('/api/image/models', async (_request, reply) => {
        return reply.send({ models: [navyImageModel] });
    });

    fastify.get('/api/image/model', async (_request, reply) => {
        return reply.send({ model: navyImageModel });
    });

    fastify.get('/api/image/samplers', async (_request, reply) => {
        return reply.send({ samplers: ['N/A'] });
    });

    fastify.post('/api/image/model', async (_request, reply) => {
        return reply.send({ previous_model: 'N/A', current_model: 'N/A' });
    });
}

if (isModuleEnabled('whisper-stt')) {
    const whisperModel = config.navy?.models?.whisper ?? 'whisper-1';

    fastify.post('/api/speech-recognition/whisper/process-audio', async (request, reply) => {
        try {
            const data = await request.file();

            if (!data) {
                return reply.code(400).send({ error: 'No file uploaded' });
            }

            const audioBuffer = await data.toBuffer();

            const formData = new FormData();
            formData.append('file', audioBuffer, {
                filename: data.filename || 'audio.wav',
                contentType: data.mimetype || 'audio/wav',
            });
            formData.append('model', whisperModel);

            const response = await undiciRequest(`${navyBaseUrl}/audio/transcriptions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${navyApiKey}`,
                    ...formData.getHeaders(),
                },
                body: formData,
            });

            if (response.statusCode !== 200) {
                const errorText = await response.body.text();
                console.error('Transcription failed:', errorText);
                return reply.code(500).send();
            }

            const result = await response.body.json();

            if (!result.text) {
                console.error('No transcription data found');
                return reply.code(500).send();
            }

            return reply.send({ transcript: result.text });
        } catch (error) {
            console.error('Audio processing failed:', error);
            return reply.code(500).send();
        }
    });
}

if (isModuleEnabled('summarize')) {
    const summarizationPrompt = config.prompts?.summarization ?? 'Summarize this text.';
    const summarizationModel = config.navy?.models?.summarization ?? 'gpt-4o-mini';

    fastify.post('/api/summarize', async (request, reply) => {
        try {
            const { text } = request.body;

            const response = await undiciRequest(`${navyBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${navyApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: summarizationPrompt },
                        { role: 'user', content: text },
                    ],
                    model: summarizationModel,
                }),
            });

            if (response.statusCode !== 200) {
                const errorText = await response.body.text();
                console.error('Summarization failed:', errorText);
                return reply.code(500).send();
            }

            const result = await response.body.json();
            const summary = result.choices?.[0]?.message?.content;

            if (!summary) {
                console.error('No summarization data found');
                return reply.code(500).send();
            }

            return reply.send({ summary });
        } catch (error) {
            console.error('Summarization failed:', error);
            return reply.code(500).send();
        }
    });
}

if (isModuleEnabled('caption')) {
    const captioningPrompt = config.prompts?.captioning ?? 'Describe this image.';
    const captioningModel = config.navy?.models?.captioning ?? 'gpt-4o';

    fastify.post('/api/caption', async (request, reply) => {
        try {
            const { image } = request.body;

            if (!image) {
                return reply.code(400).send();
            }

            const response = await undiciRequest(`${navyBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${navyApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: captioningPrompt },
                                { type: 'image_url', image_url: { 'url': `data:image/jpeg;base64,${image}` } },
                            ],
                        },
                    ],
                    model: captioningModel,
                }),
            });

            if (response.statusCode !== 200) {
                const errorText = await response.body.text();
                console.error('Captioning failed:', errorText);
                return reply.code(500).send();
            }

            const result = await response.body.json();
            const caption = result.choices?.[0]?.message?.content;

            if (!caption) {
                console.error('No caption data found');
                return reply.code(500).send();
            }

            return reply.send({ caption });
        } catch (error) {
            console.error('Captioning failed:', error);
            return reply.code(500).send();
        }
    });
}

if (isModuleEnabled('classify')) {
    const classificationPrompt = config.prompts?.classification?.instruction ?? 'Classify this text.';
    const classificationLabels = config.prompts?.classification?.labels ?? ['joy', 'anger', 'surprise', 'sadness', 'fear', 'love'];
    const classificationModel = config.navy?.models?.classification ?? 'gpt-4o-mini';

    fastify.get('/api/classify/labels', async (_request, reply) => {
        return reply.send({ labels: classificationLabels });
    });

    fastify.post('/api/classify', async (request, reply) => {
        try {
            const { text } = request.body;
            const prompt = `${classificationPrompt}\n${classificationLabels.join(', ')}`;

            const response = await undiciRequest(`${navyBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${navyApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: prompt },
                        { role: 'user', content: text },
                    ],
                    model: classificationModel,
                }),
            });

            if (response.statusCode !== 200) {
                const errorText = await response.body.text();
                console.error('Classification failed:', errorText);
                return reply.code(500).send();
            }

            const result = await response.body.json();
            const classificationResult = result.choices?.[0]?.message?.content;

            if (!classificationResult) {
                console.error('No classification data found');
                return reply.code(500).send();
            }

            const lowerResult = classificationResult.toLowerCase();
            for (const label of classificationLabels) {
                if (lowerResult.includes(label.toLowerCase())) {
                    return reply.send({ classification: [{ label, score: 1.0 }] });
                }
            }

            console.error('No matching label found');
            return reply.code(500).send();
        } catch (error) {
            console.error('Classification failed:', error);
            return reply.code(500).send();
        }
    });
}

if (isModuleEnabled('embeddings')) {
    fastify.post('/api/embeddings/compute', async (request, reply) => {
        try {
            const embeddingModel = config.navy?.models?.embedding ?? 'text-embedding-3-small';
            const { text } = request.body;

            if (!text) {
                return reply.code(400).send();
            }

            const response = await undiciRequest(`${navyBaseUrl}/embeddings`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${navyApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: embeddingModel,
                    input: text,
                }),
            });

            if (response.statusCode !== 200) {
                const errorText = await response.body.text();
                console.error('Embeddings failed:', errorText);
                return reply.code(500).send();
            }

            const result = await response.body.json();

            if (!result.data?.length) {
                console.error('No embeddings data found');
                return reply.code(500).send();
            }

            const embedding = typeof text === 'string'
                ? result.data[0].embedding
                : result.data.map(d => d.embedding);

            return reply.send({ embedding });
        } catch (error) {
            console.error('Embeddings failed:', error);
            return reply.code(500).send();
        }
    });
}

async function start() {
    try {
        await fastify.listen({ port: Number(port), host: hostname });
        const url = `http://${hostname}:${port}`;
        console.log(`NavyAI Extras API is running on ${url}`);

        if (publicTunnel) {
            const tunnel = await localtunnel({ port });
            console.log(`Public tunnel is running on ${tunnel.url}`);
        }
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

start();
