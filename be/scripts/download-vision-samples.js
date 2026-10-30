import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const samples = JSON.parse(
  await readFile(resolve(root, process.argv[2] || 'be/eval/vision-samples.json'), 'utf8'),
);
const cache = resolve(root, '.reference/vision-images');
await mkdir(cache, { recursive: true });
for (const sample of samples.filter((sample) => sample.url)) {
  const url = new URL(sample.url);
  if (
    url.protocol !== 'https:' ||
    !['commons.wikimedia.org', 'upload.wikimedia.org'].includes(url.hostname) ||
    !/^[a-z0-9-]+$/.test(sample.id)
  )
    throw new Error('Unexpected sample source');
  try {
    const cached = await readFile(resolve(cache, `${sample.id}.jpg`));
    if (cached[0] === 0xff && cached[1] === 0xd8) {
      console.log(`${sample.id}: cached`);
      continue;
    }
  } catch {}
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(url, {
      headers: { 'User-Agent': 'ChamViVisionEvaluation/1.0' },
      signal: AbortSignal.timeout(60000),
    });
    if (response.status !== 429) break;
    await new Promise((done) => setTimeout(done, 2000 * (attempt + 1)));
  }
  if (!response.ok) throw new Error(`Download ${sample.id}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 5 * 1024 * 1024 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
    throw new Error(`Invalid JPEG: ${sample.id}`);
  await writeFile(resolve(cache, `${sample.id}.jpg`), bytes);
  console.log(`${sample.id}: ${bytes.length} bytes`);
  await new Promise((done) => setTimeout(done, 1500));
}
