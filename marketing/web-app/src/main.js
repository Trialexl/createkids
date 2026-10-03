import { ApiError, createApiClient } from './api.mjs';
import {
  getCurrentWeek,
  getProgress,
  getWeekById,
  toggleCompletedWeek,
  weeks
} from './program.mjs';
import { createInitialState, parseSavedState, updateObservation } from './state.mjs';

const STORAGE_KEY = 'createkids-family-lab-v1';
const feelings = ['Хочу ещё', 'Достаточно', 'Хочу иначе', 'Пока не хочу'];
const audienceLabels = {
  younger: 'Задание для 7 лет',
  teen: 'Задание для 14 лет',
  family: 'Совместная лаборатория'
};
const audienceCardLabels = {
  younger: '7 лет',
  teen: '14 лет',
  family: 'Вся семья'
};
const api = createApiClient();

let state = loadState();
let currentUser = null;
let authMode = 'login';
let activeWeekId = getCurrentWeek(state.completed)?.id ?? 12;
let activeAudience = 'younger';
let activeSlideIndex = 0;
let activeFilter = 'all';
let photoPreviewUrl = '';

const grid = document.querySelector('#program-grid');
const dialog = document.querySelector('#week-dialog');
const progressTrack = document.querySelector('.progress-track');
const progressBar = document.querySelector('#progress-bar');
const progressValue = document.querySelector('#progress-value');
const progressPercent = document.querySelector('#progress-percent');
const currentWeekButton = document.querySelector('#current-week-button');
const currentWeekTitle = document.querySelector('#current-week-title');
const currentWeekIndex = document.querySelector('.current-week-index');
const completeButton = document.querySelector('#complete-week');
const saveStatus = document.querySelector('#save-status');
const authDialog = document.querySelector('#auth-dialog');
const authForm = document.querySelector('#auth-form');
const authError = document.querySelector('#auth-error');
const authPassword = document.querySelector('#auth-password');
const authSubmit = document.querySelector('#auth-submit');
const accountStatus = document.querySelector('#account-status');
const authOpen = document.querySelector('#auth-open');
const logoutButton = document.querySelector('#logout-button');
const galleryAuthCta = document.querySelector('#gallery-auth-cta');
const galleryLayout = document.querySelector('#gallery-layout');
const myResults = document.querySelector('#my-results');
const galleryResults = document.querySelector('#gallery-results');
const resultForm = document.querySelector('#result-form');
const resultPhoto = document.querySelector('#result-photo');
const resultAudience = document.querySelector('#result-audience');
const resultError = document.querySelector('#result-error');
const resultSubmit = document.querySelector('#result-submit');
const resultAuthNote = document.querySelector('#result-auth-note');
const photoPreview = document.querySelector('#photo-preview');

function loadState() {
  try {
    return parseSavedState(localStorage.getItem(STORAGE_KEY));
  } catch {
    return createInitialState();
  }
}

function hasProgress(value) {
  return value.completed.length > 0 || Object.keys(value.observations).length > 0;
}

function saveState() {
  window.clearTimeout(saveState.timer);
  if (!currentUser) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveStatus.textContent = 'Сохранено на этом устройстве';
    saveState.timer = window.setTimeout(() => {
      saveStatus.textContent = 'Сохраняется на устройстве';
    }, 1800);
    return;
  }

  const accountEmail = currentUser.email;
  saveStatus.textContent = 'Сохраняется в аккаунте…';
  saveState.timer = window.setTimeout(async () => {
    if (currentUser?.email !== accountEmail) return;
    try {
      await api.saveProgress(state);
      saveStatus.textContent = 'Сохранено в аккаунте';
    } catch {
      saveStatus.textContent = 'Не удалось сохранить — повторите изменение';
    }
  }, 350);
}

function renderProgress() {
  const progress = getProgress(state.completed);
  const current = getCurrentWeek(state.completed);
  progressValue.textContent = `${progress.completed} из ${progress.total}`;
  progressPercent.textContent = `${progress.percent}%`;
  progressBar.style.width = `${progress.percent}%`;
  progressTrack.setAttribute('aria-valuenow', String(progress.percent));

  if (current) {
    currentWeekButton.disabled = false;
    currentWeekButton.dataset.week = String(current.id);
    currentWeekIndex.textContent = String(current.id).padStart(2, '0');
    currentWeekTitle.textContent = current.title;
  } else {
    currentWeekButton.disabled = false;
    currentWeekButton.dataset.week = '12';
    currentWeekIndex.textContent = '✓';
    currentWeekTitle.textContent = 'Пилот завершён — открыть фестиваль';
  }
}

function renderProgram() {
  const visibleWeeks = weeks.filter((week) => {
    const isDone = state.completed.includes(week.id);
    if (activeFilter === 'done') return isDone;
    if (activeFilter === 'open') return !isDone;
    return true;
  });

  grid.replaceChildren();
  for (const week of visibleWeeks) {
    const isDone = state.completed.includes(week.id);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `week-card color-${week.color}${isDone ? ' is-done' : ''}`;
    card.dataset.week = String(week.id);
    card.setAttribute('aria-label', `Неделя ${week.id}: ${week.title}${isDone ? ', исследована' : ''}`);

    const image = document.createElement('img');
    image.className = 'week-card-slide';
    image.src = week.image;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';

    const top = document.createElement('span');
    top.className = 'week-card-top';
    const number = document.createElement('strong');
    number.textContent = String(week.id).padStart(2, '0');
    const icon = document.createElement('i');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = week.icon;
    top.append(number, icon);

    const body = document.createElement('span');
    body.className = 'week-card-body';
    const short = document.createElement('small');
    short.textContent = week.short;
    const title = document.createElement('b');
    title.textContent = week.title;
    body.append(short, title);

    const status = document.createElement('span');
    status.className = 'week-card-status';
    status.textContent = isDone ? 'Исследовано ✓' : 'Открыть →';
    card.append(image, top, body, status);
    grid.append(card);
  }

  if (visibleWeeks.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = activeFilter === 'done'
      ? 'Пока нет исследованных недель. Начните с первой.'
      : 'Все недели уже исследованы — время семейного фестиваля.';
    grid.append(empty);
  }
}

function renderFeelings(person) {
  const container = dialog.querySelector(`[data-feelings="${person}"]`);
  const selected = state.observations[String(activeWeekId)]?.[person]?.feeling ?? '';
  container.replaceChildren();
  for (const feeling of feelings) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `feeling-chip${selected === feeling ? ' is-selected' : ''}`;
    button.textContent = feeling;
    button.dataset.person = person;
    button.dataset.feeling = feeling;
    button.setAttribute('aria-pressed', String(selected === feeling));
    container.append(button);
  }
}

function renderObservations() {
  const weekState = state.observations[String(activeWeekId)] ?? {};
  for (const person of ['younger', 'teen']) {
    const textarea = dialog.querySelector(`[data-note="${person}"]`);
    textarea.value = weekState[person]?.note ?? '';
    renderFeelings(person);
  }
}

function renderActivity() {
  const week = getWeekById(activeWeekId);
  dialog.querySelector('#activity-kicker').textContent = audienceLabels[activeAudience];
  dialog.querySelector('#activity-text').textContent = week[activeAudience];
  resultAudience.value = activeAudience;
  dialog.querySelectorAll('[role="tab"]').forEach((tab) => {
    const selected = tab.dataset.audience === activeAudience;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
}

function renderWeekSlide(index = 0) {
  const week = getWeekById(activeWeekId);
  if (!week) return;
  const images = week.images?.length ? week.images : [week.image];
  const requestedIndex = Number(index) || 0;
  activeSlideIndex = (requestedIndex + images.length) % images.length;

  const slide = dialog.querySelector('#dialog-slide');
  slide.src = images[activeSlideIndex];
  slide.alt = `Иллюстрация ${activeSlideIndex + 1} к неделе ${week.id}: ${week.title}`;

  dialog.querySelectorAll('.slide-dots [data-slide-index]').forEach((button) => {
    const buttonIndex = Number(button.dataset.slideIndex);
    button.setAttribute('aria-pressed', String(buttonIndex === activeSlideIndex));
    button.disabled = buttonIndex >= images.length;
  });
}

function openWeek(id) {
  const week = getWeekById(id);
  if (!week) return;
  activeWeekId = week.id;
  activeAudience = 'younger';
  activeSlideIndex = 0;
  resultError.textContent = '';

  dialog.className = `week-dialog dialog-${week.color}`;
  dialog.querySelector('#dialog-number').textContent = String(week.id).padStart(2, '0');
  dialog.querySelector('#dialog-label').textContent = `Неделя ${week.id} · ${week.short}`;
  dialog.querySelector('#dialog-title').textContent = week.title;
  dialog.querySelector('#dialog-skill').textContent = week.skill;
  renderWeekSlide();
  dialog.querySelector('#activity-artifact').textContent = week.artifact;
  dialog.querySelector('#activity-tip').textContent = week.tip;
  dialog.querySelector('#dialog-previous').disabled = week.id === 1;
  dialog.querySelector('#dialog-next').disabled = week.id === 12;
  completeButton.textContent = state.completed.includes(week.id)
    ? 'Вернуть в программу'
    : 'Отметить как исследованную';
  completeButton.classList.toggle('is-completed', state.completed.includes(week.id));

  renderActivity();
  renderObservations();
  if (!dialog.open) dialog.showModal();
  dialog.querySelector('#dialog-close').focus();
}

function setFilter(nextFilter) {
  activeFilter = nextFilter;
  document.querySelectorAll('.filter-button').forEach((button) => {
    const selected = button.dataset.filter === activeFilter;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  renderProgram();
}

function updateNote(person, note) {
  state = updateObservation(state, activeWeekId, person, { note });
  saveState();
}

function updateFeeling(person, feeling) {
  state = updateObservation(state, activeWeekId, person, { feeling });
  saveState();
  renderFeelings(person);
}

function toggleActiveWeek() {
  state = {
    ...state,
    completed: toggleCompletedWeek(state.completed, activeWeekId)
  };
  saveState();
  renderProgress();
  renderProgram();
  openWeek(activeWeekId);
}

async function resetAllData() {
  const location = currentUser ? 'в семейном аккаунте' : 'на этом устройстве';
  if (!window.confirm(`Удалить прогресс и личные заметки ${location}? Сохранённые работы останутся.`)) return;
  state = createInitialState();
  localStorage.removeItem(STORAGE_KEY);
  if (currentUser) await api.saveProgress(state);
  activeWeekId = 1;
  renderProgress();
  renderProgram();
  saveStatus.textContent = currentUser ? 'Сохранено в аккаунте' : 'Сохраняется на устройстве';
}

function errorMessage(error) {
  const messages = {
    invalid_credentials: 'Неверный email или пароль.',
    email_exists: 'Аккаунт с таким email уже существует. Переключитесь на вход.',
    invalid_email: 'Проверьте адрес электронной почты.',
    weak_password: 'Пароль должен содержать от 10 до 128 символов.',
    image_too_large: 'Файл больше 5 МБ. Выберите фотографию меньшего размера.',
    invalid_image: 'Поддерживаются PNG, JPEG и WebP.',
    invalid_result: 'Проверьте описание и выбранное задание.',
    auth_required: 'Войдите в семейный аккаунт.'
  };
  if (error instanceof ApiError) return messages[error.code] ?? 'Не удалось выполнить действие. Попробуйте ещё раз.';
  return 'Нет связи с сервером. Проверьте, что приложение запущено.';
}

function setAuthMode(mode) {
  authMode = mode;
  const isLogin = mode === 'login';
  authDialog.querySelector('#auth-title').textContent = isLogin ? 'Войти в CreateKids' : 'Создать семейный аккаунт';
  authSubmit.textContent = isLogin ? 'Войти' : 'Создать аккаунт';
  authPassword.autocomplete = isLogin ? 'current-password' : 'new-password';
  authDialog.querySelectorAll('[data-auth-mode]').forEach((button) => {
    button.setAttribute('aria-selected', String(button.dataset.authMode === mode));
  });
  authError.textContent = '';
}

function openAuth(mode = 'login') {
  setAuthMode(mode);
  if (!authDialog.open) authDialog.showModal();
  authDialog.querySelector('#auth-email').focus();
}

function updateAccountUI() {
  const signedIn = Boolean(currentUser);
  accountStatus.textContent = signedIn ? `● ${currentUser.email}` : '● Локальный режим';
  accountStatus.classList.toggle('is-online', signedIn);
  authOpen.hidden = signedIn;
  logoutButton.hidden = !signedIn;
  galleryAuthCta.hidden = signedIn;
  galleryLayout.hidden = !signedIn;
  resultAuthNote.hidden = signedIn;
  resultSubmit.textContent = signedIn ? 'Сохранить работу' : 'Войти и сохранить';
  saveStatus.textContent = signedIn ? 'Сохраняется в аккаунте' : 'Сохраняется на устройстве';
  if (!signedIn) {
    myResults.replaceChildren();
    galleryResults.replaceChildren();
  }
}

async function activateAccount(user) {
  const localState = state;
  const remoteState = parseSavedState(JSON.stringify(await api.getProgress()));
  if (!hasProgress(remoteState) && hasProgress(localState)) {
    state = parseSavedState(JSON.stringify(await api.saveProgress(localState)));
  } else {
    state = remoteState;
  }
  currentUser = user;
  localStorage.removeItem(STORAGE_KEY);
  activeWeekId = getCurrentWeek(state.completed)?.id ?? 12;
  renderProgress();
  renderProgram();
  updateAccountUI();
  await loadResults();
}

function makeEmptyState(message) {
  const empty = document.createElement('p');
  empty.className = 'gallery-empty';
  empty.textContent = message;
  return empty;
}

function makeResultCard(result, { own = false } = {}) {
  const week = getWeekById(result.weekId);
  const card = document.createElement('article');
  card.className = 'result-card';

  const image = document.createElement('img');
  image.src = result.imageUrl;
  image.alt = `Результат задания недели ${result.weekId}`;
  image.loading = 'lazy';

  const body = document.createElement('div');
  body.className = 'result-card-body';
  const meta = document.createElement('p');
  meta.className = 'result-card-meta';
  meta.textContent = `Неделя ${String(result.weekId).padStart(2, '0')} · ${audienceCardLabels[result.audience] ?? 'Семья'}`;
  const title = document.createElement('h4');
  title.textContent = week?.title ?? `Неделя ${result.weekId}`;
  const description = document.createElement('p');
  description.className = 'result-card-description';
  description.textContent = result.description;
  body.append(meta, title, description);

  if (result.feeling || result.nextIdea) {
    const details = document.createElement('div');
    details.className = 'result-card-details';
    if (result.feeling) {
      const feeling = document.createElement('span');
      feeling.textContent = result.feeling;
      details.append(feeling);
    }
    if (result.nextIdea) {
      const next = document.createElement('p');
      next.textContent = `Следующая версия: ${result.nextIdea}`;
      details.append(next);
    }
    body.append(details);
  }

  if (own) {
    const actions = document.createElement('div');
    actions.className = 'result-card-actions';
    const visibility = document.createElement('span');
    visibility.className = `visibility-state${result.isPublished ? ' is-published' : ''}`;
    visibility.textContent = result.isPublished ? 'В галерее' : 'Приватно';
    const publish = document.createElement('button');
    publish.type = 'button';
    publish.className = 'card-action';
    publish.dataset.publishId = result.id;
    publish.dataset.nextPublished = String(!result.isPublished);
    publish.textContent = result.isPublished ? 'Скрыть' : 'Опубликовать';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'card-action card-action-danger';
    remove.dataset.deleteId = result.id;
    remove.textContent = 'Удалить';
    actions.append(visibility, publish, remove);
    body.append(actions);
  } else {
    const anonymous = document.createElement('p');
    anonymous.className = 'anonymous-label';
    anonymous.textContent = 'Опубликовано анонимно';
    body.append(anonymous);
  }

  card.append(image, body);
  return card;
}

function renderResultList(container, results, options) {
  container.replaceChildren();
  if (!results.length) {
    container.append(makeEmptyState(options.own
      ? 'Пока нет сохранённых работ. Откройте неделю и добавьте первую версию.'
      : 'Пока никто не опубликовал работу. Ваша может стать первой.'));
    return;
  }
  results.forEach((result) => container.append(makeResultCard(result, options)));
}

async function loadResults() {
  if (!currentUser) return;
  myResults.replaceChildren(makeEmptyState('Загружаем ваши работы…'));
  galleryResults.replaceChildren(makeEmptyState('Загружаем галерею…'));
  try {
    const [own, gallery] = await Promise.all([api.getResults(), api.getGallery()]);
    renderResultList(myResults, own, { own: true });
    renderResultList(galleryResults, gallery, { own: false });
  } catch (error) {
    const message = errorMessage(error);
    myResults.replaceChildren(makeEmptyState(message));
    galleryResults.replaceChildren(makeEmptyState(message));
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result), { once: true });
    reader.addEventListener('error', () => reject(new Error('file_read_failed')), { once: true });
    reader.readAsDataURL(file);
  });
}

function updatePhotoPreview() {
  if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  photoPreviewUrl = '';
  photoPreview.replaceChildren();
  const [file] = resultPhoto.files;
  if (!file) {
    photoPreview.hidden = true;
    return;
  }
  photoPreviewUrl = URL.createObjectURL(file);
  const image = document.createElement('img');
  image.src = photoPreviewUrl;
  image.alt = 'Предпросмотр выбранной фотографии';
  photoPreview.append(image);
  photoPreview.hidden = false;
}

async function submitResult(event) {
  event.preventDefault();
  resultError.textContent = '';
  if (!currentUser) {
    resultError.textContent = 'Сначала войдите или создайте семейный аккаунт.';
    openAuth('register');
    return;
  }

  const [file] = resultPhoto.files;
  if (!file) {
    resultError.textContent = 'Добавьте фотографию результата.';
    return;
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    resultError.textContent = 'Поддерживаются PNG, JPEG и WebP.';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    resultError.textContent = 'Файл больше 5 МБ. Выберите фотографию меньшего размера.';
    return;
  }

  resultSubmit.disabled = true;
  resultSubmit.textContent = 'Сохраняем…';
  try {
    const data = new FormData(resultForm);
    await api.createResult({
      weekId: activeWeekId,
      audience: data.get('audience'),
      description: data.get('description'),
      feeling: data.get('feeling'),
      nextIdea: data.get('nextIdea'),
      imageDataUrl: await readFileAsDataUrl(file),
      isPublished: data.get('isPublished') === 'on'
    });
    resultForm.reset();
    resultAudience.value = activeAudience;
    updatePhotoPreview();
    await loadResults();
    dialog.close();
    document.querySelector('#gallery').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    resultError.textContent = errorMessage(error);
  } finally {
    resultSubmit.disabled = false;
    resultSubmit.textContent = 'Сохранить работу';
  }
}

async function submitAuth(event) {
  event.preventDefault();
  authError.textContent = '';
  authSubmit.disabled = true;
  const data = new FormData(authForm);
  const email = data.get('email');
  const password = data.get('password');
  try {
    const user = authMode === 'register'
      ? await api.register(email, password)
      : await api.login(email, password);
    await activateAccount(user);
    authForm.reset();
    authDialog.close();
  } catch (error) {
    authError.textContent = errorMessage(error);
  } finally {
    authSubmit.disabled = false;
    authSubmit.textContent = authMode === 'login' ? 'Войти' : 'Создать аккаунт';
  }
}

async function logout() {
  try {
    await api.logout();
  } catch {
    // The local session still needs to be cleared when the server is unavailable.
  }
  currentUser = null;
  state = createInitialState();
  activeWeekId = 1;
  window.clearTimeout(saveState.timer);
  renderProgress();
  renderProgram();
  updateAccountUI();
}

async function handleResultAction(event) {
  const publishButton = event.target.closest('[data-publish-id]');
  if (publishButton) {
    publishButton.disabled = true;
    try {
      await api.setResultPublished(publishButton.dataset.publishId, publishButton.dataset.nextPublished === 'true');
      await loadResults();
    } catch (error) {
      window.alert(errorMessage(error));
      publishButton.disabled = false;
    }
    return;
  }

  const deleteButton = event.target.closest('[data-delete-id]');
  if (!deleteButton || !window.confirm('Удалить эту работу и фотографию без возможности восстановления?')) return;
  deleteButton.disabled = true;
  try {
    await api.deleteResult(deleteButton.dataset.deleteId);
    await loadResults();
  } catch (error) {
    window.alert(errorMessage(error));
    deleteButton.disabled = false;
  }
}

async function hydrateSession() {
  try {
    const user = await api.getCurrentUser();
    await activateAccount(user);
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) {
      accountStatus.textContent = '● Сервер недоступен';
    }
    updateAccountUI();
  }
}

grid.addEventListener('click', (event) => {
  const card = event.target.closest('[data-week]');
  if (card) openWeek(card.dataset.week);
});

document.querySelectorAll('.filter-button').forEach((button) => {
  button.addEventListener('click', () => setFilter(button.dataset.filter));
});

document.querySelectorAll('#week-dialog [role="tab"]').forEach((tab) => {
  tab.addEventListener('click', () => {
    activeAudience = tab.dataset.audience;
    renderActivity();
  });
});

dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
  const slideOption = event.target.closest('.slide-dots [data-slide-index]');
  if (slideOption) renderWeekSlide(slideOption.dataset.slideIndex);
  const feeling = event.target.closest('[data-feeling]');
  if (feeling) updateFeeling(feeling.dataset.person, feeling.dataset.feeling);
});

dialog.addEventListener('input', (event) => {
  if (event.target.matches('[data-note]')) updateNote(event.target.dataset.note, event.target.value);
});

authDialog.querySelectorAll('[data-auth-mode]').forEach((button) => {
  button.addEventListener('click', () => setAuthMode(button.dataset.authMode));
});
authDialog.addEventListener('click', (event) => {
  if (event.target === authDialog) authDialog.close();
});

document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
document.querySelector('#slide-previous').addEventListener('click', () => renderWeekSlide(activeSlideIndex - 1));
document.querySelector('#slide-next').addEventListener('click', () => renderWeekSlide(activeSlideIndex + 1));
document.querySelector('#dialog-previous').addEventListener('click', () => openWeek(activeWeekId - 1));
document.querySelector('#dialog-next').addEventListener('click', () => openWeek(activeWeekId + 1));
document.querySelector('#auth-close').addEventListener('click', () => authDialog.close());
document.querySelector('#gallery-login').addEventListener('click', () => openAuth('register'));
completeButton.addEventListener('click', toggleActiveWeek);
currentWeekButton.addEventListener('click', () => openWeek(currentWeekButton.dataset.week));
document.querySelector('#hero-start').addEventListener('click', () => openWeek(getCurrentWeek(state.completed)?.id ?? 12));
document.querySelector('#closing-start').addEventListener('click', () => openWeek(getCurrentWeek(state.completed)?.id ?? 12));
document.querySelector('#reset-progress').addEventListener('click', resetAllData);
authOpen.addEventListener('click', () => openAuth('login'));
logoutButton.addEventListener('click', logout);
authForm.addEventListener('submit', submitAuth);
resultForm.addEventListener('submit', submitResult);
resultPhoto.addEventListener('change', updatePhotoPreview);
myResults.addEventListener('click', handleResultAction);

let slidePointerStartX = null;
const dialogSlide = document.querySelector('#dialog-slide');
dialogSlide.addEventListener('pointerdown', (event) => {
  slidePointerStartX = event.clientX;
});
dialogSlide.addEventListener('pointerup', (event) => {
  if (slidePointerStartX === null) return;
  const distance = event.clientX - slidePointerStartX;
  slidePointerStartX = null;
  if (Math.abs(distance) < 42) return;
  renderWeekSlide(activeSlideIndex + (distance < 0 ? 1 : -1));
});
dialogSlide.addEventListener('pointercancel', () => {
  slidePointerStartX = null;
});

renderProgress();
renderProgram();
updateAccountUI();
hydrateSession();
