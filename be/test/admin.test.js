import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db.js';
import { createAI } from '../src/services/ai.js';
import { createAccount } from '../src/services/auth.js';
import { createContentStore } from '../src/services/content.js';
import { vendors } from '../src/data/catalog.js';
import { references } from '../src/data/references.js';

const adminEmail = 'admin@test.local',
  password = 'Test-password-only-2026';
async function fixture(run) {
  const db = openDatabase(':memory:');
  await createAccount(db, { email: adminEmail, name: 'Test admin', password }, 'admin');
  const server = createApp({ db, ai: createAI({}) }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  function browser() {
    const cookies = new Map();
    return {
      cookies,
      async request(path, body, method, extra = {}) {
        const response = await fetch(base + path, {
          method: method ?? (body === undefined ? 'GET' : 'POST'),
          headers: {
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
            ...extra,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        for (const header of response.headers.getSetCookie()) {
          const [key, value] = header.split(';')[0].split('=');
          if (value) cookies.set(key, value);
          else cookies.delete(key);
        }
        return { status: response.status, data: await response.json(), headers: response.headers };
      },
    };
  }
  const admin = browser();
  assert.equal((await admin.request('/auth/login', { email: adminEmail, password })).status, 200);
  try {
    await run({ db, browser, admin });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
}
const draft = {
  ...vendors[0],
  name: 'Gánh mới kiểm thử',
  status: 'draft',
  dataType: 'community',
  sourceUrl: 'https://example.com/food',
  allergensKnown: false,
};
const proposal = {
  name: 'Gánh cộng đồng',
  dish: 'Chè đậu',
  region: 'saigon',
  address: 'Một vị trí đang chờ xác minh',
  notes: 'Ghé vào buổi chiều, cần kiểm tra lại giờ bán.',
  sourceUrl: 'https://example.com/source',
};

test('admin endpoints require authentication and backend admin role', async () =>
  fixture(async ({ browser }) => {
    const guest = browser();
    for (const path of [
      '/admin/overview',
      '/admin/vendors',
      '/admin/quests',
      '/admin/users',
      '/admin/submissions',
      '/admin/references',
    ])
      assert.equal((await guest.request(path)).status, 401);
    const registered = await guest.request('/auth/register', {
      email: 'user@test.local',
      name: 'User test',
      password,
      role: 'admin',
    });
    assert.equal(registered.status, 200);
    assert.equal(registered.data.user.role, 'user');
    assert.equal((await guest.request('/admin/vendors', draft)).status, 403);
    assert.equal(
      (await guest.request('/admin/vendors/bot-chien', { ...draft, expectedRevision: 1 }, 'PUT'))
        .status,
      403,
    );
    assert.equal((await guest.request('/admin/users')).status, 403);
  }));

test('password hashing, case-insensitive email, and safe user DTO', async () =>
  fixture(async ({ db, browser }) => {
    const client = browser();
    const registered = await client.request('/auth/register', {
      email: 'Explorer@Test.Local',
      name: 'Explorer',
      password,
    });
    assert.equal(registered.status, 200);
    assert.equal(registered.data.user.email, 'explorer@test.local');
    assert.equal(registered.data.user.password_hash, undefined);
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get('explorer@test.local');
    assert.notEqual(row.password_hash, password);
    assert.match(row.password_hash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
    assert.ok(
      registered.headers
        .getSetCookie()
        .some(
          (v) => v.startsWith('gms_auth=') && v.includes('HttpOnly') && v.includes('SameSite=Lax'),
        ),
    );
    assert.equal(
      (
        await browser().request('/auth/register', {
          email: 'EXPLORER@test.local',
          name: 'Duplicate',
          password,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await browser().request('/auth/login', {
          email: 'explorer@test.local',
          password: 'wrong-password',
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await browser().request('/auth/login', {
          email: 'missing@test.local',
          password: 'wrong-password',
        })
      ).status,
      401,
    );
  }));

test('logout revokes auth token; expired and forged sessions are rejected', async () =>
  fixture(async ({ db, browser, admin }) => {
    const oldToken = admin.cookies.get('gms_auth');
    await admin.request('/auth/logout', {});
    admin.cookies.set('gms_auth', oldToken);
    assert.equal((await admin.request('/admin/overview')).status, 401);
    await admin.request('/auth/login', { email: adminEmail, password });
    db.prepare('UPDATE auth_sessions SET expires_at = 0').run();
    assert.equal((await admin.request('/admin/overview')).status, 401);
    const forged = browser();
    forged.cookies.set('gms_auth', 'a'.repeat(64));
    assert.equal((await forged.request('/admin/overview')).status, 401);
  }));

test('guest passport merges on signup and follows account across browsers without leaking on logout', async () =>
  fixture(async ({ browser }) => {
    const first = browser();
    await first.request('/scans', { mode: 'demo', vendorId: 'bot-chien' });
    await first.request('/auth/register', {
      email: 'passport@test.local',
      name: 'Passport',
      password,
    });
    assert.equal((await first.request('/passport')).data.stamps.length, 1);
    const second = browser();
    await second.request('/auth/login', { email: 'passport@test.local', password });
    assert.equal((await second.request('/passport')).data.stamps.length, 1);
    await second.request('/scans', { mode: 'demo', vendorId: 'bot-chien' });
    assert.equal((await first.request('/passport')).data.stamps.length, 1);
    const privatePassport = first.cookies.get('gms_session');
    await first.request('/auth/logout', {});
    first.cookies.set('gms_session', privatePassport);
    assert.equal((await first.request('/passport')).data.stamps.length, 0);
  }));

test('switching accounts does not import a previous account passport', async () =>
  fixture(async ({ browser }) => {
    const client = browser();
    await client.request('/auth/register', {
      email: 'first@test.local',
      name: 'First user',
      password,
    });
    await client.request('/scans', { mode: 'demo', vendorId: 'bot-chien' });
    await client.request('/auth/register', {
      email: 'second@test.local',
      name: 'Second user',
      password,
    });
    assert.equal((await client.request('/passport')).data.stamps.length, 0);
  }));

test('vendor changes persist in server storage, drafts are private, and stale saves conflict', async () =>
  fixture(async ({ admin, browser }) => {
    const guest = browser();
    const created = await admin.request('/admin/vendors', draft);
    assert.equal(created.status, 201);
    const id = created.data.id;
    assert.equal(
      (await guest.request('/catalog')).data.vendors.some((v) => v.id === id),
      false,
    );
    const published = await admin.request(
      `/admin/vendors/${id}`,
      { ...created.data, status: 'published', expectedRevision: 1 },
      'PUT',
    );
    assert.equal(published.status, 200);
    assert.equal(published.data.revision, 2);
    const catalog = (await guest.request('/catalog')).data;
    assert.equal(
      catalog.vendors.some((v) => v.id === id),
      true,
    );
    assert.equal(catalog.dataMode, 'mixed');
    assert.equal(
      (
        await admin.request(
          `/admin/vendors/${id}`,
          { ...created.data, status: 'draft', expectedRevision: 1 },
          'PUT',
        )
      ).status,
      409,
    );
    const planner = await guest.request('/planner', {
      region: 'saigon',
      time: 'afternoon',
      budget: 100000,
      excludeAllergens: ['peanut'],
    });
    assert.ok(planner.data.stops.every((v) => v.id !== id));
  }));

test('reference imports are attributed, incomplete, private, and idempotent', async () =>
  fixture(async ({ admin, browser }) => {
    const refs = (await admin.request('/admin/references')).data.references;
    assert.deepEqual(refs.map((ref) => ref.id).sort(), references.map((ref) => ref.id).sort());
    const source = refs.find((ref) => ref.sourceUrl === 'https://ganhmuusinh.vn/');
    assert.ok(source);
    const result = await admin.request(`/admin/references/${source.id}/import`, {});
    assert.equal(result.data.created, true);
    assert.equal(result.data.vendor.price, null);
    assert.equal(result.data.vendor.hours, null);
    assert.equal(result.data.vendor.sourceUrl, 'https://ganhmuusinh.vn/');
    assert.equal(result.data.vendor.story, '');
    assert.equal(result.data.vendor.verification, 'unverified');
    const again = await admin.request(`/admin/references/${source.id}/import`, {});
    assert.equal(again.data.created, false);
    assert.equal(again.data.vendor.id, result.data.vendor.id);
    const live = await admin.request(
      `/admin/vendors/${result.data.vendor.id}`,
      { ...result.data.vendor, status: 'published', expectedRevision: 1 },
      'PUT',
    );
    assert.equal(live.status, 422);
    assert.equal(
      (await browser().request('/catalog')).data.vendors.some(
        (v) => v.id === result.data.vendor.id,
      ),
      false,
    );
  }));

test('archived vendor is removed from public quests, planner, order and scans but historic stamp survives', async () =>
  fixture(async ({ admin, browser }) => {
    const guest = browser();
    await guest.request('/scans', { mode: 'demo', vendorId: 'bot-chien' });
    const vendor = (await admin.request('/admin/vendors')).data.records.find(
      (v) => v.id === 'bot-chien',
    );
    await admin.request(
      '/admin/vendors/bot-chien',
      { ...vendor, status: 'archived', expectedRevision: vendor.revision },
      'PUT',
    );
    const catalog = (await guest.request('/catalog')).data;
    assert.equal(
      catalog.vendors.some((v) => v.id === 'bot-chien'),
      false,
    );
    assert.ok(catalog.quests.every((q) => !q.vendorIds.includes('bot-chien')));
    assert.equal((await guest.request('/quests/hem-nho')).status, 404);
    assert.equal(
      (await guest.request('/orders/compose', { vendorId: 'bot-chien', quantity: 1, options: [] }))
        .status,
      404,
    );
    assert.equal(
      (await guest.request('/scans', { mode: 'demo', vendorId: 'bot-chien' })).status,
      404,
    );
    assert.equal((await guest.request('/passport')).data.stamps[0].vendor.id, 'bot-chien');
  }));

test('quest editing validates duplicate, cross-region, draft and archived stops', async () =>
  fixture(async ({ admin }) => {
    const source = (await admin.request('/admin/quests')).data.records[0];
    assert.equal(
      (
        await admin.request('/admin/quests', {
          ...source,
          title: 'Sai giờ bán',
          time: 'morning',
          vendorIds: ['bot-chien'],
          status: 'published',
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await admin.request('/admin/quests', {
          ...source,
          title: 'Mới',
          vendorIds: ['bot-chien', 'bot-chien'],
        })
      ).status,
      400,
    );
    assert.equal(
      (await admin.request('/admin/quests', { ...source, title: 'Mới', vendorIds: ['banh-khot'] }))
        .status,
      422,
    );
    const vendor = (await admin.request('/admin/vendors', draft)).data;
    assert.equal(
      (
        await admin.request('/admin/quests', {
          ...source,
          title: 'Mới',
          vendorIds: [vendor.id],
          status: 'published',
        })
      ).status,
      422,
    );
    const created = await admin.request('/admin/quests', {
      ...source,
      title: 'Hành trình biên tập',
      vendorIds: ['bot-chien', 'che'],
      status: 'published',
    });
    assert.equal(created.status, 201);
    assert.equal((await admin.request(`/quests/${created.data.id}`)).data.budget, 40000);
  }));

test('community submissions require login, are owner-private and moderation creates drafts', async () =>
  fixture(async ({ admin, browser }) => {
    const first = browser(),
      second = browser();
    assert.equal((await first.request('/submissions', proposal)).status, 401);
    await first.request('/auth/register', { email: 'author@test.local', name: 'Author', password });
    await second.request('/auth/register', { email: 'other@test.local', name: 'Other', password });
    const sent = await first.request('/submissions', proposal);
    assert.equal(sent.status, 201);
    assert.equal((await first.request('/submissions')).data.submissions.length, 1);
    assert.equal((await second.request('/submissions')).data.submissions.length, 0);
    assert.equal(
      (
        await first.request(`/admin/submissions/${sent.data.id}/review`, {
          decision: 'approved',
          note: 'test',
        })
      ).status,
      403,
    );
    const reviewed = await admin.request(`/admin/submissions/${sent.data.id}/review`, {
      decision: 'approved',
      note: 'Đã tiếp nhận, cần kiểm tra giờ bán.',
    });
    assert.equal(reviewed.status, 200);
    assert.equal(reviewed.data.published, false);
    assert.equal(
      (await admin.request('/admin/vendors')).data.records.find(
        (v) => v.id === reviewed.data.vendorId,
      ).status,
      'draft',
    );
    assert.equal(
      (await first.request('/submissions')).data.submissions[0].reviewNote,
      'Đã tiếp nhận, cần kiểm tra giờ bán.',
    );
    assert.equal(
      (
        await admin.request(`/admin/submissions/${sent.data.id}/review`, {
          decision: 'approved',
          note: 'Lần hai',
        })
      ).status,
      409,
    );
  }));

test('all content mutation methods reject cross-origin writes', async () =>
  fixture(async ({ admin }) => {
    assert.equal(
      (
        await admin.request('/admin/vendors/bot-chien', { ...draft, expectedRevision: 1 }, 'PUT', {
          Origin: 'https://untrusted.example',
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await admin.request('/auth/login', { email: adminEmail, password }, 'POST', {
          Origin: 'https://untrusted.example',
        })
      ).status,
      403,
    );
  }));

test('content survives a database reopen and seed never overwrites edits', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'gms-content-test-'));
  try {
    const file = join(directory, 'test.sqlite');
    let db = openDatabase(file);
    const user = await createAccount(db, { email: adminEmail, name: 'Admin', password }, 'admin');
    let store = createContentStore(db);
    store.save(
      'vendor',
      { ...store.get('vendor', 'bot-chien'), name: 'Tên đã biên tập' },
      user.id,
      'bot-chien',
      1,
    );
    db.close();
    db = openDatabase(file);
    store = createContentStore(db);
    assert.equal(store.get('vendor', 'bot-chien').name, 'Tên đã biên tập');
    assert.equal(store.get('vendor', 'bot-chien').revision, 2);
    db.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
