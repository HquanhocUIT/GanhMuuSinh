import { randomBytes } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { openDatabase } from '../src/db.js';
import { createAccount } from '../src/services/auth.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(root, '.env'), quiet: true });
const email = process.argv[2];
if (!email) {
  console.error('Cách dùng: npm run admin:create -- admin@example.com');
  process.exit(1);
}
const db = openDatabase(process.env.DATABASE_PATH || resolve(root, 'data/ganhmuusinh.sqlite'));
const password = randomBytes(18).toString('base64url');
try {
  const user = await createAccount(db, { email, name: 'Quản trị viên', password }, 'admin');
  console.log(
    `Đã tạo quản trị viên: ${user.email}\nMật khẩu ngẫu nhiên (chỉ hiển thị lần này): ${password}\nĐăng nhập tại /#admin. Không chia sẻ mật khẩu hoặc đưa vào Git.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
