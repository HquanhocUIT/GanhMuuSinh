import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { openDatabase } from './db.js';
import { createAI } from './services/ai.js';
import { createLocalReferenceVision } from './services/reference-vision.js';
import { createApp } from './app.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(root, '.env'), quiet: true });
const db = openDatabase(process.env.DATABASE_PATH || resolve(root, 'data/ganhmuusinh.sqlite'));
const aiProvider = process.env.AI_PROVIDER || 'ollama';
const referenceVision = createLocalReferenceVision();
const app = createApp({
  db,
  ai: createAI({
    provider: aiProvider,
    apiKey: process.env.GEMINI_API_KEY,
    model:
      aiProvider === 'gemini'
        ? process.env.GEMINI_MODEL || 'gemini-3.8-flash'
        : process.env.OLLAMA_MODEL || 'qwen3-vl:8b-instruct-q8_0',
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11435',
    referenceVision,
  }),
  frontendPath: resolve(root, '../fe/dist'),
});
// Render and similar container hosts need the process to listen on the public
// container interface. Keep the local development default loopback-only.
const host = process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1');
const server = app.listen(Number(process.env.PORT || 4000), host, () =>
  console.log(`Chạm Vị API: http://${host}:${process.env.PORT || 4000}`),
);
const stop = () =>
  server.close(() => {
    referenceVision.close();
    db.close();
    process.exit(0);
  });
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
