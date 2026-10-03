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

test('application shell exposes account controls and an authentication dialog', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /id="auth-open"/);
  assert.match(html, /id="auth-dialog"/);
  assert.match(html, /id="auth-form"/);
  assert.match(html, /type="email"/);
  assert.match(html, /autocomplete="current-password"/);
});

test('week dialog exposes a private-by-default result form', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /id="dialog-slide"/);
  assert.match(html, /id="slide-previous"/);
  assert.match(html, /id="slide-next"/);
  assert.match(html, /class="slide-dots"/);
  assert.match(html, /data-slide-index="2"/);
  assert.match(html, /id="result-form"/);
  assert.match(html, /id="result-photo"[^>]+accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(html, /id="result-description"/);
  assert.match(html, /id="result-next-idea"/);
  assert.match(html, /id="result-publish"/);
  assert.doesNotMatch(html, /id="result-publish"[^>]+checked/);
});

test('application shell separates private family works from the anonymous gallery', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /id="gallery"/);
  assert.match(html, /id="my-results"/);
  assert.match(html, /id="gallery-results"/);
  assert.match(html, /id="gallery-auth-cta"/);
  assert.match(html, /без рейтингов, лайков и комментариев/i);
});
