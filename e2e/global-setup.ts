import { once } from 'node:events';
import { resolve } from 'node:path';
import { createApp } from '../be/src/app.js';
import { openDatabase } from '../be/src/db.js';
import { createAI } from '../be/src/services/ai.js';
import { createAccount } from '../be/src/services/auth.js';

export default async function setup() {
  const db = openDatabase(':memory:');
  // This account exists only in the isolated in-memory E2E database.
  await createAccount(
    db,
    { email: 'admin@e2e.test', name: 'Biên tập viên', password: 'E2E-only-password-2026' },
    'admin',
  );
  const app = createApp({ db, ai: createAI({}), frontendPath: resolve('fe/dist') });
  const server = app.listen(4173, '127.0.0.1');
  await once(server, 'listening');
  return async () => {
    server.closeAllConnections();
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
    db.close();
  };
}
