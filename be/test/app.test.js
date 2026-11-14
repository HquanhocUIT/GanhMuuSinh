import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db.js';
import { createAI } from '../src/services/ai.js';
import { vendors } from '../src/data/catalog.js';
import { references } from '../src/data/references.js';
import { distanceKm, planQuest } from '../src/services/planner.js';
import sharp from 'sharp';

const config = {
  region: 'saigon',
  time: 'afternoon',
  budget: 100000,
  excludeAllergens: [],
  maxStops: 4,
};

async function withAPI(run, ai = createAI({})) {
  const db = openDatabase(':memory:');
  const server = createApp({ db, ai }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, body, cookie, headers = {}) {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  }
  try {
    await run(request);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
}

test('planner maximizes stops within budget and region', () => {
  const plan = planQuest(config);
  assert.equal(plan.stops.length, 4);
  assert.ok(plan.budget <= 100000);
  assert.ok(plan.stops.every((v) => v.region === 'saigon'));
  assert.equal(new Set(plan.stops.map((v) => v.id)).size, plan.stops.length);
});

test('planner excludes every selected allergen, including condiments', () => {
  const plan = planQuest({
    ...config,
    excludeAllergens: ['peanut', 'gluten', 'seafood', 'soy', 'egg', 'milk'],
  });
  assert.ok(plan.stops.length >= 1);
  assert.ok(plan.stops.every((v) => !v.allergens.length));
});

test('planner enforces opening hours at arrival and visit completion', () => {
  for (const time of ['morning', 'afternoon', 'night']) {
    const plan = planQuest({ ...config, time });
    for (const v of plan.stops) {
      const [hours, minutes] = v.arrival.split(':').map(Number);
      const arrival = hours + minutes / 60;
      assert.ok(arrival >= v.hours[0] - 1 / 60);
      assert.ok(arrival + 1 / 3 <= v.hours[1] + 1 / 60);
    }
    if (time === 'morning') assert.equal(plan.stops.length, 2);
  }
});

test('planner returns no result when nothing fits, without relaxing allergy constraints', () => {
  assert.equal(planQuest({ ...config, budget: 1 }), null);
  assert.equal(
    planQuest({
      ...config,
      region: 'vungtau',
      time: 'morning',
      excludeAllergens: ['seafood', 'gluten', 'soy'],
    }),
    null,
  );
});

test('distance is symmetric and a route chooses the shortest order', () => {
  assert.equal(distanceKm(vendors[0], vendors[0]), 0);
  assert.ok(
    Math.abs(distanceKm(vendors[0], vendors[1]) - distanceKm(vendors[1], vendors[0])) < 1e-9,
  );
  const plan = planQuest({ ...config, region: 'binhduong', maxStops: 3 });
  const [a, b, c] = plan.stops;
  const actual = distanceKm(a, b) + distanceKm(b, c);
  const alternative = distanceKm(a, c) + distanceKm(c, b);
  assert.ok(actual <= alternative + 1e-9);
});

test('catalog distinguishes illustrative vendors from reference pins and does not pretend AI is connected', async () =>
  withAPI(async (request) => {
    const result = await request('/catalog');
    assert.equal(result.status, 200);
    assert.equal(result.data.dataMode, 'mixed');
    assert.equal(result.data.aiConfigured, false);
    assert.equal(result.data.regions.length, 3);
    assert.deepEqual(
      result.data.vendors.map((vendor) => vendor.id).sort(),
      vendors.map((vendor) => vendor.id).sort(),
    );
    assert.ok(result.data.vendors.every((vendor) => vendor.dataType === 'illustrative'));
    const referenceIds = references
      .filter((ref) => Number.isFinite(ref.lat) && Number.isFinite(ref.lng))
      .map((ref) => `reference-${ref.id}`)
      .sort();
    assert.deepEqual(result.data.mapCandidates.map((pin) => pin.id).sort(), referenceIds);
    assert.ok(result.data.mapCandidates.every((pin) => pin.sourceUrl?.startsWith('https://')));
    assert.ok(
      result.data.quests.every((q) => q.budget === q.stops.reduce((sum, v) => sum + v.price, 0)),
    );
  }));

test('API validates invalid planner budgets, types and allergens', async () =>
  withAPI(async (request) => {
    for (const input of [
      { ...config, budget: -1 },
      { ...config, budget: '100000' },
      { ...config, excludeAllergens: ['unknown'] },
      { ...config, maxStops: 8 },
    ])
      assert.equal((await request('/planner', input)).status, 400);
    assert.equal(
      (await request('/planner', { ...config, budget: 10000, region: 'vungtau' })).status,
      422,
    );
  }));

test('order composition preserves preferences and validates vendor/quantity', async () =>
  withAPI(async (request) => {
    const result = await request('/orders/compose', {
      vendorId: 'bot-chien',
      quantity: 2,
      options: ['no-peanut', 'less-spicy', 'takeaway'],
    });
    assert.equal(result.status, 200);
    assert.match(result.data.vietnamese, /2 phần bột chiên/);
    assert.match(result.data.vietnamese, /không đậu phộng, ít cay, mang về/);
    assert.match(result.data.english, /no peanuts/);
    assert.equal(
      (await request('/orders/compose', { vendorId: 'nope', quantity: 1, options: [] })).status,
      404,
    );
    assert.equal(
      (await request('/orders/compose', { vendorId: 'bot-chien', quantity: 0, options: [] }))
        .status,
      400,
    );
  }));

test('anonymous passport persists demo stamps, is idempotent, and isolates browsers', async () =>
  withAPI(async (request) => {
    const first = await request('/passport');
    assert.ok(first.cookie.startsWith('gms_session='));
    const added = await request('/scans', { mode: 'demo', vendorId: 'bot-chien' }, first.cookie);
    assert.equal(added.data.newStamp, true);
    assert.equal(added.data.purchaseVerified, false);
    assert.equal(added.data.mode, 'demo');
    const again = await request('/scans', { mode: 'demo', vendorId: 'bot-chien' }, first.cookie);
    assert.equal(again.data.newStamp, false);
    assert.equal((await request('/passport', undefined, first.cookie)).data.stamps.length, 1);
    assert.equal((await request('/passport')).data.stamps.length, 0);
    assert.equal(
      (await request('/passport', undefined, 'gms_session=forged')).data.stamps.length,
      0,
    );
  }));

test('ward reference pins receive their own clearly unverified passport stamps', async () =>
  withAPI(async (request) => {
    const route = await request('/planner/ward', { ward: 'Phường Bến Thành' });
    assert.equal(route.status, 200);
    const pin = route.data.routes[0].stops[0];
    const passport = await request('/passport');
    const stamp = await request('/scans', { mode: 'demo', vendorId: pin.id }, passport.cookie);
    assert.equal(stamp.status, 200);
    assert.equal(stamp.data.vendor.id, pin.id);
    assert.equal(stamp.data.vendor.name, pin.name);
    assert.equal(stamp.data.vendor.allergensKnown, false);
    assert.deepEqual(stamp.data.vendor.ingredients, []);
    assert.equal(stamp.data.purchaseVerified, false);
    const saved = await request('/passport', undefined, passport.cookie);
    assert.equal(saved.data.stamps[0].vendorId, pin.id);
    assert.equal(saved.data.stamps[0].vendor.dataType, 'reference');
    assert.equal(
      (await request('/scans', { mode: 'demo', vendorId: pin.id }, passport.cookie)).data.newStamp,
      false,
    );
    assert.equal(
      (await request('/scans', { mode: 'demo', vendorId: 'reference-invalid' })).status,
      404,
    );
  }));

test('AI stamps a reference stop only when the observed dish matches that stop', async () => {
  const image = {
    mimeType: 'image/png',
    base64: (
      await sharp({ create: { width: 256, height: 256, channels: 3, background: 'white' } })
        .png()
        .toBuffer()
    ).toString('base64'),
  };
  let matched = false;
  const ai = {
    configured: true,
    provider: 'test',
    model: 'test',
    visionPipeline: 'test',
    referenceConfigured: false,
    async scan(_image, candidates, expectedId) {
      assert.ok(candidates.some((candidate) => candidate.id === expectedId));
      return {
        status: 'recognized',
        matchedVendorId: matched ? expectedId : 'bot-chien',
        dishName: matched ? 'Bánh mì' : 'Bột chiên',
        confidence: 0.93,
        explanation: 'Kết quả thử nghiệm.',
      };
    },
  };
  await withAPI(async (request) => {
    const route = await request('/planner/ward', { ward: 'Phường Bến Thành' });
    const pin = route.data.routes
      .flatMap((item) => item.stops)
      .find((item) => item.dish === 'bánh mì');
    assert.ok(pin);
    const passport = await request('/passport');
    const wrong = await request('/scans', { mode: 'ai', vendorId: pin.id, image }, passport.cookie);
    assert.equal(wrong.data.matched, false);
    assert.equal((await request('/passport', undefined, passport.cookie)).data.stamps.length, 0);
    matched = true;
    const correct = await request(
      '/scans',
      { mode: 'ai', vendorId: pin.id, image },
      passport.cookie,
    );
    assert.equal(correct.data.mode, 'ai-observed');
    assert.equal(correct.data.vendor.id, pin.id);
    assert.equal(correct.data.purchaseVerified, false);
    assert.equal(
      (await request('/passport', undefined, passport.cookie)).data.stamps[0].vendorId,
      pin.id,
    );
  }, ai);
});

test('phrasebook works without API keys and unknown text fails honestly', async () =>
  withAPI(async (request) => {
    const result = await request('/translate', { text: 'Hết bò khô rồi, lấy thêm trứng cút nha?' });
    assert.equal(result.status, 200);
    assert.equal(result.data.source, 'phrasebook');
    assert.match(result.data.translation, /quail eggs/);
    assert.equal(
      (await request('/translate', { text: 'Một câu bất kỳ không có trong mẫu.' })).status,
      503,
    );
    assert.equal((await request('/translate', { text: '' })).status, 400);
  }));

test('scan rejects missing or disguised image bytes and never trusts supplied stamp fields', async () =>
  withAPI(async (request) => {
    assert.equal((await request('/scans', { mode: 'ai', vendorId: 'bot-chien' })).status, 400);
    assert.equal(
      (
        await request('/scans', {
          mode: 'ai',
          vendorId: 'bot-chien',
          image: {
            mimeType: 'image/png',
            base64: Buffer.from('this is not a png image').toString('base64'),
          },
        })
      ).status,
      400,
    );
    assert.equal(
      (await request('/scans', { mode: 'verified', vendorId: 'bot-chien', purchaseVerified: true }))
        .status,
      400,
    );
  }));

const png = {
  mimeType: 'image/png',
  base64:
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLPsAAAAASUVORK5CYII=',
};

test('missing AI key cannot silently produce an AI stamp', async () =>
  withAPI(async (request) => {
    const first = await request('/passport');
    assert.equal(
      (await request('/scans', { mode: 'ai', vendorId: 'bot-chien', image: png }, first.cookie))
        .status,
      503,
    );
    assert.equal((await request('/passport', undefined, first.cookie)).data.stamps.length, 0);
  }));

test('AI mismatch does not award a stamp', async () =>
  withAPI(
    async (request) => {
      const first = await request('/passport');
      const result = await request(
        '/scans',
        { mode: 'ai', vendorId: 'bot-chien', image: png },
        first.cookie,
      );
      assert.equal(result.data.matched, false);
      assert.equal((await request('/passport', undefined, first.cookie)).data.stamps.length, 0);
    },
    {
      configured: true,
      scan: async () => ({
        matchedVendorId: 'banh-mi',
        confidence: 0.99,
        dishName: 'Bánh mì',
        explanation: 'A baguette.',
      }),
    },
  ));

test('low AI confidence does not award a stamp', async () =>
  withAPI(
    async (request) => {
      const result = await request('/scans', { mode: 'ai', vendorId: 'bot-chien', image: png });
      assert.equal(result.data.matched, false);
    },
    {
      configured: true,
      scan: async () => ({
        matchedVendorId: 'bot-chien',
        confidence: 0.4,
        dishName: 'Bột chiên',
        explanation: 'Unclear.',
      }),
    },
  ));

test('AI observations and demo stamps stay distinct and never verify a purchase', async () =>
  withAPI(
    async (request) => {
      const first = await request('/passport');
      await request('/scans', { mode: 'demo', vendorId: 'bot-chien' }, first.cookie);
      const result = await request(
        '/scans',
        { mode: 'ai', vendorId: 'bot-chien', image: png },
        first.cookie,
      );
      assert.equal(result.data.mode, 'ai-observed');
      assert.equal(result.data.purchaseVerified, false);
      const passport = await request('/passport', undefined, first.cookie);
      assert.equal(passport.data.stamps.length, 2);
      assert.deepEqual(passport.data.stamps.map((s) => s.mode).sort(), ['ai-observed', 'demo']);
    },
    {
      configured: true,
      scan: async () => ({
        matchedVendorId: 'bot-chien',
        confidence: 0.95,
        dishName: 'Bột chiên',
        explanation: 'Rice cakes and egg.',
      }),
    },
  ));

test('cross-origin writes are rejected', async () =>
  withAPI(async (request) => {
    assert.equal(
      (
        await request('/scans', { mode: 'demo', vendorId: 'bot-chien' }, undefined, {
          Origin: 'https://untrusted.example',
        })
      ).status,
      403,
    );
  }));

test('read-only planners work behind a frontend proxy without weakening write protection', async () =>
  withAPI(async (request) => {
    const headers = { Origin: 'https://ganhmuusinh.vercel.app' };
    const suggestion = await request('/planner', config, undefined, headers);
    assert.equal(suggestion.status, 200);
    assert.ok(suggestion.data.stops.length > 0);

    const byWard = await request('/planner/ward', { ward: 'Phường Tây Thạnh' }, undefined, headers);
    assert.equal(byWard.status, 200);
    assert.ok(byWard.data.routes.length > 0);

    const write = await request(
      '/scans',
      { mode: 'demo', vendorId: 'bot-chien' },
      undefined,
      headers,
    );
    assert.equal(write.status, 403);
  }));

test('Gemini adapter uses an image request and validates upstream JSON', async () => {
  const visibleImage = {
    mimeType: 'image/png',
    base64: (
      await sharp({ create: { width: 256, height: 256, channels: 3, background: 'white' } })
        .png()
        .toBuffer()
    ).toString('base64'),
  };
  let sent;
  let call = 0;
  const ai = createAI({
    apiKey: 'unit-test-only',
    model: 'test-model',
    fetchImpl: async (url, options) => {
      sent = { url, options };
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify(
                      call++ === 0
                        ? {
                            hasSolidBlocks: true,
                            hasRoundCups: false,
                            hasFlatEggSheet: true,
                            hasRiceMound: false,
                            hasBroth: false,
                            description: 'Fried cut pieces and egg.',
                          }
                        : call === 2
                          ? {
                              quality: 'clear',
                              description: 'Rice-cake blocks and egg.',
                              candidates: [
                                {
                                  dishKey: 'bot-chien',
                                  confidence: 0.95,
                                  visibleCueIds: ['rice-cake-blocks', 'egg-layer'],
                                  contradictions: [],
                                },
                              ],
                            }
                          : {
                              dishKey: 'bot-chien',
                              confidence: 0.95,
                              visibleCueIds: ['rice-cake-blocks', 'egg-layer'],
                              contradictions: [],
                              verdict: 'supported',
                              explanation: 'Visible rice-cake blocks and egg.',
                            },
                    ),
                  },
                ],
              },
            },
          ],
        }),
      };
    },
  });
  const result = await ai.scan(visibleImage, vendors);
  assert.equal(result.matchedVendorId, 'bot-chien');
  const body = JSON.parse(sent.options.body);
  assert.equal(body.contents[0].parts[0].inlineData.mimeType, 'image/png');
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(sent.options.headers['x-goog-api-key'], 'unit-test-only');
  const broken = createAI({
    apiKey: 'unit-test-only',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"confidence":99}' }] } }] }),
    }),
  });
  await assert.rejects(broken.scan(visibleImage, vendors), { status: 502 });
});

test('AI upstream failure returns a safe error without leaking provider credentials', async () => {
  const ai = createAI({
    apiKey: 'sensitive-test-key',
    fetchImpl: async () => ({ ok: false, status: 401 }),
  });
  await assert.rejects(
    ai.translate('Xin chào'),
    (error) => error.status === 502 && !error.message.includes('sensitive-test-key'),
  );
});
