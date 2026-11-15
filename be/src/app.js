import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { regions, allergens, enrichQuest } from './data/catalog.js';
import { attachAuth, ensurePassport, mountAuth } from './services/auth.js';
import { createContentStore } from './services/content.js';
import { mountAdmin } from './routes/admin.js';
import { planQuest } from './services/planner.js';
import { planWardRoutes, referenceWards } from './services/ward-planner.js';
import { ServiceError } from './services/ai.js';

const regionSchema = z.enum(['saigon', 'binhduong', 'vungtau']);
const allergenSchema = z.enum(allergens.map((a) => a.id));
const plannerSchema = z.object({
  region: regionSchema,
  time: z.enum(['morning', 'afternoon', 'night']),
  budget: z.number().int().min(10000).max(1000000),
  excludeAllergens: z.array(allergenSchema).max(6).default([]),
  maxStops: z.number().int().min(1).max(4).default(4),
});
const wardPlannerSchema = z.object({ ward: z.string().trim().min(2).max(100) });
const orderSchema = z.object({
  vendorId: z.string().max(100),
  quantity: z.number().int().min(1).max(10),
  options: z
    .array(z.enum(['no-onion', 'less-spicy', 'no-peanut', 'takeaway', 'no-cilantro']))
    .max(5),
});
const scanSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('demo'), vendorId: z.string().max(100) }),
  z.object({
    mode: z.literal('ai'),
    vendorId: z.string().max(100),
    image: z.object({
      mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      base64: z
        .string()
        .min(16)
        .max(7_000_000)
        .regex(/^[A-Za-z0-9+/]+={0,2}$/),
    }),
  }),
]);
const options = {
  'no-onion': ['không hành', 'no spring onion'],
  'less-spicy': ['ít cay', 'less spicy'],
  'no-peanut': ['không đậu phộng', 'no peanuts'],
  takeaway: ['mang về', 'to take away'],
  'no-cilantro': ['không ngò', 'no cilantro'],
};
const phrasebook = new Map([
  [
    'hết bò khô rồi, lấy thêm trứng cút nha?',
    'The beef jerky is sold out. Would you like extra quail eggs?',
  ],
  ['hết bò khô rồi', 'The beef jerky is sold out.'],
  ['hai mươi lăm nghìn', 'That is 25,000 Vietnamese dong.'],
  ['có đậu phộng nha con', 'This contains peanuts.'],
  ['đợi cô một chút nha', 'Please wait a moment.'],
  ['con ăn tại đây hay mang về?', 'Would you like to eat here or take away?'],
]);

function validImage({ mimeType, base64 }) {
  const bytes = Buffer.from(base64, 'base64');
  if (
    bytes.length > 5 * 1024 * 1024 ||
    bytes.toString('base64').replace(/=+$/, '') !== base64.replace(/=+$/, '')
  )
    return false;
  if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png')
    return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
}

export function createApp({ db, ai, frontendPath }) {
  const app = express();
  const store = createContentStore(db);
  const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const readOnlyPostPaths = new Set(['/planner', '/planner/ward']);
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    // The planners only calculate suggestions. Keep the Origin check for
    // state-changing requests, even when a frontend reverse proxy is used.
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const allowed = new Set([
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        `http://${req.get('host')}`,
        `https://${req.get('host')}`,
        ...configuredOrigins,
      ]);
      if (
        !(req.method === 'POST' && readOnlyPostPaths.has(req.path)) &&
        req.get('origin') &&
        !allowed.has(req.get('origin'))
      )
        return res.status(403).json({ error: 'Nguồn yêu cầu không được phép.' });
      if (!req.is('application/json'))
        return res.status(415).json({ error: 'Yêu cầu cần có định dạng JSON.' });
    }
    next();
  });
  app.use(express.json({ limit: '8mb' }));
  app.use('/api', attachAuth(db));
  mountAuth(app, db);
  mountAdmin(app, db, store);

  function session(req, res, next) {
    ensurePassport(db, req, res);
    next();
  }
  const limits = new Map();
  function aiLimit(req, _res, next) {
    const now = Date.now();
    for (const [key, value] of limits) if (value.until < now) limits.delete(key);
    const item = limits.get(req.sessionId) ?? { count: 0, until: now + 3600_000 };
    if (++item.count > 30)
      throw new ServiceError(429, 'Bạn đã dùng nhiều lượt AI. Hãy nghỉ một chút rồi quay lại nhé.');
    limits.set(req.sessionId, item);
    next();
  }
  const findVendor = (id, historical = false) => {
    const v = historical
      ? store.get('vendor', id)
      : store.publishedVendors().find((v) => v.id === id);
    if (v) return v;
    const pin = store.referenceCandidates().find((candidate) => candidate.id === id);
    if (!pin) throw new ServiceError(404, 'Không tìm thấy gánh hàng.');
    // A public map pin is a visit target, not a verified vendor listing.
    return {
      ...pin,
      owner: '',
      dishEn: pin.dish,
      address: pin.area || pin.ward,
      price: 0,
      hours: [0, 24],
      years: 0,
      ingredients: [],
      ingredientsEn: [],
      allergens: [],
      allergensKnown: false,
      tip: '',
      tipEn: '',
      story: '',
      storyEn: '',
      badge: 'Dấu khám phá tham khảo',
      image: '/images/street.jpg',
      dataType: 'reference',
      sourceUrl: pin.mapUrl || pin.sourceUrl,
      verification: 'unverified',
    };
  };

  app.get('/api/health', (_req, res) =>
    res.json({
      status: 'ok',
      aiConfigured: ai.configured,
      aiProvider: ai.provider,
      aiModel: ai.model,
      visionPipeline: ai.visionPipeline,
      referenceVisionConfigured: Boolean(ai.referenceConfigured),
      dataMode: store.publishedVendors().every((v) => v.dataType === 'illustrative')
        ? 'illustrative'
        : 'mixed',
    }),
  );
  app.get('/api/catalog', (_req, res) => {
    const vendors = store.publishedVendors();
    const mapCandidates = store.referenceCandidates();
    res.json({
      regions,
      allergens,
      wards: referenceWards,
      vendors,
      mapCandidates,
      quests: store.publishedQuests().map((q) => enrichQuest(q, vendors)),
      aiConfigured: ai.configured,
      dataMode:
        vendors.every((v) => v.dataType === 'illustrative') && !mapCandidates.length
          ? 'illustrative'
          : 'mixed',
    });
  });
  app.get('/api/quests/:id', (req, res) => {
    const quest = store.publishedQuests().find((q) => q.id === req.params.id);
    if (!quest) throw new ServiceError(404, 'Không tìm thấy hành trình.');
    res.json(enrichQuest(quest, store.publishedVendors()));
  });
  app.post('/api/planner', (req, res) => {
    const plan = planQuest(plannerSchema.parse(req.body), store.publishedVendors());
    if (!plan)
      throw new ServiceError(
        422,
        'Chưa tìm được điểm dừng phù hợp. Thử tăng ngân sách hoặc đổi khung giờ nhé.',
      );
    res.json(plan);
  });
  app.post('/api/planner/ward', (req, res) => {
    const { ward } = wardPlannerSchema.parse(req.body);
    const routes = planWardRoutes(ward);
    if (!routes.length)
      throw new ServiceError(404, 'Chưa có gánh hàng ăn tham khảo được ghi nhận ở phường này.');
    res.json({ ward, routes });
  });
  app.post('/api/orders/compose', (req, res) => {
    const input = orderSchema.parse(req.body);
    const vendor = findVendor(input.vendorId);
    const unique = [...new Set(input.options)];
    const vi = unique.map((id) => options[id][0]);
    const en = unique.map((id) => options[id][1]);
    res.json({
      vietnamese: `Cô chú ơi, cho con ${input.quantity} phần ${vendor.dish.toLocaleLowerCase('vi')}${vi.length ? ', ' + vi.join(', ') : ''} nha. Con cảm ơn!`,
      english: `Could I have ${input.quantity} serving${input.quantity > 1 ? 's' : ''} of ${vendor.dishEn || vendor.dish}${en.length ? ', ' + en.join(', ') : ''}, please? Thank you!`,
    });
  });
  app.post('/api/translate', session, aiLimit, async (req, res) => {
    const { text } = z.object({ text: z.string().trim().min(1).max(1000) }).parse(req.body);
    const cached = phrasebook.get(
      text
        .toLocaleLowerCase('vi')
        .replace(/[.!]+$/, '')
        .trim(),
    );
    if (cached) return res.json({ translation: cached, source: 'phrasebook' });
    res.json({ translation: await ai.translate(text), source: 'ai' });
  });
  app.get('/api/passport', session, (req, res) => {
    const stamps = db
      .prepare(
        'SELECT id, vendor_id AS vendorId, mode, created_at AS createdAt FROM stamps WHERE session_id = ? ORDER BY id DESC',
      )
      .all(req.sessionId);
    res.json({
      stamps: stamps.map((s) => ({
        ...s,
        vendor: findVendor(s.vendorId, true),
        purchaseVerified: false,
      })),
      totalVendors: new Set([
        ...store.publishedVendors().map((vendor) => vendor.id),
        ...store.referenceCandidates().map((pin) => pin.id),
      ]).size,
    });
  });
  app.post('/api/scans', session, aiLimit, async (req, res) => {
    const input = scanSchema.parse(req.body);
    const expected = findVendor(input.vendorId);
    let vendor = expected,
      observation = null;
    if (input.mode === 'ai') {
      if (!validImage(input.image))
        throw new ServiceError(400, 'Ảnh không hợp lệ. Chọn JPEG, PNG hoặc WebP tối đa 5 MB.');
      observation = await ai.scan(
        input.image,
        [...store.publishedVendors(), expected],
        expected.id,
      );
      if (observation.matchedVendorId !== expected.id || observation.confidence < 0.8) {
        const differentDish =
          observation.status === 'recognized' && observation.matchedVendorId !== expected.id;
        return res.json({
          matched: false,
          mode: 'ai-observed',
          observation,
          purchaseVerified: false,
          reason: differentDish ? 'different-dish' : observation.status || 'uncertain',
          message: differentDish
            ? `Ảnh có vẻ là ${observation.dishName}, khác với ${expected.dish} đang chọn. Hãy kiểm tra lại điểm dừng.`
            : observation.explanation ||
              'Chưa nhận diện rõ món ở điểm dừng này. Thử chụp gần món ăn hơn, đủ sáng nhé.',
        });
      }
      vendor = findVendor(observation.matchedVendorId);
    }
    const mode = input.mode === 'demo' ? 'demo' : 'ai-observed';
    const result = db
      .prepare('INSERT OR IGNORE INTO stamps(session_id, vendor_id, mode) VALUES (?, ?, ?)')
      .run(req.sessionId, vendor.id, mode);
    res.json({
      matched: true,
      mode,
      vendor,
      observation,
      newStamp: Number(result.changes) > 0,
      purchaseVerified: false,
      message:
        mode === 'demo'
          ? 'Đã thêm dấu trải nghiệm minh họa vào hộ chiếu.'
          : 'Đã nhận diện món và lưu dấu AI. Chưa xác minh giao dịch mua hàng.',
      ingredientSource:
        vendor.dataType === 'illustrative' ? 'illustrative-catalog' : 'community-catalog',
    });
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API không tồn tại.' }));
  if (frontendPath && existsSync(resolve(frontendPath, 'index.html'))) {
    app.use(express.static(frontendPath));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(frontendPath, 'index.html')));
  }
  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError)
      return res.status(400).json({
        error: 'Dữ liệu không hợp lệ.',
        details: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    if (error.type === 'entity.too.large')
      return res.status(413).json({ error: 'Ảnh quá lớn. Vui lòng chọn ảnh tối đa 5 MB.' });
    if (error instanceof SyntaxError && error.status === 400)
      return res.status(400).json({ error: 'JSON không hợp lệ.' });
    res
      .status(error.status ?? 500)
      .json({ error: error.status ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.' });
  });
  return app;
}
