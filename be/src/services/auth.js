import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { ServiceError } from './ai.js';

const scryptAsync = promisify(scrypt);
const passwordOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
const registration = z.object({
  email: emailSchema,
  name: z.string().trim().min(2).max(80),
  password: z.string().min(10).max(128),
});
const login = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const cookieValue = (req, name) =>
  req.headers.cookie
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`))
    ?.slice(name.length + 1);
const digest = (value) => createHash('sha256').update(value).digest('hex');
export const publicUser = (row) =>
  row
    ? { id: row.id, email: row.email, name: row.name, role: row.role, createdAt: row.created_at }
    : null;
const cookieOptions = (req) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: req.secure || process.env.NODE_ENV === 'production',
  path: '/',
});

export async function createAccount(db, input, role = 'user') {
  const values = registration.parse(input);
  const salt = randomBytes(16).toString('hex');
  const hash = Buffer.from(await scryptAsync(values.password, salt, 64, passwordOptions)).toString(
    'hex',
  );
  const id = randomUUID();
  try {
    db.prepare('INSERT INTO users(id,email,name,password_hash,role) VALUES (?,?,?,?,?)').run(
      id,
      values.email,
      values.name,
      `${salt}:${hash}`,
      role,
    );
  } catch (error) {
    if (error.code === 'ERR_SQLITE_ERROR' && error.message.includes('UNIQUE'))
      throw new ServiceError(409, 'Email này đã có tài khoản. Bạn hãy đăng nhập.');
    throw error;
  }
  return publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
}

export function attachAuth(db) {
  return (req, _res, next) => {
    const token = cookieValue(req, 'gms_auth');
    req.user = null;
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const row = db
        .prepare(
          'SELECT users.* FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id WHERE token_hash = ? AND expires_at > ?',
        )
        .get(digest(token), Date.now());
      req.user = publicUser(row);
    }
    next();
  };
}
export function requireUser(req, _res, next) {
  if (!req.user) throw new ServiceError(401, 'Bạn cần đăng nhập để tiếp tục.');
  next();
}
export function requireAdmin(req, res, next) {
  requireUser(req, res, () => {
    if (req.user.role !== 'admin')
      throw new ServiceError(403, 'Tài khoản này không có quyền quản trị.');
    next();
  });
}

export function ensurePassport(db, req, res) {
  const token = cookieValue(req, 'gms_session');
  let row =
    token &&
    /^[a-f0-9-]{36}$/.test(token) &&
    db.prepare('SELECT id,user_id FROM sessions WHERE id = ?').get(token);
  if (req.user) {
    const guest = row && !row.user_id ? row : null;
    row = db
      .prepare('SELECT id,user_id FROM sessions WHERE user_id = ? ORDER BY created_at,id LIMIT 1')
      .get(req.user.id);
    if (!row) {
      row = { id: randomUUID(), user_id: req.user.id };
      db.prepare('INSERT INTO sessions(id,user_id) VALUES (?,?)').run(row.id, req.user.id);
    }
    if (guest) {
      db.exec('BEGIN');
      try {
        db.prepare(
          'INSERT OR IGNORE INTO stamps(session_id,vendor_id,mode,created_at) SELECT ?,vendor_id,mode,created_at FROM stamps WHERE session_id = ?',
        ).run(row.id, guest.id);
        db.prepare('DELETE FROM stamps WHERE session_id = ?').run(guest.id);
        db.prepare('DELETE FROM sessions WHERE id = ?').run(guest.id);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  } else if (!row || row.user_id) {
    row = { id: randomUUID(), user_id: null };
    db.prepare('INSERT INTO sessions(id) VALUES (?)').run(row.id);
  }
  if (token !== row.id)
    res.cookie('gms_session', row.id, { ...cookieOptions(req), maxAge: 365 * 86400_000 });
  req.sessionId = row.id;
}

export function mountAuth(app, db) {
  const attempts = new Map();
  function throttle(req, _res, next) {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
    const item = attempts.get(req.ip) ?? { count: 0, until: now + 60_000 };
    item.count += 1;
    attempts.set(req.ip, item);
    if (item.count > 15)
      throw new ServiceError(429, 'Bạn thử đăng nhập quá nhiều lần. Vui lòng đợi một phút.');
    next();
  }
  function establish(req, res, user) {
    const previous = cookieValue(req, 'gms_auth');
    if (previous)
      db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(digest(previous));
    db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(Date.now());
    const token = randomBytes(32).toString('hex');
    const duration = (user.role === 'admin' ? 8 : 168) * 3600_000;
    db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').run(
      digest(token),
      user.id,
      Date.now() + duration,
    );
    res.cookie('gms_auth', token, { ...cookieOptions(req), maxAge: duration });
    req.user = user;
    ensurePassport(db, req, res);
    res.json({ user });
  }
  app.get('/api/auth/me', (req, res) => res.json({ user: req.user }));
  app.post('/api/auth/register', throttle, async (req, res) =>
    establish(req, res, await createAccount(db, req.body, 'user')),
  );
  app.post('/api/auth/login', throttle, async (req, res) => {
    const input = login.parse(req.body);
    const row = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(input.email);
    // Run the same password hash even for an unknown email.
    const [salt, expected] = row?.password_hash.split(':') ?? [
      '00000000000000000000000000000000',
      '0'.repeat(128),
    ];
    const actual = Buffer.from(await scryptAsync(input.password, salt, 64, passwordOptions));
    if (!timingSafeEqual(actual, Buffer.from(expected, 'hex')) || !row)
      throw new ServiceError(401, 'Email hoặc mật khẩu chưa đúng.');
    establish(req, res, publicUser(row));
  });
  app.post('/api/auth/logout', (req, res) => {
    const token = cookieValue(req, 'gms_auth');
    if (token) db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(digest(token));
    res.clearCookie('gms_auth', cookieOptions(req));
    res.clearCookie('gms_session', cookieOptions(req));
    res.json({ user: null });
  });
}
