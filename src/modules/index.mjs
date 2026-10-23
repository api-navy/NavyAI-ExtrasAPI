import whisperStt from './whisper-stt.mjs';
import sd from './sd.mjs';
import classify from './classify.mjs';
import summarize from './summarize.mjs';
import caption from './caption.mjs';
import embeddings from './embeddings.mjs';

export const MODULES = {
    'whisper-stt': whisperStt,
    'sd': sd,
    'classify': classify,
    'summarize': summarize,
    'caption': caption,
    'embeddings': embeddings,
};
