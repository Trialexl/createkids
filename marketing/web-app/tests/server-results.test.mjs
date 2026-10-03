import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.mjs';

const ONE_PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nE0AAAAASUVORK5CYII=';

async function withServer(run) {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'createkids-results-'));
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

async function jsonRequest(baseUrl, route, { cookie = '', ...options } = {}) {
  return fetch(`${baseUrl}${route}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      origin: baseUrl,
      ...(cookie ? { cookie } : {}),
      ...(options.headers ?? {})
    }
  });
}

async function register(baseUrl, email) {
  const response = await jsonRequest(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'family-password-123' })
  });
  assert.equal(response.status, 201);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

test('family saves a private result and sees it only in its own works', async () => {
  await withServer(async (baseUrl) => {
    const cookie = await register(baseUrl, 'private@example.com');
    const created = await jsonRequest(baseUrl, '/api/results', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        weekId: 3,
        audience: 'younger',
        description: 'Сочинили историю про летающий дом',
        feeling: 'Хочу ещё',
        nextIdea: 'Добавить второго героя',
        imageDataUrl: ONE_PIXEL_PNG,
        isPublished: false
      })
    });
    assert.equal(created.status, 201);

    const own = await jsonRequest(baseUrl, '/api/results', { cookie });
    const ownBody = await own.json();
    assert.equal(ownBody.results.length, 1);
    assert.equal(ownBody.results[0].description, 'Сочинили историю про летающий дом');

    const gallery = await jsonRequest(baseUrl, '/api/gallery', { cookie });
    assert.deepEqual(await gallery.json(), { results: [] });
  });
});

test('family can publish a result anonymously and another signed-in family can view it', async () => {
  await withServer(async (baseUrl) => {
    const authorCookie = await register(baseUrl, 'author@example.com');
    const viewerCookie = await register(baseUrl, 'viewer@example.com');
    const created = await jsonRequest(baseUrl, '/api/results', {
      method: 'POST',
      cookie: authorCookie,
      body: JSON.stringify({
        weekId: 8,
        audience: 'family',
        description: 'Сделали бумажный прототип игры',
        feeling: 'Хочу иначе',
        nextIdea: 'Добавить совместный режим',
        imageDataUrl: ONE_PIXEL_PNG,
        isPublished: false
      })
    });
    const result = (await created.json()).result;

    const hiddenImage = await fetch(`${baseUrl}${result.imageUrl}`, { headers: { cookie: viewerCookie } });
    assert.equal(hiddenImage.status, 404);

    const published = await jsonRequest(baseUrl, `/api/results/${result.id}`, {
      method: 'PATCH',
      cookie: authorCookie,
      body: JSON.stringify({ isPublished: true })
    });
    assert.equal(published.status, 200);
    assert.equal((await published.json()).result.isPublished, true);

    const gallery = await jsonRequest(baseUrl, '/api/gallery', { cookie: viewerCookie });
    const galleryBody = await gallery.json();
    assert.equal(galleryBody.results.length, 1);
    assert.equal(galleryBody.results[0].description, 'Сделали бумажный прототип игры');
    assert.equal('email' in galleryBody.results[0], false);
    assert.equal('userId' in galleryBody.results[0], false);

    const visibleImage = await fetch(`${baseUrl}${galleryBody.results[0].imageUrl}`, { headers: { cookie: viewerCookie } });
    assert.equal(visibleImage.status, 200);
    assert.equal(visibleImage.headers.get('content-type'), 'image/png');
    assert.equal(visibleImage.headers.get('cache-control'), 'no-store');
  });
});

test('family can delete its result and its photo', async () => {
  await withServer(async (baseUrl) => {
    const cookie = await register(baseUrl, 'delete@example.com');
    const created = await jsonRequest(baseUrl, '/api/results', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        weekId: 5,
        audience: 'teen',
        description: 'Собрали прототип органайзера',
        feeling: 'Достаточно',
        nextIdea: '',
        imageDataUrl: ONE_PIXEL_PNG,
        isPublished: false
      })
    });
    const result = (await created.json()).result;

    const deleted = await jsonRequest(baseUrl, `/api/results/${result.id}`, {
      method: 'DELETE',
      cookie,
      body: '{}'
    });
    assert.equal(deleted.status, 204);

    const own = await jsonRequest(baseUrl, '/api/results', { cookie });
    assert.deepEqual(await own.json(), { results: [] });

    const image = await fetch(`${baseUrl}${result.imageUrl}`, { headers: { cookie } });
    assert.equal(image.status, 404);
  });
});
