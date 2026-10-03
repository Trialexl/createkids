import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.mjs';

async function withServer(run) {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'createkids-auth-'));
  const app = createApp({ dataDir, sessionTtlMs: 60_000 });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

async function request(baseUrl, route, options = {}) {
  return fetch(`${baseUrl}${route}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      origin: baseUrl,
      ...(options.headers ?? {})
    }
  });
}

function sessionCookie(response) {
  return response.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
}

test('family can register, read its session and log out', async () => {
  await withServer(async (baseUrl) => {
    const registration = await request(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: ' Parent@Example.COM ', password: 'long-family-password' })
    });

    assert.equal(registration.status, 201);
    assert.match(registration.headers.get('set-cookie') ?? '', /createkids_session=/);
    assert.deepEqual(await registration.json(), {
      user: { email: 'parent@example.com' }
    });

    const cookie = sessionCookie(registration);
    const me = await request(baseUrl, '/api/auth/me', { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.deepEqual(await me.json(), { user: { email: 'parent@example.com' } });

    const logout = await request(baseUrl, '/api/auth/logout', {
      method: 'POST',
      headers: { cookie },
      body: '{}'
    });
    assert.equal(logout.status, 204);

    const afterLogout = await request(baseUrl, '/api/auth/me', { headers: { cookie } });
    assert.equal(afterLogout.status, 401);
  });
});

test('login rejects a wrong password and creates a fresh session for the right one', async () => {
  await withServer(async (baseUrl) => {
    await request(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'family@example.com', password: 'correct-password-123' })
    });

    const wrong = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'family@example.com', password: 'wrong-password-123' })
    });
    assert.equal(wrong.status, 401);

    const login = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'family@example.com', password: 'correct-password-123' })
    });
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie') ?? '', /HttpOnly/);
  });
});

test('authenticated family can save and restore program progress', async () => {
  await withServer(async (baseUrl) => {
    const registration = await request(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'progress@example.com', password: 'progress-password-123' })
    });
    const cookie = sessionCookie(registration);
    const state = {
      completed: [1, 2],
      observations: {
        2: { younger: { note: 'Сделал вторую версию', feeling: 'Хочу ещё' } }
      }
    };

    const saved = await request(baseUrl, '/api/progress', {
      method: 'PUT',
      headers: { cookie },
      body: JSON.stringify(state)
    });
    assert.equal(saved.status, 200);

    const restored = await request(baseUrl, '/api/progress', { headers: { cookie } });
    assert.equal(restored.status, 200);
    assert.deepEqual(await restored.json(), state);
  });
});

test('production shell serves client routes without swallowing unknown API routes', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'createkids-production-'));
  const dataDir = path.join(rootDir, 'data');
  const staticDir = path.join(rootDir, 'dist');
  await mkdir(staticDir);
  await writeFile(path.join(staticDir, 'index.html'), '<!doctype html><title>CreateKids</title>');
  await writeFile(path.join(staticDir, 'app.js'), 'console.log("CreateKids")');
  const app = createApp({ dataDir, staticDir });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const shell = await fetch(`${baseUrl}/program/week/4`);
    assert.equal(shell.status, 200);
    assert.match(await shell.text(), /CreateKids/);

    const asset = await fetch(`${baseUrl}/app.js`);
    assert.equal(asset.status, 200);
    assert.match(await asset.text(), /console\.log/);

    const missingApi = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(missingApi.status, 404);
    assert.deepEqual(await missingApi.json(), { error: 'not_found' });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.locals.closeDatabase();
    await rm(rootDir, { recursive: true, force: true });
  }
});
