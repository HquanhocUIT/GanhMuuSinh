import test from 'node:test';
import assert from 'node:assert/strict';
import { recognizeFood } from '../src/services/food-recognition.js';
import { createAI } from '../src/services/ai.js';
import { vendors } from '../src/data/catalog.js';
import { buildDishCatalog, hasRequiredCues } from '../src/data/dish-vision.js';
import { prepareVisionImage } from '../src/services/vision-image.js';
import { foodFeatureSchema } from '../src/services/food-features.js';
import sharp from 'sharp';

const image = {
  mimeType: 'image/jpeg',
  base64: (
    await sharp({ create: { width: 256, height: 256, channels: 3, background: '#998877' } })
      .jpeg()
      .toBuffer()
  ).toString('base64'),
};
const positive = () => ({
  dishKey: 'bot-chien',
  confidence: 0.96,
  visibleCueIds: ['rice-cake-blocks', 'egg-layer', 'papaya-shreds'],
  contradictions: [],
});
const classification = (candidate = positive()) => ({
  quality: 'clear',
  description: 'Thick rice-cake blocks and flat egg, not little round cups.',
  candidates: [candidate],
});
const review = () => ({
  ...positive(),
  verdict: 'supported',
  explanation: 'Thấy miếng bột cắt chiên vàng và lớp trứng phẳng.',
});
const geometry = (patch = {}) => ({
  hasSolidBlocks: true,
  hasRoundCups: false,
  hasFlatEggSheet: true,
  hasRiceMound: false,
  hasBroth: false,
  description: 'Flat egg and solid cut pieces.',
  ...patch,
});

function sequence(...responses) {
  const calls = [];
  const generate = async (...args) => {
    calls.push(args);
    assert.ok(responses.length, 'Unexpected extra model call');
    return responses.shift();
  };
  return { generate, calls };
}

function referenceEvidence(key = 'bot-chien', similarity = 0.9, margin = 0.1) {
  return {
    margin,
    candidates: [
      { dishKey: key, similarity, referenceIds: ['ref-a', 'ref-b'], images: [image, image] },
      {
        dishKey: key === 'banh-beo' ? 'bot-chien' : 'banh-beo',
        similarity: similarity - margin,
        referenceIds: ['ref-c', 'ref-d'],
        images: [image, image],
      },
    ],
  };
}

function visualFeatures(features = {}, patch = {}) {
  return {
    scene: 'food',
    confidence: 0.95,
    features: {
      ...Object.fromEntries(
        Object.keys(foodFeatureSchema.shape.features.shape).map((key) => [key, false]),
      ),
      ...features,
    },
    description: 'Visible shape observations only.',
    ...patch,
  };
}

test('reference comparison requires independent encoder and query-image evidence to agree', async () => {
  const privateStop = { ...vendors[0], id: 'private-stop', name: 'Hidden vendor name' };
  const { generate, calls } = sequence(review());
  const result = await recognizeFood(
    generate,
    image,
    [...vendors, privateStop],
    privateStop.id,
    referenceEvidence(),
  );
  assert.equal(result.matchedVendorId, privateStop.id);
  assert.equal(result.method, 'reference-qwen');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].filter((part) => part.inlineData).length, 3);
  const prompt = calls[0][0].at(-1).text;
  assert.ok(!prompt.includes('private-stop'));
  assert.ok(!prompt.includes('Hidden vendor name'));
  assert.ok(!prompt.includes('similarity'));
  assert.equal(JSON.parse(prompt).examples[0].imageNumber, 2);
});

test('reference disagreement and unknown query never receive a stamp despite high scores', async () => {
  for (const answer of [
    { ...review(), dishKey: 'banh-beo', visibleCueIds: ['steamed-white-discs', 'beo-toppings'] },
    { ...review(), dishKey: 'unknown', visibleCueIds: [] },
    { ...review(), verdict: 'ambiguous' },
    { ...review(), visibleCueIds: ['egg-layer'] },
  ]) {
    const { generate } = sequence(answer, visualFeatures());
    const result = await recognizeFood(generate, image, vendors, 'bot-chien', referenceEvidence());
    assert.equal(result.matchedVendorId, null);
    assert.equal(result.reviewPassed, false);
  }
});

test('weak nearest-reference scores use visual review instead of forcing the nearest class', async () => {
  const { generate, calls } = sequence(geometry(), classification(), review());
  const result = await recognizeFood(
    generate,
    image,
    vendors,
    'bot-chien',
    referenceEvidence('bot-chien', 0.75),
  );
  assert.equal(result.method, 'qwen-review');
  assert.equal(calls.length, 3);
});

test('distant reference matches reject a scene without asking Qwen to invent a served dish', async () => {
  const { generate, calls } = sequence();
  const result = await recognizeFood(
    generate,
    image,
    vendors,
    'bot-chien',
    referenceEvidence('bot-chien', 0.68),
  );
  assert.equal(result.status, 'out-of-catalog');
  assert.equal(result.matchedVendorId, null);
  assert.equal(calls.length, 0);
});

test('egg-free fried cake blocks require reference support while standalone review stays strict', async () => {
  const candidate = { ...positive(), visibleCueIds: ['rice-cake-blocks'] };
  const first = sequence({ ...review(), ...candidate });
  assert.equal(
    (await recognizeFood(first.generate, image, vendors, 'bot-chien', referenceEvidence()))
      .matchedVendorId,
    'bot-chien',
  );
  const standalone = sequence(geometry(), classification(candidate));
  assert.equal(
    (await recognizeFood(standalone.generate, image, vendors, 'bot-chien')).matchedVendorId,
    null,
  );
});

test('a drink colour without cane context requires strong reference consensus', async () => {
  const candidate = {
    dishKey: 'nuoc-mia',
    confidence: 0.95,
    visibleCueIds: ['pale-cane-juice'],
    contradictions: [],
  };
  const answer = {
    ...candidate,
    verdict: 'supported',
    explanation: 'Query matches served juice examples.',
  };
  const first = sequence(answer);
  assert.equal(
    (
      await recognizeFood(
        first.generate,
        image,
        vendors,
        'nuoc-mia',
        referenceEvidence('nuoc-mia', 0.85, 0.12),
      )
    ).matchedVendorId,
    'nuoc-mia',
  );
  const weak = sequence(answer, visualFeatures());
  assert.equal(
    (
      await recognizeFood(
        weak.generate,
        image,
        vendors,
        'nuoc-mia',
        referenceEvidence('nuoc-mia', 0.8, 0.05),
      )
    ).matchedVendorId,
    null,
  );
  const standalone = sequence(geometry(), classification(candidate));
  assert.equal(
    (await recognizeFood(standalone.generate, image, vendors, 'nuoc-mia')).matchedVendorId,
    null,
  );
});

test('single-image feature agreement can resolve an incorrect label-based rejection', async () => {
  const { generate, calls } = sequence(
    { ...review(), dishKey: 'unknown', verdict: 'not-food', visibleCueIds: [] },
    visualFeatures({ cutBlocks: true, starchyCutFaces: true, flatFriedEgg: true }),
  );
  const result = await recognizeFood(generate, image, vendors, 'bot-chien', referenceEvidence());
  assert.equal(result.matchedVendorId, 'bot-chien');
  assert.equal(result.method, 'reference-features');
  const blindPrompt = JSON.stringify(calls[1]);
  assert.ok(!blindPrompt.includes('bot-chien'));
  assert.ok(!blindPrompt.includes('Bột chiên'));
  assert.equal(calls[1][0].filter((part) => part.inlineData).length, 1);
});

test('a close reference alternative requires its own visible morphology before recognition', async () => {
  const refs = referenceEvidence('goi-kho-bo', 0.85, 0.005);
  refs.candidates[1].dishKey = 'bot-chien';
  const { generate } = sequence(
    geometry(),
    classification({ ...positive(), dishKey: 'unknown', visibleCueIds: [] }),
    visualFeatures({ cutBlocks: true, flatFriedEgg: true }),
  );
  const result = await recognizeFood(generate, image, vendors, 'bot-chien', refs);
  assert.equal(result.matchedVendorId, 'bot-chien');
  assert.equal(result.referenceRank, 2);
});

test('weak feature certainty cannot turn an unknown image into a recognized family', async () => {
  const { generate } = sequence(
    { ...review(), dishKey: 'unknown', visibleCueIds: [] },
    visualFeatures({ cutBlocks: true, flatFriedEgg: true }, { confidence: 0.6 }),
  );
  assert.equal(
    (await recognizeFood(generate, image, vendors, 'bot-chien', referenceEvidence()))
      .matchedVendorId,
    null,
  );
});

test('visible food with an unknown family is uncertain rather than incorrectly called nonfood', async () => {
  const { generate } = sequence(
    { ...review(), dishKey: 'unknown', verdict: 'not-food', visibleCueIds: [] },
    visualFeatures(),
  );
  const result = await recognizeFood(generate, image, vendors, 'bot-chien', referenceEvidence());
  assert.equal(result.status, 'uncertain');
  assert.equal(result.matchedVendorId, null);
  assert.equal(result.reviewPassed, false);
});

test('model schemas constrain both dish keys and visual cue IDs', async () => {
  const { generate, calls } = sequence(geometry(), classification(), review());
  await recognizeFood(generate, image, vendors, 'bot-chien');
  const schema = calls[1][2];
  assert.throws(() => schema.parse(classification({ ...positive(), dishKey: 'invented-food' })));
  assert.throws(() =>
    schema.parse(classification({ ...positive(), visibleCueIds: ['invented-cue'] })),
  );
  assert.throws(() =>
    schema.parse(
      classification({
        ...positive(),
        visibleCueIds: [...positive().visibleCueIds, 'individual-cups'],
      }),
    ),
  );
});

test('plain sponge cake and milk coffee belong to the requested broad food families', async () => {
  const cafe = buildDishCatalog([{ id: 'milk-cafe', dish: 'Cà phê sữa đá' }]);
  assert.equal(cafe[0].key, 'ca-phe');
  const candidate = {
    dishKey: 'banh-bong-lan',
    confidence: 0.95,
    visibleCueIds: ['sponge-crumb'],
    contradictions: [],
  };
  const { generate } = sequence(geometry(), classification(candidate), {
    ...candidate,
    verdict: 'supported',
    explanation: 'Small baked sponge cakes, no yolk required.',
  });
  const result = await recognizeFood(generate, image, vendors, 'banh-bong-lan');
  assert.equal(result.matchedVendorId, 'banh-bong-lan');
  assert.equal(result.dishName, 'Bánh bông lan');
});

test('every currently seeded dish has a matching curated visual profile', () => {
  const supported = new Set(buildDishCatalog(vendors).flatMap((profile) => profile.vendorIds));
  assert.deepEqual(
    vendors.filter((vendor) => !supported.has(vendor.id)).map((vendor) => vendor.id),
    [],
  );
});

test('gỏi khô bò accepts visible shredded salad base without requiring papaya certainty', () => {
  const profile = buildDishCatalog(vendors).find((dish) => dish.key === 'goi-kho-bo');
  assert.ok(profile);
  assert.equal(hasRequiredCues(profile, ['shredded-salad-base', 'dark-jerky-strips']), true);
  assert.equal(hasRequiredCues(profile, ['dark-jerky-strips']), false);
});

test('dish recognition requires geometry, classification and independent review', async () => {
  const { generate, calls } = sequence(geometry(), classification(), review());
  const result = await recognizeFood(generate, image, vendors, 'bot-chien');
  assert.equal(result.matchedVendorId, 'bot-chien');
  assert.equal(result.reviewPassed, true);
  assert.equal(calls.length, 3);
  const secondPrompt = calls[2][0][1].text;
  assert.ok(!secondPrompt.includes('Thick rice-cake blocks and flat egg'));
  assert.ok(!secondPrompt.includes('0.96'));
  assert.deepEqual(calls[1][0][0].inlineData, calls[0][0][0].inlineData);
});

test('high self-reported confidence without distinctive cake shape cannot earn a match', async () => {
  const candidate = {
    ...positive(),
    confidence: 0.99,
    visibleCueIds: ['egg-layer', 'papaya-shreds'],
  };
  const { generate, calls } = sequence(geometry(), classification(candidate));
  assert.equal((await recognizeFood(generate, image, vendors, 'bot-chien')).matchedVendorId, null);
  assert.equal(calls.length, 2);
});

test('review disagreement rejects the classification', async () => {
  const { generate } = sequence(geometry(), classification(), {
    ...review(),
    dishKey: 'banh-khot',
  });
  const result = await recognizeFood(generate, image, vendors, 'bot-chien');
  assert.equal(result.matchedVendorId, null);
  assert.equal(result.status, 'uncertain');
});

test('low reviewer confidence or contradictions cannot earn a match', async () => {
  for (const patch of [
    { confidence: 0.7 },
    { contradictions: ['No visible cake blocks'] },
    { visibleCueIds: ['papaya-shreds'] },
  ]) {
    const { generate } = sequence(geometry(), classification(), { ...review(), ...patch });
    assert.equal((await recognizeFood(generate, image, vendors)).matchedVendorId, null);
  }
});

test('close alternatives trigger abstention rather than selecting the requested vendor', async () => {
  const input = classification();
  input.candidates.push({ ...positive(), dishKey: 'goi-kho-bo', confidence: 0.9 });
  const { generate } = sequence(geometry(), input);
  assert.equal((await recognizeFood(generate, image, vendors, 'bot-chien')).status, 'uncertain');
});

test('unknown food, poor photos and nonfood never get forced into a catalog dish', async () => {
  for (const [input, expected] of [
    [classification({ ...positive(), dishKey: 'unknown' }), 'out-of-catalog'],
    [{ ...classification(), quality: 'not-food', candidates: [] }, 'not-food'],
    [{ ...classification(), quality: 'poor-image' }, 'poor-image'],
    [{ ...classification(), quality: 'multiple-dishes' }, 'poor-image'],
  ]) {
    const { generate, calls } = sequence(geometry(), input);
    const result = await recognizeFood(generate, image, vendors, 'bot-chien');
    assert.equal(result.matchedVendorId, null);
    assert.equal(result.status, expected);
    assert.equal(calls.length, 2);
  }
});

test('invented dish keys, duplicate rankings and invented evidence IDs are rejected', async () => {
  for (const input of [
    classification({ ...positive(), dishKey: 'invented' }),
    { ...classification(), candidates: [positive(), positive()] },
    classification({ ...positive(), visibleCueIds: [...positive().visibleCueIds, 'fake-cue'] }),
  ]) {
    const { generate } = sequence(geometry(), input);
    assert.equal((await recognizeFood(generate, image, vendors)).matchedVendorId, null);
  }
});

test('vendors serving the same dish are grouped; selected stop is resolved after recognition', async () => {
  const secondVendor = { ...vendors[0], id: 'another-vendor', name: 'Private seller name' };
  const candidates = [...vendors, secondVendor];
  const { generate, calls } = sequence(geometry(), classification(), review());
  const result = await recognizeFood(generate, image, candidates, secondVendor.id);
  assert.equal(result.matchedVendorId, secondVendor.id);
  for (const [parts] of calls) {
    assert.ok(!parts[1].text.includes(secondVendor.id));
    assert.ok(!parts[1].text.includes(secondVendor.name));
  }
  const catalog = buildDishCatalog(candidates);
  assert.equal(catalog.filter((entry) => entry.key === 'bot-chien').length, 1);
});

test('selecting another dish cannot bias recognition to that stop', async () => {
  const { generate } = sequence(geometry(), classification(), review());
  assert.equal(
    (await recognizeFood(generate, image, vendors, 'banh-khot')).matchedVendorId,
    'bot-chien',
  );
});

test('unsupported dish stops do not make the model guess', async () => {
  const { generate, calls } = sequence();
  const candidates = [...vendors, { id: 'new-dish', dish: 'Món chưa có đặc trưng' }];
  assert.equal(
    (await recognizeFood(generate, image, candidates, 'new-dish')).status,
    'unsupported-dish',
  );
  assert.equal(calls.length, 0);
});

test('Ollama sends structured schemas, deterministic options and fresh image requests', async () => {
  const responses = [geometry(), classification(), review()];
  const calls = [];
  const ai = createAI({
    provider: 'ollama',
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return {
        ok: true,
        json: async () => ({ message: { content: JSON.stringify(responses.shift()) } }),
      };
    },
  });
  assert.equal((await ai.scan(image, vendors, 'bot-chien')).matchedVendorId, 'bot-chien');
  for (const { url, body } of calls) {
    assert.equal(url, 'http://127.0.0.1:11434/api/chat');
    assert.equal(body.model, 'qwen3-vl:8b-instruct-q8_0');
    assert.ok(
      body.format.type === 'object' ||
        (body.format.oneOf || body.format.anyOf)?.every((branch) => branch.type === 'object'),
    );
    assert.equal(body.options.temperature, 0);
    assert.equal(body.stream, false);
    assert.deepEqual(
      body.messages.map((message) => message.role),
      ['system', 'user'],
    );
    assert.deepEqual(body.messages[1].images, [image.base64]);
  }
});

test('neutral geometry contains no dish labels and blocks incompatible classifications', async () => {
  const { generate, calls } = sequence(
    geometry({ hasSolidBlocks: false, hasRoundCups: true, hasFlatEggSheet: false }),
    classification(),
  );
  assert.equal((await recognizeFood(generate, image, vendors, 'bot-chien')).matchedVendorId, null);
  const neutralPrompt = JSON.stringify(calls[0]);
  assert.ok(!neutralPrompt.includes('bot-chien'));
  assert.ok(!neutralPrompt.includes('Bột chiên'));
  const catalog = JSON.parse(calls[1][0][1].text).dishes;
  assert.ok(!catalog.some((dish) => dish.key === 'bot-chien'));
});

test('a rice plate cannot be forced into a supported dish even before names are shown', async () => {
  const { generate, calls } = sequence(geometry({ hasRiceMound: true }));
  assert.equal(
    (await recognizeFood(generate, image, vendors, 'bot-chien')).status,
    'out-of-catalog',
  );
  assert.equal(calls.length, 1);
});

test('round moulded bánh khọt cups remain eligible when an egg layer is visible', async () => {
  const candidate = {
    dishKey: 'banh-khot',
    confidence: 0.95,
    visibleCueIds: ['individual-cups', 'crisp-cup-rims'],
    contradictions: [],
  };
  for (const hasFlatEggSheet of [false, true]) {
    const { generate } = sequence(
      geometry({ hasSolidBlocks: false, hasRoundCups: true, hasFlatEggSheet }),
      classification(candidate),
      { ...candidate, verdict: 'supported', explanation: 'Round moulded cakes and crisp rims.' },
    );
    assert.equal(
      (await recognizeFood(generate, image, vendors, 'banh-khot')).matchedVendorId,
      'banh-khot',
    );
  }
});

test('image preparation preserves suitable original bytes and refuses undecodable/tiny inputs', async () => {
  assert.equal(await prepareVisionImage(image), image);
  const tiny = await sharp({ create: { width: 64, height: 64, channels: 3, background: 'white' } })
    .png()
    .toBuffer();
  await assert.rejects(prepareVisionImage({ base64: tiny.toString('base64') }), /image-too-small/);
  await assert.rejects(
    prepareVisionImage({ base64: Buffer.from('not an image').toString('base64') }),
  );
});

test('large photos retain aspect ratio and normalize EXIF rotation before AI sees them', async () => {
  const bytes = await sharp({
    create: { width: 3000, height: 1500, channels: 3, background: 'white' },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const normalized = await prepareVisionImage({
    mimeType: 'image/jpeg',
    base64: bytes.toString('base64'),
  });
  const metadata = await sharp(Buffer.from(normalized.base64, 'base64')).metadata();
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 2048);
  assert.ok(!metadata.orientation || metadata.orientation === 1);
});
