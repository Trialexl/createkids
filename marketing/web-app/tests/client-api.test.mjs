import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.mjs';
import { createApiClient } from '../src/api.mjs';

async function withServer(run) {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'createkids-client-'));
  const app = createApp({ dataDir, sessionTtlMs: 60_000 });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.locals.closeDatabase();
    await rm(dataDir, { recursive: true, force: true });
  }
}

function createCookieFetch(baseUrl) {
  let cookie = '';
  return async (route, options = {}) => {
    const response = await fetch(`${baseUrl}${route}`, {
      ...options,
      headers: { ...(options.headers ?? {}), ...(cookie ? { cookie } : {}) }
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';', 1)[0];
    return response;
  };
}

const ONE_PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nE0AAAAASUVORK5CYII=';

test('browser client registers a family and synchronizes progress', async () => {
  await withServer(async (baseUrl) => {
    const client = createApiClient(createCookieFetch(baseUrl));
    const user = await client.register('family@example.com', 'family-password-123');
    assert.deepEqual(user, { email: 'family@example.com' });
    assert.deepEqual(await client.getCurrentUser(), user);

    const state = { completed: [1, 2], observations: { 2: { teen: { note: 'Сделала две версии' } } } };
    assert.deepEqual(await client.saveProgress(state), state);
    assert.deepEqual(await client.getProgress(), state);
  });
});

test('browser client publishes, reads and deletes a result', async () => {
  await withServer(async (baseUrl) => {
    const client = createApiClient(createCookieFetch(baseUrl));
    await client.register('manage@example.com', 'family-password-123');
    const saved = await client.createResult({
      weekId: 6,
      audience: 'family',
      description: 'Сняли короткую сцену',
      feeling: 'Хочу ещё',
      nextIdea: '',
      imageDataUrl: ONE_PIXEL_PNG,
      isPublished: false
    });

    const published = await client.setResultPublished(saved.id, true);
    assert.equal(published.isPublished, true);
    assert.equal((await client.getGallery())[0].id, saved.id);

    await client.deleteResult(saved.id);
    assert.deepEqual(await client.getResults(), []);
  });
});

test('browser client saves and lists a family result', async () => {
  await withServer(async (baseUrl) => {
    const client = createApiClient(createCookieFetch(baseUrl));
    await client.register('works@example.com', 'family-password-123');
    const saved = await client.createResult({
      weekId: 4,
      audience: 'teen',
      description: 'Сделали афишу',
      feeling: 'Хочу ещё',
      nextIdea: 'Поменять шрифт',
      imageDataUrl: ONE_PIXEL_PNG,
      isPublished: false
    });
    assert.equal(saved.description, 'Сделали афишу');
    assert.deepEqual(await client.getResults(), [saved]);
  });
});
