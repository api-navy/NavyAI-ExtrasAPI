import { settings } from '../config.mjs';
import { navyPost } from '../navy.mjs';
import { sendError } from '../errors.mjs';

export default async function whisperSttModule(fastify) {
    const whisperModel = settings.models.whisper ?? 'whisper-1';

    fastify.post('/api/speech-recognition/whisper/process-audio', async (request, reply) => {
        try {
            const file = await request.file();

            if (!file) {
                return reply.code(400).send({ error: 'No file uploaded' });
            }

            const audio = await file.toBuffer();
            const form = new FormData();
            form.append('model', whisperModel);
            form.append('file', new Blob([audio], { type: file.mimetype || 'audio/wav' }), file.filename || 'audio.wav');

            const result = await navyPost('/audio/transcriptions', { form });

            if (typeof result.text !== 'string') {
                throw new Error('No transcription text in response');
            }

            return reply.send({ transcript: result.text });
        } catch (error) {
            return sendError(reply, 'WHISPER', error);
        }
    });
}
