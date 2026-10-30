import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import sharp from 'sharp';
import { z } from 'zod';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const resultSchema = z.object({
  margin: z.number().finite(),
  candidates: z
    .array(
      z.object({
        dishKey: z.string().max(80),
        similarity: z.number().min(-1).max(1),
        nearestSimilarity: z.number().min(-1).max(1),
        referenceIds: z.array(z.string()).max(2),
        referencePaths: z.array(z.string()).max(2),
        referenceHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(2),
      }),
    )
    .min(2)
    .max(3),
});

export function createLocalReferenceVision({
  pythonPath = process.env.VISION_PYTHON ||
    resolve(
      root,
      process.platform === 'win32' ? '.venv-vision/Scripts/python.exe' : '.venv-vision/bin/python',
    ),
  indexPath = process.env.VISION_INDEX_PATH || resolve(root, '.reference/vision-index.npz'),
  timeoutMs = 60000,
} = {}) {
  const configured = existsSync(pythonPath) && existsSync(indexPath);
  let child,
    starting,
    idleTimer,
    nextId = 0;
  let queue = Promise.resolve();
  const pending = new Map();
  const images = new Map();

  function stop() {
    clearTimeout(idleTimer);
    child?.kill();
  }
  if (configured) process.once('exit', stop);

  function start() {
    if (child && starting) return starting;
    let startupTimer;
    starting = new Promise((resolveReady, rejectReady) => {
      let diagnostics = '';
      child = spawn(pythonPath, ['-u', resolve(root, 'be/vision/worker.py'), indexPath], {
        cwd: root,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });
      child.stderr.on('data', (chunk) => {
        diagnostics = (diagnostics + chunk.toString()).slice(-2000);
      });
      const lines = createInterface({ input: child.stdout });
      lines.on('line', (line) => {
        try {
          const value = JSON.parse(line);
          if (value.ready) resolveReady(value);
          else if (pending.has(value.id)) {
            const task = pending.get(value.id);
            pending.delete(value.id);
            clearTimeout(task.timer);
            if (value.error) task.reject(new Error(value.error));
            else task.resolve(value);
          }
        } catch {
          /* Never interpret model/library diagnostics as protocol data. */
        }
      });
      const failed = () => {
        child = null;
        starting = null;
        rejectReady(
          new Error(`Local reference vision worker is unavailable. ${diagnostics.trim()}`),
        );
        for (const task of pending.values()) {
          clearTimeout(task.timer);
          task.reject(new Error('Local reference vision worker stopped'));
        }
        pending.clear();
      };
      child.once('error', failed);
      child.once('exit', failed);
      child.stdin.once('error', failed);
      startupTimer = setTimeout(() => {
        rejectReady(new Error('Local reference vision startup timed out'));
        stop();
      }, timeoutMs);
      startupTimer.unref();
      // Clear the startup timer on success or failure without creating an
      // unhandled rejected promise.
    });
    starting.then(
      () => clearTimeout(startupTimer),
      () => clearTimeout(startupTimer),
    );
    return starting;
  }

  async function referenceImage(path, expectedHash) {
    const key = `${path}:${expectedHash}`;
    if (images.has(key)) return images.get(key);
    const datasetRoot = await realpath(resolve(root, 'dataset'));
    const full = await realpath(resolve(root, path));
    const offset = relative(datasetRoot, full);
    if (offset.startsWith('..') || isAbsolute(offset)) throw new Error('Invalid reference path');
    const bytes = await readFile(full);
    if (createHash('sha256').update(bytes).digest('hex') !== expectedHash)
      throw new Error('Reference photos changed; rebuild the vision index');
    const jpeg = await sharp(bytes)
      .rotate()
      .flatten({ background: '#fff' })
      .resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
    const image = { mimeType: 'image/jpeg', base64: jpeg.toString('base64') };
    images.set(key, image);
    return image;
  }

  async function compare(image, options) {
    clearTimeout(idleTimer);
    await start();
    const id = ++nextId;
    const response = await new Promise((resolveResult, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Reference vision inference timed out'));
        stop();
      }, timeoutMs);
      pending.set(id, { resolve: resolveResult, reject, timer });
      child.stdin.write(
        JSON.stringify({
          id,
          image,
          excludeGroup: options.excludeGroup,
          referenceOnly: options.referenceOnly,
        }) + '\n',
        (error) => {
          if (!error) return;
          pending.delete(id);
          clearTimeout(timer);
          reject(error);
        },
      );
    });
    const result = resultSchema.parse(response);
    for (const candidate of result.candidates) {
      candidate.images = await Promise.all(
        candidate.referencePaths.map((path, i) =>
          referenceImage(path, candidate.referenceHashes[i]),
        ),
      );
    }
    idleTimer = setTimeout(stop, 120000);
    idleTimer.unref();
    return result;
  }

  return {
    configured,
    async classify(image, options = {}) {
      if (!configured) return null;
      const task = queue.then(() => compare(image, options));
      queue = task.catch(() => {});
      return task;
    },
    close() {
      process.removeListener('exit', stop);
      stop();
    },
  };
}
