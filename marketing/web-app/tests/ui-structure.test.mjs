import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlPath = new URL('../index.html', import.meta.url);
const mainPath = new URL('../src/main.js', import.meta.url);
const stylesPath = new URL('../src/styles.css', import.meta.url);

test('application shell exposes program, progress and accessible week dialog', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /id="progress-value"/);
  assert.match(html, /id="program-grid"/);
  assert.match(html, /id="week-dialog"/);
  assert.match(html, /<main id="main-content"/);
  assert.match(html, /aria-label="Основная навигация"/);
  assert.match(html, /id="interest-map"/);
  assert.match(html, /id="interest-map-lock"/);
  assert.match(html, /id="interest-map-people"/);
});

test('application shell exposes account controls and an authentication dialog', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /id="auth-open"/);
  assert.match(html, /id="auth-dialog"/);
  assert.match(html, /id="auth-form"/);
  assert.match(html, /type="email"/);
  assert.match(html, /autocomplete="current-password"/);
  assert.match(html, /id="auth-add-child"/);
  assert.match(html, /id="auth-child-fields"/);
});

test('signed-in families can open and submit an editable family profile', async () => {
  const [html, main] = await Promise.all([
    readFile(htmlPath, 'utf8'),
    readFile(mainPath, 'utf8')
  ]);
  assert.match(html, /id="profile-open"/);
  assert.match(html, /id="profile-dialog"/);
  assert.match(html, /id="profile-form"/);
  assert.match(html, /id="profile-add-child"/);
  assert.match(html, /id="profile-child-fields"/);
  assert.match(main, /api\.updateProfile/);
  assert.match(main, /name = 'childId'/);
  assert.match(main, /profileForm\.addEventListener\('submit', submitProfile\)/);
});

test('week dialog exposes a private-by-default result form', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /id="dialog-slide"/);
  assert.match(html, /id="slide-previous"/);
  assert.match(html, /id="slide-next"/);
  assert.match(html, /class="slide-dots"/);
  assert.match(html, /data-slide-index="2"/);
  assert.match(html, /id="audience-tabs"/);
  assert.match(html, /id="adult-guide-open"[^>]+aria-haspopup="dialog"/);
  assert.match(html, /<dialog class="adult-guide-dialog" id="adult-guide-dialog"/);
  assert.match(html, /id="adult-guide-lead"/);
  assert.match(html, /id="activity-guide-list"/);
  assert.match(html, /id="observation-grid"/);
  assert.match(html, /id="result-form" novalidate/);
  assert.match(html, /id="result-photo"[^>]+accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(html, /class="file-picker"/);
  assert.match(html, /id="file-picker-name"/);
  assert.match(html, /class="result-source-column"/);
  assert.match(html, /class="result-story-column"/);
  assert.match(html, /class="result-form-footer"/);
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

test('signal hints use only the custom tooltip', async () => {
  const main = await readFile(mainPath, 'utf8');
  assert.match(main, /button\.dataset\.hint = signal\.hint/);
  assert.doesNotMatch(main, /button\.title\s*=/);
});

test('week screens are generated from the registered children', async () => {
  const main = await readFile(mainPath, 'utf8');
  assert.match(main, /observationGrid\.replaceChildren\(makeObservationCard\(subject/);
  assert.match(main, /getAssignmentForAge\(week, child\.age\)/);
  assert.match(main, /activeAudience === 'family'/);
});

test('the short adult hint opens a separate detailed guidance dialog', async () => {
  const main = await readFile(mainPath, 'utf8');
  assert.match(main, /adultGuideDialog\.showModal\(\)/);
  assert.match(main, /adultGuideDialog\.querySelector\('#adult-guide-lead'\)\.textContent = week\.tip/);
  assert.match(main, /adultGuideDialog\.querySelector\('#activity-guide-list'\)/);
  assert.match(main, /adultGuideDialog\.scrollTop = 0/);
});

test('mobile layout uses a full-screen week view and custom result validation', async () => {
  const [main, styles] = await Promise.all([
    readFile(mainPath, 'utf8'),
    readFile(stylesPath, 'utf8')
  ]);
  assert.match(styles, /\.week-dialog \{ width: 100vw; max-width: none; height: 100svh/);
  assert.match(styles, /\.auth-child-field \{ grid-template-columns: 30px minmax\(0, 1fr\) 36px/);
  assert.match(styles, /\.file-input\[aria-invalid="true"\] \+ \.file-picker/);
  assert.match(main, /resultError\.textContent = 'Добавьте фотографию результата\.'/);
  assert.match(main, /resultDescription\.setAttribute\('aria-invalid', 'true'\)/);
});

test('week and page navigation restore visible destinations', async () => {
  const [main, styles] = await Promise.all([
    readFile(mainPath, 'utf8'),
    readFile(stylesPath, 'utf8')
  ]);
  assert.match(main, /dialog\.scrollTop = 0/);
  assert.match(main, /focus\(\{ preventScroll: true \}\)/);
  assert.match(main, /\['ArrowLeft', 'ArrowRight', 'Home', 'End'\]/);
  assert.match(styles, /main > section \{ scroll-margin-top: 72px; \}/);
});
