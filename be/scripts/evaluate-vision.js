import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createAI } from '../src/services/ai.js';
import { createLocalReferenceVision } from '../src/services/reference-vision.js';
import { vendors } from '../src/data/catalog.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const manifestPath = resolve(
  root,
  args.find((arg) => !arg.startsWith('--')) || 'be/eval/vision-samples.json',
);
const model =
  args.find((arg) => arg.startsWith('--model='))?.slice(8) || 'qwen3-vl:8b-instruct-q8_0';
const baseUrl =
  args.find((arg) => arg.startsWith('--base-url='))?.slice(11) ||
  process.env.OLLAMA_BASE_URL ||
  'http://127.0.0.1:11435';
const caseId = args.find((arg) => arg.startsWith('--case='))?.slice(7);
const split = args.find((arg) => arg.startsWith('--split='))?.slice(8);
const trace = [];
const output = resolve(
  root,
  args.find((arg) => arg.startsWith('--output='))?.slice(9) || '.reference/vision-evaluation.json',
);
const referenceVision = args.includes('--references') ? createLocalReferenceVision() : null;
if (args.includes('--references') && !referenceVision.configured)
  throw new Error('Reference index/environment is missing. Run the vision setup and index build.');
const ai = createAI({
  provider: 'ollama',
  model,
  baseUrl,
  timeoutMs: 180000,
  referenceVision,
  fetchImpl: args.includes('--trace')
    ? async (url, options) => {
        const response = await fetch(url, options);
        const data = await response.clone().json();
        trace.push(data.message?.content || data.error || data);
        return response;
      }
    : fetch,
});
const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const cases = (Array.isArray(manifest) ? manifest : manifest.records).filter(
  (sample) => (!caseId || sample.id === caseId) && (!split || sample.split === split),
);
if (!cases.length) throw new Error('No evaluation cases matched the requested selection');
const sourceFiles = [
  'src/services/ai.js',
  'src/services/food-recognition.js',
  'src/services/food-features.js',
  'src/data/dish-vision.js',
  'src/services/reference-vision.js',
  'vision/encoder.py',
  'vision/config.py',
  'vision/retrieval.py',
  'vision/worker.py',
  'scripts/ollama-local.js',
];
const fingerprint = createHash('sha256').update(manifestBytes).update(model).update(baseUrl);
for (const file of sourceFiles) fingerprint.update(await readFile(resolve(root, 'be', file)));
if (referenceVision)
  fingerprint.update(await readFile(resolve(root, '.reference/vision-index.npz')));
const runFingerprint = fingerprint.digest('hex');
const cache = resolve(root, '.reference/vision-images');
await mkdir(cache, { recursive: true });
await mkdir(dirname(output), { recursive: true });
let results = [];
if (args.includes('--resume')) {
  try {
    const saved = JSON.parse(await readFile(output, 'utf8'));
    if (saved.runFingerprint !== runFingerprint)
      throw new Error('Resume refused: dataset, model or pipeline changed');
    const selectedIds = new Set(cases.map((sample) => sample.id));
    if (
      saved.results.some((row) => !selectedIds.has(row.id)) ||
      Boolean(saved.referenceOnly) !== args.includes('--reference-only')
    )
      throw new Error('Resume refused: evaluation scope or reference split changed');
    results = saved.results;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
const completed = new Set(results.map((row) => row.id));

for (const sample of cases) {
  if (completed.has(sample.id)) continue;
  trace.length = 0;
  const started = Date.now();
  try {
    if (!/^[a-z0-9-]+$/.test(sample.id)) throw new Error('Invalid sample ID');
    let bytes;
    if (sample.path) {
      bytes = await readFile(resolve(root, sample.path));
    } else {
      const cachePath = resolve(cache, `${sample.id}.jpg`);
      try {
        bytes = await readFile(cachePath);
      } catch {
        const response = await fetch(sample.url, {
          headers: { 'User-Agent': 'ChamViVisionEvaluation/1.0 (local development)' },
          signal: AbortSignal.timeout(60000),
        });
        if (!response.ok) throw new Error(`Image download returned ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
        await writeFile(cachePath, bytes);
      }
    }
    if (sample.sha256 && createHash('sha256').update(bytes).digest('hex') !== sample.sha256)
      throw new Error('Dataset photo changed; regenerate the manifest');
    const observation = await ai.scan(
      { mimeType: 'image/jpeg', base64: bytes.toString('base64') },
      vendors,
      sample.selectedVendorId,
      { referenceExcludeGroup: sample.group, referenceOnly: args.includes('--reference-only') },
    );
    results.push({
      id: sample.id,
      path: sample.path,
      split: sample.split,
      expected: sample.expectedVendorId,
      observation,
      correct: observation.matchedVendorId === sample.expectedVendorId,
      elapsedMs: Date.now() - started,
      ...(args.includes('--trace') ? { trace: [...trace] } : {}),
    });
  } catch (error) {
    results.push({
      id: sample.id,
      path: sample.path,
      split: sample.split,
      expected: sample.expectedVendorId,
      error: error.message,
      correct: false,
      elapsedMs: Date.now() - started,
      ...(args.includes('--trace') ? { trace: [...trace] } : {}),
    });
  }
  console.log(
    args.includes('--quiet')
      ? `[${results.length}/${cases.length}] ${sample.id}: ${results.at(-1).correct ? 'correct' : results.at(-1).error || results.at(-1).observation?.status}`
      : JSON.stringify(results.at(-1)),
  );
  await writeFile(
    `${output}.tmp`,
    JSON.stringify(
      {
        model,
        runFingerprint,
        pipeline: ai.visionPipeline,
        referenceOnly: args.includes('--reference-only'),
        referenceIndex: referenceVision
          ? 'Reference/development index; query group excluded; test photos excluded from index'
          : null,
        evaluatedAt: new Date().toISOString(),
        results,
      },
      null,
      2,
    ),
  );
  await rename(`${output}.tmp`, output);
}
referenceVision?.close();

console.log(
  `${results.filter((row) => row.correct).length}/${results.length} correct; ${results.filter((row) => row.error).length} errors. This small regression set is not a population accuracy estimate.`,
);
if (results.some((row) => !row.correct)) process.exitCode = 1;
