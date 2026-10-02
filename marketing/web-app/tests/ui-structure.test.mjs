import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlPath = new URL('../index.html', import.meta.url);

test('application shell exposes program, progress and accessible week dialog', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /id="progress-value"/);
  assert.match(html, /id="program-grid"/);
  assert.match(html, /id="week-dialog"/);
  assert.match(html, /<main id="main-content"/);
  assert.match(html, /aria-label="Основная навигация"/);
});
