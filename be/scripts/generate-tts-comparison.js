import dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '../..');
dotenv.config({ path: resolve(projectRoot, 'be/.env'), quiet: true });

const outputDir = resolve(projectRoot, 'local-audio-test');
const apiTimeout = 90000;
const samples = [
  {
    key: 'story',
    text: 'Trong câu chuyện minh họa, cô Út bán bánh bèo bì ở Thủ Dầu Một. Chén bánh mềm làm từ bột gạo, ăn cùng bì heo, đậu xanh, rau và nước mắm. Chan nước mắm vừa miệng rồi thưởng thức khi bánh còn mềm. Cô Út là nhân vật hư cấu; món ăn và nguyên liệu chưa được xác minh ngoài đời.',
  },
  {
    key: 'order',
    text: 'Cô ơi, cho con một phần bánh bèo bì, ít nước mắm thôi nha. Con cảm ơn cô!',
  },
];

async function request(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(apiTimeout) });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }
  return response;
}

async function saveSample(filename, bytes) {
  await writeFile(resolve(outputDir, filename), bytes);
  console.log(`Saved ${filename}`);
}

async function generateGemini(voice, sample) {
  const response = await request('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      model: 'gemini-3.8-flash-tts',
      input: [
        {
          type: 'user_input',
          content: [
            {
              type: 'text',
              text: sample.text,
              annotations: [
                {
                  type: 'speech_metadata',
                  style:
                    'Vietnamese, Southern Vietnamese accent, natural everyday delivery, warm, clear, moderately slow, not theatrical.',
                },
              ],
            },
          ],
        },
      ],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice }] },
    }),
  });
  const result = await response.json();
  const base64 =
    result.output_audio?.data ??
    result.steps
      ?.filter((step) => step.type === 'model_output')
      .flatMap((step) => step.content ?? [])
      .filter((part) => part.type === 'audio')
      .at(-1)?.data;
  if (!base64) throw new Error(`Gemini returned no audio for voice ${voice}.`);
  await saveSample(
    `gemini-${voice.toLowerCase()}-${sample.key}.wav`,
    Buffer.from(base64, 'base64'),
  );
}

function xmlEscape(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function generateAzure(voice, sample) {
  const region = process.env.AZURE_SPEECH_REGION;
  if (!/^[a-z0-9-]+$/i.test(region)) throw new Error('AZURE_SPEECH_REGION is invalid.');
  const ssml = `<speak version="1.0" xml:lang="vi-VN"><voice name="${voice}"><prosody rate="-4%">${xmlEscape(sample.text)}</prosody></voice></speak>`;
  const response = await request(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ssml+xml',
        'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
        'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
      },
      body: ssml,
    },
  );
  await saveSample(
    `azure-${voice.toLowerCase()}-${sample.key}.wav`,
    Buffer.from(await response.arrayBuffer()),
  );
}

async function runProvider(name, voices, generate) {
  let generated = 0;
  for (const voice of voices) {
    for (const sample of samples) {
      try {
        await generate(voice, sample);
        generated++;
      } catch (error) {
        console.error(`${name} ${voice} ${sample.key}: ${error.message}`);
      }
    }
  }
  return generated;
}

const hasGemini = Boolean(process.env.GEMINI_API_KEY);
const hasAzure = Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
if (!hasGemini && !hasAzure) {
  console.error(
    'No TTS credentials found. Add GEMINI_API_KEY and/or AZURE_SPEECH_KEY + AZURE_SPEECH_REGION to be/.env. Do not paste keys into chat.',
  );
  process.exitCode = 2;
} else {
  await mkdir(outputDir, { recursive: true });
  let generated = 0;
  if (hasGemini) generated += await runProvider('Gemini TTS', ['Kore', 'Sulafat'], generateGemini);
  else console.log('Skipped Gemini TTS: GEMINI_API_KEY is not configured.');
  if (hasAzure)
    generated += await runProvider(
      'Azure Speech',
      ['vi-VN-HoaiMyNeural', 'vi-VN-NamMinhNeural'],
      generateAzure,
    );
  else console.log('Skipped Azure Speech: add both Azure key and region to compare it.');
  console.log(`Generated ${generated} of up to 8 samples in ${outputDir}`);
}
