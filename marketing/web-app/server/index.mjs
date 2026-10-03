import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const port = Number(process.env.PORT || 4174);
const host = process.env.HOST || '127.0.0.1';
const production = process.env.NODE_ENV === 'production';
const dist = production ? path.join(root, 'dist') : null;

if (dist && !existsSync(path.join(dist, 'index.html'))) {
  throw new Error('Production build not found. Run `npm run build` before `npm start`.');
}

const app = createApp({
  dataDir: process.env.DATA_DIR || path.join(root, 'data'),
  secureCookies: production && process.env.COOKIE_SECURE !== 'false',
  staticDir: dist
});

app.listen(port, host, () => {
  console.log(`CreateKids: http://${host}:${port}`);
});
