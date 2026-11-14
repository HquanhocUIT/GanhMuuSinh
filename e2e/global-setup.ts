import { fork } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';

export default async function setup() {
  // A separate Node process loads the ESM backend without Playwright's TS
  // transform, which cannot evaluate the backend's import.meta URL assets.
  const server = fork(resolve('e2e/server.mjs'), [], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let output = '';
  server.stdout?.on('data', (chunk) => {
    output += chunk.toString();
  });
  server.stderr?.on('data', (chunk) => {
    output += chunk.toString();
  });
  try {
    await Promise.race([
      new Promise<void>((done) =>
        server.on('message', (message) => {
          if (message === 'ready') done();
        }),
      ),
      once(server, 'exit').then(([code]) => {
        throw new Error(`E2E backend exited with ${code}: ${output}`);
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`E2E backend did not start: ${output}`)), 15000),
      ),
    ]);
  } catch (error) {
    server.kill();
    throw error;
  }
  return async () => {
    if (!server.killed && server.exitCode === null) {
      server.send('stop');
      await Promise.race([
        once(server, 'exit'),
        new Promise((done) =>
          setTimeout(() => {
            server.kill();
            done(null);
          }, 5000),
        ),
      ]);
    }
  };
}
