import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createDatabase } from './database.mjs';
import { defaultChildren, MAX_CHILD_AGE, MIN_CHILD_AGE } from '../src/family.mjs';
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  verifyPassword
} from './security.mjs';

const COOKIE_NAME = 'createkids_session';
const EMPTY_PROGRESS = { completed: [], observations: {} };
const OBSERVATION_FEELINGS = new Set(['Хочу ещё', 'Достаточно', 'Хочу иначе', 'Пока не хочу']);
const OBSERVATION_SIGNALS = new Set(['chose', 'stayed', 'returned', 'improved', 'shared']);
const IMAGE_TYPES = {
  'image/png': { extension: 'png', signature: '89504e47' },
  'image/jpeg': { extension: 'jpg', signature: 'ffd8ff' },
  'image/webp': { extension: 'webp', signature: '52494646' }
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
      const index = part.indexOf('=');
      if (index === -1) return [part, ''];
      return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    })
  );
}

function storedChildren(value, { includeArchived = false } = {}) {
  try {
    const parsed = JSON.parse(value ?? '[]');
    if (!Array.isArray(parsed)) throw new Error('invalid_children');
    const ids = new Set();
    const children = parsed.filter((item) => {
      const id = String(item?.id ?? '');
      const name = String(item?.name ?? '').trim();
      const age = Number(item?.age);
      const valid = /^[A-Za-z0-9_-]{1,64}$/.test(id)
        && !ids.has(id)
        && name
        && name.length <= 40
        && Number.isInteger(age)
        && age >= MIN_CHILD_AGE
        && age <= MAX_CHILD_AGE;
      if (valid) ids.add(id);
      return valid;
    }).map((item) => ({ id: item.id, name: item.name.trim(), age: Number(item.age), active: item.active !== false }));
    const active = children.filter((child) => child.active);
    if (active.length < 1) throw new Error('invalid_children');
    return (includeArchived ? children : active).map(({ active: _active, ...child }) => child);
  } catch {
    return defaultChildren.map((child) => ({ ...child }));
  }
}

function registrationChildren(value) {
  if (!Array.isArray(value) || value.length < 1) return null;
  const children = [];
  for (const [index, item] of value.entries()) {
    const name = String(item?.name ?? '').trim();
    const age = Number(item?.age);
    if (!name || name.length > 40 || !Number.isInteger(age) || age < MIN_CHILD_AGE || age > MAX_CHILD_AGE) return null;
    children.push({ id: `child-${index + 1}-${randomUUID().slice(0, 8)}`, name, age, active: true });
  }
  return children;
}

function profileChildren(value, existingChildren) {
  if (!Array.isArray(value) || value.length < 1) return null;
  const existingById = new Map(existingChildren.map((child) => [child.id, child]));
  const selectedIds = new Set();
  const active = [];
  for (const [index, item] of value.entries()) {
    const name = String(item?.name ?? '').trim();
    const age = Number(item?.age);
    const requestedId = String(item?.id ?? '');
    const id = existingById.has(requestedId)
      ? requestedId
      : `child-${index + 1}-${randomUUID().slice(0, 8)}`;
    if (!name || name.length > 40 || !Number.isInteger(age) || age < MIN_CHILD_AGE || age > MAX_CHILD_AGE || selectedIds.has(id)) return null;
    selectedIds.add(id);
    active.push({ id, name, age, active: true });
  }
  const archived = existingChildren
    .filter((child) => !selectedIds.has(child.id))
    .map((child) => ({ ...child, active: false }));
  return [...active, ...archived];
}

function publicUser(user) {
  return { email: user.email, children: storedChildren(user.children_json) };
}

function sanitizeProgress(value, children = defaultChildren) {
  const completed = Array.isArray(value?.completed)
    ? [...new Set(value.completed.map(Number).filter((id) => Number.isInteger(id) && id >= 1 && id <= 12))].sort((a, b) => a - b)
    : [];
  const observations = {};
  if (value?.observations && typeof value.observations === 'object' && !Array.isArray(value.observations)) {
    for (const [weekKey, weekValue] of Object.entries(value.observations)) {
      const weekId = Number(weekKey);
      if (!Number.isInteger(weekId) || weekId < 1 || weekId > 12 || !weekValue || typeof weekValue !== 'object') continue;
      const people = {};
      for (const person of [...children.map((child) => child.id), 'family']) {
        const observation = weekValue[person];
        if (!observation || typeof observation !== 'object' || Array.isArray(observation)) continue;
        const note = typeof observation.note === 'string' ? observation.note.slice(0, 2_000) : '';
        const feeling = OBSERVATION_FEELINGS.has(observation.feeling) ? observation.feeling : '';
        const signals = Array.isArray(observation.signals)
          ? [...new Set(observation.signals.filter((signal) => OBSERVATION_SIGNALS.has(signal)))]
          : [];
        people[person] = { note, feeling, signals };
      }
      if (Object.keys(people).length) observations[String(weekId)] = people;
    }
  }
  const state = { completed, observations };
  if (JSON.stringify(state).length > 100_000) throw new Error('progress_too_large');
  return state;
}

function decodeImageDataUrl(value) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(value ?? ''));
  if (!match || !IMAGE_TYPES[match[1]]) throw new Error('invalid_image');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw new Error('invalid_image');
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('image_too_large');
  const { extension, signature } = IMAGE_TYPES[match[1]];
  if (!buffer.subarray(0, signature.length / 2).toString('hex').startsWith(signature)) {
    throw new Error('invalid_image');
  }
  if (match[1] === 'image/webp' && buffer.subarray(8, 12).toString('ascii') !== 'WEBP') {
    throw new Error('invalid_image');
  }
  return { buffer, extension };
}

function validateResultInput(value, children = defaultChildren) {
  const weekId = Number(value?.weekId);
  const audience = String(value?.audience ?? '');
  const description = String(value?.description ?? '').trim();
  const feeling = String(value?.feeling ?? '').trim();
  const nextIdea = String(value?.nextIdea ?? '').trim();
  if (!Number.isInteger(weekId) || weekId < 1 || weekId > 12) throw new Error('invalid_result');
  if (audience !== 'family' && !children.some((child) => child.id === audience)) throw new Error('invalid_result');
  if (!description || description.length > 1_000) throw new Error('invalid_result');
  if (feeling.length > 100 || nextIdea.length > 1_000) throw new Error('invalid_result');
  return {
    weekId,
    audience,
    description,
    feeling,
    nextIdea,
    isPublished: value?.isPublished === true
  };
}

function serializeResult(row, children = defaultChildren, { anonymous = false } = {}) {
  const child = children.find((item) => item.id === row.audience);
  const audienceLabel = row.audience === 'family'
    ? 'Вся семья'
    : child
      ? anonymous ? `Ребёнок · ${child.age} лет` : child.name
      : 'Ребёнок';
  return {
    id: row.id,
    weekId: row.week_id,
    audience: row.audience,
    audienceLabel,
    description: row.description,
    feeling: row.feeling,
    nextIdea: row.next_idea,
    imageUrl: `/api/images/${row.image_name}`,
    isPublished: Boolean(row.is_published),
    createdAt: row.created_at
  };
}

export function createApp({
  dataDir = path.resolve('data'),
  sessionTtlMs = 30 * 24 * 60 * 60 * 1000,
  secureCookies = false,
  staticDir = null
} = {}) {
  const db = createDatabase(dataDir);
  const uploadsDir = path.join(dataDir, 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '8mb' }));
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.locals.closeDatabase = () => db.close();

  const setSessionCookie = (res, token) => {
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookies,
      path: '/',
      maxAge: sessionTtlMs
    });
  };

  const createSession = (userId, res) => {
    const token = createSessionToken();
    const now = Date.now();
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run(hashSessionToken(token), userId, now + sessionTtlMs, new Date(now).toISOString());
    setSessionCookie(res, token);
  };

  const requireUser = (req, res, next) => {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'auth_required' });
    const tokenHash = hashSessionToken(token);
    const session = db.prepare(`
      SELECT users.id, users.email, users.children_json, sessions.expires_at
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
    `).get(tokenHash);
    if (!session || session.expires_at <= Date.now()) {
      if (session) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      return res.status(401).json({ error: 'auth_required' });
    }
    req.user = {
      id: session.id,
      email: session.email,
      children_json: session.children_json,
      children: storedChildren(session.children_json),
      allChildren: storedChildren(session.children_json, { includeArchived: true })
    };
    req.sessionTokenHash = tokenHash;
    next();
  };

  app.post('/api/auth/register', async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = req.body?.password;
      const children = registrationChildren(req.body?.children);
      if (!isValidEmail(email)) return res.status(400).json({ error: 'invalid_email' });
      if (!isValidPassword(password)) return res.status(400).json({ error: 'weak_password' });
      if (!children) return res.status(400).json({ error: 'invalid_children' });
      if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
        return res.status(409).json({ error: 'email_exists' });
      }
      const passwordHash = await hashPassword(password);
      const childrenJson = JSON.stringify(children);
      const result = db.prepare('INSERT INTO users (email, password_hash, children_json, created_at) VALUES (?, ?, ?, ?)')
        .run(email, passwordHash, childrenJson, new Date().toISOString());
      createSession(Number(result.lastInsertRowid), res);
      return res.status(201).json({ user: publicUser({ email, children_json: childrenJson }) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = req.body?.password;
      const user = db.prepare('SELECT id, email, password_hash, children_json FROM users WHERE email = ?').get(email);
      if (!user || !isValidPassword(password) || !(await verifyPassword(password, user.password_hash))) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      createSession(user.id, res);
      return res.json({ user: publicUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/logout', requireUser, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.sessionTokenHash);
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: secureCookies, path: '/' });
    res.status(204).end();
  });

  app.get('/api/auth/me', requireUser, (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  app.patch('/api/profile', requireUser, (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) return res.status(400).json({ error: 'invalid_email' });
    const children = profileChildren(req.body?.children, req.user.allChildren);
    if (!children) return res.status(400).json({ error: 'invalid_children' });
    const duplicate = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.id);
    if (duplicate) return res.status(409).json({ error: 'email_exists' });
    const childrenJson = JSON.stringify(children);
    db.prepare('UPDATE users SET email = ?, children_json = ? WHERE id = ?')
      .run(email, childrenJson, req.user.id);
    res.json({ user: publicUser({ email, children_json: childrenJson }) });
  });

  app.get('/api/progress', requireUser, (req, res) => {
    const row = db.prepare('SELECT state_json FROM progress WHERE user_id = ?').get(req.user.id);
    res.json(row ? sanitizeProgress(JSON.parse(row.state_json), req.user.allChildren) : EMPTY_PROGRESS);
  });

  app.put('/api/progress', requireUser, (req, res) => {
    try {
      const state = sanitizeProgress(req.body, req.user.allChildren);
      db.prepare(`
        INSERT INTO progress (user_id, state_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
      `).run(req.user.id, JSON.stringify(state), new Date().toISOString());
      res.json(state);
    } catch (error) {
      if (error.message === 'progress_too_large') return res.status(413).json({ error: 'progress_too_large' });
      throw error;
    }
  });

  app.post('/api/results', requireUser, (req, res) => {
    try {
      const result = validateResultInput(req.body, req.user.children);
      const image = decodeImageDataUrl(req.body?.imageDataUrl);
      const id = randomUUID();
      const imageName = `${id}.${image.extension}`;
      const now = new Date().toISOString();
      writeFileSync(path.join(uploadsDir, imageName), image.buffer, { flag: 'wx' });
      db.prepare(`
        INSERT INTO results (
          id, user_id, week_id, audience, description, feeling,
          next_idea, image_name, is_published, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        req.user.id,
        result.weekId,
        result.audience,
        result.description,
        result.feeling,
        result.nextIdea,
        imageName,
        result.isPublished ? 1 : 0,
        now,
        now
      );
      const row = db.prepare('SELECT * FROM results WHERE id = ?').get(id);
      res.status(201).json({ result: serializeResult(row, req.user.allChildren) });
    } catch (error) {
      if (error.message === 'image_too_large') return res.status(413).json({ error: 'image_too_large' });
      if (error.message === 'invalid_image' || error.message === 'invalid_result') {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  });

  app.get('/api/results', requireUser, (req, res) => {
    const rows = db.prepare('SELECT * FROM results WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json({ results: rows.map((row) => serializeResult(row, req.user.allChildren)) });
  });

  app.patch('/api/results/:id', requireUser, (req, res) => {
    if (typeof req.body?.isPublished !== 'boolean') {
      return res.status(400).json({ error: 'invalid_publication_state' });
    }
    const existing = db.prepare('SELECT id FROM results WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'result_not_found' });
    db.prepare('UPDATE results SET is_published = ?, updated_at = ? WHERE id = ?')
      .run(req.body.isPublished ? 1 : 0, new Date().toISOString(), req.params.id);
    const row = db.prepare('SELECT * FROM results WHERE id = ?').get(req.params.id);
    res.json({ result: serializeResult(row, req.user.allChildren) });
  });

  app.delete('/api/results/:id', requireUser, (req, res) => {
    const row = db.prepare('SELECT image_name FROM results WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: 'result_not_found' });
    db.prepare('DELETE FROM results WHERE id = ?').run(req.params.id);
    rmSync(path.join(uploadsDir, row.image_name), { force: true });
    res.status(204).end();
  });

  app.get('/api/gallery', requireUser, (_req, res) => {
    const rows = db.prepare(`
      SELECT results.*, users.children_json
      FROM results JOIN users ON users.id = results.user_id
      WHERE results.is_published = 1
      ORDER BY results.created_at DESC LIMIT 60
    `).all();
    res.json({
      results: rows.map((row) => serializeResult(
        row,
        storedChildren(row.children_json, { includeArchived: true }),
        { anonymous: true }
      ))
    });
  });

  app.get('/api/images/:imageName', requireUser, (req, res) => {
    const row = db.prepare('SELECT user_id, is_published FROM results WHERE image_name = ?').get(req.params.imageName);
    if (!row || (row.user_id !== req.user.id && !row.is_published)) {
      return res.status(404).json({ error: 'image_not_found' });
    }
    res.sendFile(path.join(uploadsDir, req.params.imageName));
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  if (staticDir) {
    app.use(express.static(staticDir, { index: false }));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
