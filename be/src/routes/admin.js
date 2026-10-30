import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAdmin, requireUser } from '../services/auth.js';
import { submissionSchema } from '../services/content.js';
import { references } from '../data/references.js';
import { regions, allergens } from '../data/catalog.js';
import { ServiceError } from '../services/ai.js';

export function mountAdmin(app, db, store) {
  app.get('/api/submissions', requireUser, (req, res) =>
    res.json({
      submissions: db
        .prepare(
          'SELECT id,payload,status,review_note AS reviewNote,vendor_id AS vendorId,created_at AS createdAt,reviewed_at AS reviewedAt FROM submissions WHERE user_id = ? ORDER BY created_at DESC,id DESC',
        )
        .all(req.user.id)
        .map((r) => ({ ...r, payload: JSON.parse(r.payload) })),
    }),
  );
  app.post('/api/submissions', requireUser, (req, res) => {
    const payload = submissionSchema.parse(req.body);
    const recent = db
      .prepare(
        "SELECT COUNT(*) AS count FROM submissions WHERE user_id = ? AND created_at >= datetime('now','-1 day')",
      )
      .get(req.user.id).count;
    if (recent >= 10)
      throw new ServiceError(
        429,
        'Bạn đã gửi 10 đóng góp trong ngày. Hãy đợi admin xem xét trước nhé.',
      );
    const id = randomUUID();
    db.prepare('INSERT INTO submissions(id,user_id,payload) VALUES (?,?,?)').run(
      id,
      req.user.id,
      JSON.stringify(payload),
    );
    res.status(201).json({ id, status: 'pending' });
  });
  app.use('/api/admin', requireAdmin);
  app.get('/api/admin/overview', (_req, res) => {
    const vendors = store.list('vendor'),
      quests = store.list('quest');
    res.json({
      regions,
      allergens,
      counts: {
        vendors: vendors.length,
        publishedVendors: vendors.filter((v) => v.status === 'published').length,
        draftVendors: vendors.filter((v) => v.status === 'draft').length,
        quests: quests.length,
        publishedQuests: store.publishedQuests().length,
        pending: db
          .prepare("SELECT COUNT(*) AS count FROM submissions WHERE status = 'pending'")
          .get().count,
        users: db.prepare('SELECT COUNT(*) AS count FROM users').get().count,
        stamps: db.prepare('SELECT COUNT(*) AS count FROM stamps').get().count,
      },
      recent: db
        .prepare(
          'SELECT audit_log.id,action,entity_id AS entityId,summary,audit_log.created_at AS createdAt,users.name AS actor FROM audit_log LEFT JOIN users ON users.id = audit_log.actor_id ORDER BY audit_log.id DESC LIMIT 30',
        )
        .all(),
    });
  });
  for (const [route, kind] of [
    ['vendors', 'vendor'],
    ['quests', 'quest'],
  ]) {
    app.get(`/api/admin/${route}`, (_req, res) => res.json({ records: store.list(kind) }));
    app.post(`/api/admin/${route}`, (req, res) =>
      res.status(201).json(store.save(kind, req.body, req.user.id)),
    );
    app.put(`/api/admin/${route}/:id`, (req, res) => {
      if (!store.get(kind, req.params.id)) throw new ServiceError(404, 'Nội dung không tồn tại.');
      res.json(store.save(kind, req.body, req.user.id, req.params.id, req.body.expectedRevision));
    });
  }
  app.get('/api/admin/references', (_req, res) =>
    res.json({
      sources: [
        'https://ganhmuusinh.vn/',
        'https://www.google.com/maps/@10.7524014,106.6815481,13.33z/data=!4m3!11m2!2syL7kE4gcCEMBEYgR2UjssA!3e3',
      ],
      capturedAt: '2026-10-29',
      references: references.map((r) => ({
        ...r,
        imported: Boolean(store.get('vendor', `reference-${r.id}`)),
      })),
    }),
  );
  app.post('/api/admin/references/import-google-maps', (_req, res) =>
    res.json(store.importGoogleReferences(req.user.id)),
  );
  app.post('/api/admin/references/:id/import', (req, res) =>
    res.json(store.importReference(req.params.id, req.user.id)),
  );
  app.get('/api/admin/users', (_req, res) =>
    res.json({
      users: db
        .prepare(
          'SELECT id,email,name,role,created_at AS createdAt FROM users ORDER BY created_at DESC,id DESC LIMIT 200',
        )
        .all(),
    }),
  );
  app.get('/api/admin/submissions', (_req, res) =>
    res.json({
      submissions: db
        .prepare(
          'SELECT submissions.id,payload,status,review_note AS reviewNote,vendor_id AS vendorId,submissions.created_at AS createdAt,reviewed_at AS reviewedAt,users.name AS author FROM submissions JOIN users ON users.id = submissions.user_id ORDER BY submissions.created_at DESC,submissions.id DESC LIMIT 200',
        )
        .all()
        .map((r) => ({ ...r, payload: JSON.parse(r.payload) })),
    }),
  );
  app.post('/api/admin/submissions/:id/review', (req, res) => {
    const { decision, note } = z
      .object({
        decision: z.enum(['approved', 'rejected']),
        note: z.string().trim().min(3).max(1000),
      })
      .parse(req.body);
    const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
    if (!row) throw new ServiceError(404, 'Đóng góp không tồn tại.');
    if (row.status !== 'pending') throw new ServiceError(409, 'Đóng góp này đã được xử lý.');
    const payload = JSON.parse(row.payload);
    // Stable ID makes approval retry-safe without creating duplicate drafts.
    db.exec('BEGIN');
    try {
      const vendor =
        decision === 'approved'
          ? store.save(
              'vendor',
              {
                ...payload,
                area: regions.find((r) => r.id === payload.region).name,
                dataType: 'community',
                status: 'draft',
              },
              req.user.id,
              `submission-${row.id}`,
            )
          : null;
      db.prepare(
        'UPDATE submissions SET status = ?, review_note = ?, vendor_id = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?',
      ).run(decision, note, vendor?.id ?? null, row.id, 'pending');
      store.audit(req.user.id, `submission.${decision}`, row.id, note);
      db.exec('COMMIT');
      res.json({ id: row.id, status: decision, vendorId: vendor?.id ?? null, published: false });
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
}
