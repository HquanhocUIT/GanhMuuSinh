import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { vendors as seedVendors, quests as seedQuests, allergens } from '../data/catalog.js';
import { references } from '../data/references.js';
import { ServiceError } from './ai.js';
import { distanceKm } from './planner.js';
import { getWardCandidates } from './ward-planner.js';

export const statusSchema = z.enum(['draft', 'published', 'archived']);
const regionSchema = z.enum(['saigon', 'binhduong', 'vungtau']);
const text = (max) => z.string().trim().max(max);
const safeUrl = text(1000).refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}, 'Dùng đường dẫn HTTPS hợp lệ.');
const safeStoryAudioUrl = text(1000).refine((value) => {
  if (!value) return true;
  if (/^\/audio\/stories\/[\w.-]+\.mp3$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}, 'Invalid story audio URL.');
export const vendorSchema = z.object({
  name: text(160).min(2),
  nameEn: text(160).default(''),
  dish: text(160).min(2),
  dishEn: text(200).default(''),
  owner: text(100).default(''),
  region: regionSchema,
  area: text(120).default(''),
  address: text(500).default(''),
  lat: z.number().min(-90).max(90).nullable().default(null),
  lng: z.number().min(-180).max(180).nullable().default(null),
  price: z.number().int().min(0).max(1000000).nullable().default(null),
  hours: z
    .tuple([z.number().int().min(0).max(23), z.number().int().min(1).max(24)])
    .refine((h) => h[1] > h[0], 'Giờ đóng phải sau giờ mở.')
    .nullable()
    .default(null),
  years: z.number().int().min(0).max(150).default(0),
  ingredients: z.array(text(100).min(1)).max(40).default([]),
  ingredientsEn: z.array(text(100).min(1)).max(40).default([]),
  allergens: z
    .array(z.enum(allergens.map((a) => a.id)))
    .max(6)
    .default([]),
  allergensKnown: z.boolean().default(false),
  tip: text(1000).default(''),
  tipEn: text(1000).default(''),
  story: text(5000).default(''),
  storyEn: text(5000).default(''),
  storyAudioUrl: safeStoryAudioUrl.default(''),
  storyAudioUrlEn: safeStoryAudioUrl.default(''),
  badge: text(100).default(''),
  image: text(1000)
    .refine(
      (v) => /^\/images\/[\w./-]+$/.test(v) || /^https:\/\/[^\s]+$/.test(v),
      'Đường dẫn ảnh chưa hợp lệ.',
    )
    .default('/images/street.jpg'),
  dataType: z.enum(['illustrative', 'reference', 'community']).default('community'),
  sourceUrl: safeUrl.default(''),
  sourceRecordId: text(100).default(''),
  sourceRetrievedAt: text(30).default(''),
  verification: z.enum(['unverified', 'reviewed']).default('unverified'),
  status: statusSchema.default('draft'),
});
export const questSchema = z.object({
  title: text(180).min(3),
  subtitle: text(500).default(''),
  description: text(3000).default(''),
  region: regionSchema,
  area: text(150).default(''),
  time: z.enum(['morning', 'afternoon', 'night']),
  timeLabel: text(100).default(''),
  vendorIds: z
    .array(text(100).min(1))
    .min(1)
    .max(4)
    .refine((ids) => new Set(ids).size === ids.length, 'Không lặp điểm dừng.'),
  image: vendorSchema.shape.image,
  label: text(100).default('HÀNH TRÌNH MỚI'),
  color: z.enum(['green', 'orange', 'yellow', 'blue']).default('green'),
  duration: z.number().int().min(10).max(360),
  distance: z.number().min(0).max(100),
  difficulty: text(100).default('Dễ đi'),
  status: statusSchema.default('draft'),
});
export const submissionSchema = z.object({
  name: text(160).min(2),
  dish: text(160).min(2),
  region: regionSchema,
  address: text(500).min(5),
  lat: vendorSchema.shape.lat,
  lng: vendorSchema.shape.lng,
  price: vendorSchema.shape.price,
  hours: vendorSchema.shape.hours,
  notes: text(2000).min(10),
  sourceUrl: safeUrl.default(''),
});

export function createContentStore(db) {
  const insertSeed = db.prepare(
    'INSERT OR IGNORE INTO content(kind,id,payload,status) VALUES (?,?,?,?)',
  );
  db.exec('BEGIN');
  try {
    for (const v of seedVendors)
      insertSeed.run(
        'vendor',
        v.id,
        JSON.stringify(vendorSchema.parse({ ...v, allergensKnown: true, status: 'published' })),
        'published',
      );
    for (const q of seedQuests)
      insertSeed.run(
        'quest',
        q.id,
        JSON.stringify(questSchema.parse({ ...q, status: 'published' })),
        'published',
      );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  const record = (row) =>
    row
      ? {
          ...JSON.parse(row.payload),
          id: row.id,
          status: row.status,
          revision: row.revision,
          updatedAt: row.updated_at,
        }
      : null;
  const list = (kind) =>
    db.prepare('SELECT * FROM content WHERE kind = ? ORDER BY rowid').all(kind).map(record);
  const get = (kind, id) =>
    record(db.prepare('SELECT * FROM content WHERE kind = ? AND id = ?').get(kind, id));
  const publishedVendors = () => list('vendor').filter((v) => v.status === 'published');
  const referenceCandidates = () => getWardCandidates();
  const publishedQuests = () => {
    const live = new Set(publishedVendors().map((v) => v.id));
    return list('quest').filter(
      (q) => q.status === 'published' && q.vendorIds.every((id) => live.has(id)),
    );
  };
  function audit(actor, action, id, summary) {
    db.prepare('INSERT INTO audit_log(actor_id,action,entity_id,summary) VALUES (?,?,?,?)').run(
      actor,
      action,
      id,
      summary,
    );
  }
  function save(kind, input, actor, id = randomUUID(), expectedRevision) {
    const existing = get(kind, id);
    if (existing && (!Number.isInteger(expectedRevision) || expectedRevision !== existing.revision))
      throw new ServiceError(409, 'Nội dung đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.');
    const data = (kind === 'vendor' ? vendorSchema : questSchema).parse(input);
    if (kind === 'vendor' && data.status === 'published') {
      if (
        data.lat === null ||
        data.lng === null ||
        data.price === null ||
        data.hours === null ||
        !data.address ||
        !data.area
      )
        throw new ServiceError(
          422,
          'Trước khi hiển thị, cần bổ sung địa chỉ, khu vực, tọa độ, giá và giờ bán.',
        );
      if (data.dataType !== 'illustrative' && !data.sourceUrl)
        throw new ServiceError(
          422,
          'Gánh hàng thực tế cần có đường dẫn nguồn để người đọc đối chiếu.',
        );
    }
    if (kind === 'quest') {
      const windows = { morning: [7, 10], afternoon: [15, 18], night: [19, 23] };
      const [start, end] = windows[data.time];
      data.timeLabel = `${String(start).padStart(2, '0')}:00 – ${end}:00`;
      const stops = data.vendorIds.map((id) => get('vendor', id));
      if (stops.some((v) => !v || v.status === 'archived' || v.region !== data.region))
        throw new ServiceError(422, 'Điểm dừng phải tồn tại, cùng vùng và chưa lưu trữ.');
      if (data.status === 'published' && stops.some((v) => v.status !== 'published'))
        throw new ServiceError(422, 'Chỉ đưa gánh hàng đã hiển thị vào hành trình công khai.');
      if (data.status === 'published') {
        let hour = start;
        for (let i = 0; i < stops.length; i++) {
          if (i) hour += (distanceKm(stops[i - 1], stops[i]) * 1.3) / 4;
          if (hour < stops[i].hours[0] || hour + 1 / 3 > Math.min(stops[i].hours[1], end))
            throw new ServiceError(
              422,
              'Thứ tự điểm dừng chưa phù hợp giờ bán trong khung giờ này. Hãy đổi khung giờ hoặc sắp xếp lại.',
            );
          hour += 1 / 3;
        }
      }
    }
    db.exec('SAVEPOINT content_write');
    try {
      if (existing) {
        const result = db
          .prepare(
            'UPDATE content SET payload = ?, status = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE kind = ? AND id = ? AND revision = ?',
          )
          .run(JSON.stringify(data), data.status, kind, id, expectedRevision);
        if (!result.changes)
          throw new ServiceError(409, 'Nội dung đã thay đổi. Hãy tải lại trước khi lưu.');
      } else
        db.prepare('INSERT INTO content(kind,id,payload,status) VALUES (?,?,?,?)').run(
          kind,
          id,
          JSON.stringify(data),
          data.status,
        );
      audit(
        actor,
        `${kind}.${existing ? 'update' : 'create'}`,
        id,
        `${kind === 'vendor' ? data.name : data.title} · ${data.status}`,
      );
      db.exec('RELEASE content_write');
    } catch (error) {
      db.exec('ROLLBACK TO content_write; RELEASE content_write');
      throw error;
    }
    return get(kind, id);
  }
  function importReference(id, actor) {
    const ref = references.find((r) => r.id === id);
    if (!ref) throw new ServiceError(404, 'Không có mẫu tham khảo này.');
    const existing = get('vendor', `reference-${id}`);
    if (existing) return { vendor: existing, created: false };
    const vendor = save(
      'vendor',
      {
        ...ref,
        area: ref.area || 'TP.HCM',
        region: ref.region || 'saigon',
        dataType: 'reference',
        sourceRecordId: ref.id,
        sourceRetrievedAt: ref.capturedAt,
        status: 'draft',
      },
      actor,
      `reference-${id}`,
    );
    return { vendor, created: true };
  }
  function importGoogleReferences(actor) {
    const source = references.filter((ref) => ref.sourceType === 'google-maps');
    let created = 0;
    db.exec('BEGIN');
    try {
      for (const ref of source) if (importReference(ref.id, actor).created) created += 1;
      db.exec('COMMIT');
      return { total: source.length, created, existing: source.length - created };
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return {
    list,
    get,
    save,
    publishedVendors,
    referenceCandidates,
    publishedQuests,
    audit,
    importReference,
    importGoogleReferences,
  };
}
