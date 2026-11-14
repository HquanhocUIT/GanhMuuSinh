import { once } from 'node:events';
import { resolve } from 'node:path';
import { createApp } from '../be/src/app.js';
import { openDatabase } from '../be/src/db.js';
import { createAI } from '../be/src/services/ai.js';
import { createAccount } from '../be/src/services/auth.js';

const db = openDatabase(':memory:');
await createAccount(
  db,
  { email: 'admin@e2e.test', name: 'Biên tập viên', password: 'E2E-only-password-2026' },
  'admin',
);
const app = createApp({ db, ai: createAI({}), frontendPath: resolve('fe/dist') });
const server = app.listen(4173, '127.0.0.1');
await once(server, 'listening');
process.send?.('ready');
process.on('message', (message) => {
  if (message !== 'stop') return;
  server.closeAllConnections();
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
