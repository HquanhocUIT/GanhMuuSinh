import { spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: resolve(root, 'be/.env'), quiet: true });
const managedUrl = 'http://127.0.0.1:11435';
const baseUrl = (process.env.OLLAMA_BASE_URL || managedUrl).replace(/\/+$/, '');
let child;
const heartbeat = setInterval(() => {}, 60000);

async function ready() {
  try {
    const response = await fetch(`${managedUrl}/api/version`, {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok && Boolean((await response.json()).version);
  } catch {
    return false;
  }
}

async function stop() {
  clearInterval(heartbeat);
  if (child) {
    // Release this project's model before stopping its server. The normal
    // Ollama app on port 11434 is a separate process and is left running.
    try {
      const response = await fetch(`${managedUrl}/api/ps`, { signal: AbortSignal.timeout(3000) });
      const { models = [] } = await response.json();
      await Promise.all(
        models.map((model) =>
          fetch(`${managedUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: model.name, keep_alive: 0 }),
            signal: AbortSignal.timeout(5000),
          }),
        ),
      );
    } catch {}
    child.kill();
  }
  process.exit(0);
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

if ((process.env.AI_PROVIDER || 'ollama') !== 'ollama' || baseUrl !== managedUrl) {
  console.log('[AI] Using the configured AI provider/server.');
} else if (await ready()) {
  console.log(`[AI] Reusing project Ollama at ${managedUrl}.`);
} else {
  mkdirSync(resolve(root, '.reference'), { recursive: true });
  const log = openSync(resolve(root, '.reference/ollama-local.log'), 'a');
  child = spawn(process.env.OLLAMA_BIN || 'ollama', ['serve'], {
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', log, log],
    env: {
      ...process.env,
      OLLAMA_HOST: '127.0.0.1:11435',
      OLLAMA_DEBUG: '0',
      OLLAMA_NUM_PARALLEL: '1',
      OLLAMA_MAX_LOADED_MODELS: '1',
      // llama-server otherwise retains up to 8 GiB of evicted prompt states
      // in host RAM, which exhausted this 16 GiB machine during image scans.
      LLAMA_ARG_CACHE_RAM: '512',
      LLAMA_ARG_CTX_CHECKPOINTS: '4',
    },
  });
  closeSync(log);
  child.once('error', (error) => {
    child = null;
    console.error(
      `[AI] Could not start Ollama: ${error.message}. Install Ollama or configure OLLAMA_BASE_URL.`,
    );
  });
  child.once('exit', () => {
    child = null;
  });
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await ready()) {
      console.log(
        `[AI] Project Ollama ready at ${managedUrl}; host prompt cache limited to 512 MiB.`,
      );
      break;
    }
    await new Promise((done) => setTimeout(done, 500));
  }
}
