import { ApiError, createApiClient } from './api.mjs';
import {
  getAssignmentForAge,
  getCurrentWeek,
  getProgress,
  getWeekById,
  toggleCompletedWeek,
  weeks
} from './program.mjs';
import { defaultChildren, normalizeChildren } from './family.mjs';
import { buildFamilyInterestMap, interestSignals } from './interest-map.mjs';
import {
  createInitialState,
  parseSavedState,
  toggleObservationSignal,
  updateObservation
} from './state.mjs';

const STORAGE_KEY = 'createkids-family-lab-v1';
const feelings = ['Хочу ещё', 'Достаточно', 'Хочу иначе', 'Пока не хочу'];
const adultMethodTips = {
  junior: [
    'Предлагайте два-три понятных варианта материалов, но окончательный выбор оставляйте ребёнку.',
    'Останавливайтесь, когда энергия закончилась: короткая самостоятельная попытка ценнее завершения под давлением.'
  ],
  senior: [
    'Сначала уточните, какая помощь действительно нужна: техническая, организационная или просто внимание.',
    'Не публикуйте и не показывайте работу без отдельного согласия автора, даже внутри семьи.'
  ],
  family: [
    'Участвуйте на равных: добавляйте свою часть, не превращаясь в руководителя общей работы.',
    'Сохраняйте отдельное авторство и не просите старшего ребёнка постоянно обучать младшего.'
  ]
};
const api = createApiClient();

let state = loadState();
let currentUser = null;
let authMode = 'login';
let activeWeekId = getCurrentWeek(state.completed)?.id ?? 12;
let activeAudience = defaultChildren[0].id;
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
const currentWeekLabel = currentWeekButton.querySelector('small');
const interestMapSection = document.querySelector('#interest-map');
const interestMapLock = document.querySelector('#interest-map-lock');
const interestMapPeople = document.querySelector('#interest-map-people');
const completeButton = document.querySelector('#complete-week');
const saveStatus = document.querySelector('#save-status');
const authDialog = document.querySelector('#auth-dialog');
const authForm = document.querySelector('#auth-form');
const authError = document.querySelector('#auth-error');
const authPassword = document.querySelector('#auth-password');
const authSubmit = document.querySelector('#auth-submit');
const authChildren = document.querySelector('#auth-children');
const authAddChild = document.querySelector('#auth-add-child');
const authChildFields = document.querySelector('#auth-child-fields');
const profileDialog = document.querySelector('#profile-dialog');
const profileForm = document.querySelector('#profile-form');
const profileOpen = document.querySelector('#profile-open');
const profileEmail = document.querySelector('#profile-email');
const profileAddChild = document.querySelector('#profile-add-child');
const profileChildFields = document.querySelector('#profile-child-fields');
const profileError = document.querySelector('#profile-error');
const profileSubmit = document.querySelector('#profile-submit');
const accountStatus = document.querySelector('#account-status');
const authOpen = document.querySelector('#auth-open');
const logoutButton = document.querySelector('#logout-button');
const galleryAuthCta = document.querySelector('#gallery-auth-cta');
const galleryLayout = document.querySelector('#gallery-layout');
const myResults = document.querySelector('#my-results');
const galleryResults = document.querySelector('#gallery-results');
const resultForm = document.querySelector('#result-form');
const resultPhoto = document.querySelector('#result-photo');
const resultDescription = document.querySelector('#result-description');
const resultContext = document.querySelector('#result-context');
const resultError = document.querySelector('#result-error');
const resultSubmit = document.querySelector('#result-submit');
const resultAuthNote = document.querySelector('#result-auth-note');
const photoPreview = document.querySelector('#photo-preview');
const filePickerName = document.querySelector('#file-picker-name');
const filePickerMeta = document.querySelector('#file-picker-meta');
const audienceTabs = document.querySelector('#audience-tabs');
const observationGrid = document.querySelector('#observation-grid');
const adultGuideDialog = document.querySelector('#adult-guide-dialog');
const adultGuideOpen = document.querySelector('#adult-guide-open');

function familyChildren() {
  return normalizeChildren(currentUser?.children ?? defaultChildren);
}

function findChild(id) {
  return familyChildren().find((child) => child.id === id) ?? null;
}

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
    saveStatus.textContent = 'Заметка сохранена на этом устройстве';
    saveState.timer = window.setTimeout(() => {
      saveStatus.textContent = 'Заметка сохраняется на устройстве';
    }, 1800);
    return;
  }

  const accountEmail = currentUser.email;
  saveStatus.textContent = 'Сохраняем заметку…';
  saveState.timer = window.setTimeout(async () => {
    if (currentUser?.email !== accountEmail) return;
    try {
      await api.saveProgress(state);
      saveStatus.textContent = 'Заметка сохранена в аккаунте';
    } catch {
      saveStatus.textContent = 'Не удалось сохранить заметку — повторите изменение';
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
    currentWeekButton.dataset.destination = 'week';
    currentWeekLabel.textContent = 'Следующая остановка';
    currentWeekIndex.textContent = String(current.id).padStart(2, '0');
    currentWeekTitle.textContent = current.title;
  } else {
    currentWeekButton.disabled = false;
    currentWeekButton.dataset.destination = 'map';
    currentWeekLabel.textContent = 'Итог программы';
    currentWeekIndex.textContent = '✦';
    currentWeekTitle.textContent = 'Карта интересов готова';
  }
  renderInterestMap();
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

function makeMapDirection(direction, maximumScore) {
  const item = document.createElement('li');
  const heading = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = direction.title;
  const week = document.createElement('span');
  week.textContent = `Неделя ${String(direction.weekId).padStart(2, '0')}`;
  heading.append(title, week);

  const track = document.createElement('span');
  track.className = 'map-direction-track';
  const fill = document.createElement('i');
  fill.style.width = `${Math.max(12, Math.round((direction.score / maximumScore) * 100))}%`;
  track.append(fill);
  item.append(heading, track);
  return item;
}

function makePersonInterestMap(personMap, child, childIndex) {
  const colors = ['coral', 'sky', 'lime'];
  const labels = {
    name: child.name,
    color: colors[childIndex % colors.length],
    index: String(childIndex + 1).padStart(2, '0')
  };
  const card = document.createElement('article');
  card.className = `person-interest-map map-${labels.color}`;

  const header = document.createElement('header');
  const index = document.createElement('span');
  index.textContent = labels.index;
  const heading = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = labels.name;
  const summary = document.createElement('p');
  summary.textContent = personMap.observedWeeks
    ? `Наблюдения заполнены в ${personMap.observedWeeks} из 12 недель`
    : 'Пока нет личных наблюдений';
  heading.append(title, summary);
  header.append(index, heading);
  card.append(header);

  if (!personMap.topDirections.length) {
    const empty = document.createElement('div');
    empty.className = 'map-person-empty';
    empty.innerHTML = '<strong>Карта открыта, но данных пока мало</strong><p>Вернитесь к неделям и отметьте, что ребёнок выбрал сам, к чему вернулся и что захотел продолжить.</p>';
    card.append(empty);
    return card;
  }

  const directions = document.createElement('section');
  const directionsTitle = document.createElement('h4');
  directionsTitle.textContent = 'К чему тянется';
  const directionList = document.createElement('ol');
  directionList.className = 'map-direction-list';
  const maximumScore = Math.max(...personMap.topDirections.map((direction) => direction.score), 1);
  personMap.topDirections.forEach((direction) => directionList.append(makeMapDirection(direction, maximumScore)));
  directions.append(directionsTitle, directionList);

  const signals = document.createElement('section');
  const signalsTitle = document.createElement('h4');
  signalsTitle.textContent = 'Повторяющиеся сигналы';
  const signalGrid = document.createElement('div');
  signalGrid.className = 'map-signal-grid';
  interestSignals.forEach((signal) => {
    const item = document.createElement('span');
    const count = document.createElement('strong');
    count.textContent = String(personMap.signalCounts[signal.id]);
    const label = document.createElement('small');
    label.textContent = signal.mapLabel;
    item.append(count, label);
    signalGrid.append(item);
  });
  signals.append(signalsTitle, signalGrid);
  card.append(directions, signals);

  if (personMap.notes.length) {
    const notes = document.createElement('section');
    notes.className = 'map-notes';
    const notesTitle = document.createElement('h4');
    notesTitle.textContent = 'Что заметила семья';
    notes.append(notesTitle);
    personMap.notes.forEach((note) => {
      const quote = document.createElement('blockquote');
      const text = document.createElement('p');
      text.textContent = note.text;
      const source = document.createElement('cite');
      source.textContent = `Неделя ${note.weekId} · ${note.title}`;
      quote.append(text, source);
      notes.append(quote);
    });
    card.append(notes);
  }
  return card;
}

function renderInterestMap() {
  const children = familyChildren();
  const map = buildFamilyInterestMap(state, children);
  interestMapLock.hidden = map.unlocked;
  interestMapPeople.hidden = !map.unlocked;

  if (!map.unlocked) {
    interestMapPeople.replaceChildren();
    const number = document.createElement('strong');
    number.textContent = `${map.completed}/${map.total}`;
    const copy = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = 'Карта собирается по ходу программы';
    const description = document.createElement('p');
    const remaining = map.total - map.completed;
    const remainder100 = remaining % 100;
    const remainder10 = remaining % 10;
    const weekWord = remainder100 >= 11 && remainder100 <= 14
      ? 'недель'
      : remainder10 === 1
        ? 'неделю'
        : remainder10 >= 2 && remainder10 <= 4
          ? 'недели'
          : 'недель';
    description.textContent = `Осталось исследовать ${remaining} ${weekWord}. Заполняйте короткие наблюдения — карта откроется после двенадцатой.`;
    const track = document.createElement('span');
    track.className = 'interest-map-progress';
    const fill = document.createElement('i');
    fill.style.width = `${Math.round((map.completed / map.total) * 100)}%`;
    track.append(fill);
    copy.append(title, description, track);
    interestMapLock.replaceChildren(number, copy);
    return;
  }

  interestMapLock.replaceChildren();
  interestMapPeople.replaceChildren(...children.map((child, index) => (
    makePersonInterestMap(map.people[child.id], child, index)
  )));
}

function openInterestMap() {
  if (dialog.open) dialog.close();
  interestMapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openNextStep() {
  const current = getCurrentWeek(state.completed);
  if (current) openWeek(current.id);
  else openInterestMap();
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

function renderSignals(person) {
  const container = dialog.querySelector(`[data-signals="${person}"]`);
  const selected = new Set(state.observations[String(activeWeekId)]?.[person]?.signals ?? []);
  container.replaceChildren();
  for (const signal of interestSignals) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `signal-chip${selected.has(signal.id) ? ' is-selected' : ''}`;
    button.textContent = signal.label;
    button.dataset.person = person;
    button.dataset.signal = signal.id;
    button.dataset.hint = signal.hint;
    button.setAttribute('aria-label', `${signal.label}. ${signal.hint}`);
    button.setAttribute('aria-pressed', String(selected.has(signal.id)));
    container.append(button);
  }
}

function makeObservationCard(child, index) {
  const dotColors = ['coral-dot', 'sky-dot', 'lime-dot'];
  const card = document.createElement('article');
  card.className = 'observation-card';
  card.dataset.personCard = child.id;

  const heading = document.createElement('h4');
  const dot = document.createElement('span');
  dot.className = `person-dot ${dotColors[index % dotColors.length]}`;
  heading.append(dot, child.name);

  const noteId = `note-${child.id}`;
  const label = document.createElement('label');
  label.htmlFor = noteId;
  label.textContent = 'Наблюдение без оценки';
  const textarea = document.createElement('textarea');
  textarea.id = noteId;
  textarea.dataset.note = child.id;
  textarea.rows = 3;
  textarea.placeholder = 'Например: сам предложил вторую версию…';

  const feelingLabel = document.createElement('span');
  feelingLabel.className = 'field-label';
  feelingLabel.textContent = 'Хочется ли повторить?';
  const feelingList = document.createElement('div');
  feelingList.className = 'feeling-list';
  feelingList.dataset.feelings = child.id;

  const signalLabel = document.createElement('span');
  signalLabel.className = 'field-label';
  signalLabel.textContent = 'Что случилось в процессе?';
  const signalList = document.createElement('div');
  signalList.className = 'signal-list';
  signalList.dataset.signals = child.id;

  card.append(heading, label, textarea, feelingLabel, feelingList, signalLabel, signalList);
  return card;
}

function renderObservations() {
  const weekState = state.observations[String(activeWeekId)] ?? {};
  const children = familyChildren();
  const child = findChild(activeAudience);
  const subject = activeAudience === 'family'
    ? { id: 'family', name: 'Вся семья' }
    : child;
  if (!subject) return;
  const subjectIndex = activeAudience === 'family'
    ? children.length
    : children.findIndex((item) => item.id === subject.id);
  dialog.querySelector('#observation-title').textContent = activeAudience === 'family'
    ? 'Что вы заметили в совместной работе?'
    : `Что вы заметили: ${subject.name}?`;
  observationGrid.replaceChildren(makeObservationCard(subject, subjectIndex));
  const textarea = dialog.querySelector(`[data-note="${subject.id}"]`);
  textarea.value = weekState[subject.id]?.note ?? '';
  renderFeelings(subject.id);
  renderSignals(subject.id);
}

function renderAudienceControls() {
  const children = familyChildren();
  if (activeAudience !== 'family' && !children.some((child) => child.id === activeAudience)) {
    activeAudience = children[0].id;
  }

  const tabs = children.map((child) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.dataset.audience = child.id;
    button.textContent = child.name;
    return button;
  });
  const familyTab = document.createElement('button');
  familyTab.type = 'button';
  familyTab.role = 'tab';
  familyTab.dataset.audience = 'family';
  familyTab.textContent = 'Вместе';
  audienceTabs.replaceChildren(...tabs, familyTab);
}

function renderActivity() {
  const week = getWeekById(activeWeekId);
  const child = findChild(activeAudience);
  let guideType = 'family';
  let guideTitle = 'Как быть участником, а не руководителем';
  if (activeAudience === 'family') {
    dialog.querySelector('#activity-kicker').textContent = 'Совместная лаборатория';
    dialog.querySelector('#activity-text').textContent = week.family;
    resultContext.textContent = 'Результат всей семьи · останется приватным, пока вы сами его не опубликуете.';
  } else if (child) {
    const assignment = getAssignmentForAge(week, child.age);
    guideType = assignment.id;
    guideTitle = `Советы к выбранному заданию · ${child.name}`;
    dialog.querySelector('#activity-kicker').textContent = `${child.name} · задание ${assignment.label}`;
    dialog.querySelector('#activity-text').textContent = assignment.text;
    resultContext.textContent = `Результат: ${child.name} · останется приватным, пока вы сами его не опубликуете.`;
  }
  dialog.querySelector('#activity-tip').textContent = week.tip;
  adultGuideDialog.querySelector('#adult-guide-title').textContent = guideTitle;
  adultGuideDialog.querySelector('#adult-guide-lead').textContent = week.tip;
  const guideList = adultGuideDialog.querySelector('#activity-guide-list');
  guideList.replaceChildren(...[...week.guide, ...adultMethodTips[guideType]].map((tip) => {
    const item = document.createElement('li');
    item.textContent = tip;
    return item;
  }));
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
  activeAudience = familyChildren()[0].id;
  activeSlideIndex = 0;
  resultError.textContent = '';

  dialog.className = `week-dialog dialog-${week.color}`;
  dialog.querySelector('#dialog-number').textContent = String(week.id).padStart(2, '0');
  dialog.querySelector('#dialog-label').textContent = `Неделя ${week.id} · ${week.short}`;
  dialog.querySelector('#dialog-title').textContent = week.title;
  dialog.querySelector('#dialog-skill').textContent = week.skill;
  renderWeekSlide();
  dialog.querySelector('#activity-artifact').textContent = week.artifact;
  dialog.querySelector('#dialog-previous').disabled = week.id === 1;
  dialog.querySelector('#dialog-next').disabled = week.id === 12;
  completeButton.textContent = state.completed.includes(week.id)
    ? 'Вернуть в программу'
    : 'Отметить как исследованную';
  completeButton.classList.toggle('is-completed', state.completed.includes(week.id));

  renderAudienceControls();
  renderActivity();
  renderObservations();
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  dialog.querySelector('#dialog-close').focus({ preventScroll: true });
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

function updateSignal(person, signal) {
  state = toggleObservationSignal(state, activeWeekId, person, signal);
  saveState();
  renderSignals(person);
}

function toggleActiveWeek() {
  const wasComplete = state.completed.length === weeks.length;
  state = {
    ...state,
    completed: toggleCompletedWeek(state.completed, activeWeekId)
  };
  saveState();
  renderProgress();
  renderProgram();
  if (!wasComplete && state.completed.length === weeks.length) {
    openInterestMap();
  } else {
    openWeek(activeWeekId);
  }
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
  saveStatus.textContent = currentUser ? 'Заметка сохранена в аккаунте' : 'Заметка сохраняется на устройстве';
}

function errorMessage(error) {
  const messages = {
    invalid_credentials: 'Неверный email или пароль.',
    email_exists: 'Аккаунт с таким email уже существует.',
    invalid_email: 'Проверьте адрес электронной почты.',
    weak_password: 'Пароль должен содержать от 10 до 128 символов.',
    invalid_children: 'Добавьте хотя бы одного ребёнка и укажите возраст от 5 до 17 лет.',
    image_too_large: 'Файл больше 5 МБ. Выберите фотографию меньшего размера.',
    invalid_image: 'Поддерживаются PNG, JPEG и WebP.',
    invalid_result: 'Проверьте описание и выбранное задание.',
    auth_required: 'Войдите в семейный аккаунт.'
  };
  if (error instanceof ApiError) return messages[error.code] ?? 'Не удалось выполнить действие. Попробуйте ещё раз.';
  return 'Нет связи с сервером. Проверьте, что приложение запущено.';
}

function childDrafts(container) {
  return [...container.querySelectorAll('.auth-child-field')].map((row) => ({
    id: row.querySelector('[name="childId"]')?.value ?? '',
    name: row.querySelector('[name="childName"]')?.value ?? '',
    age: row.querySelector('[name="childAge"]')?.value ?? ''
  }));
}

function makeChildField(child, index, { includeId = false } = {}) {
  const row = document.createElement('div');
  row.className = 'auth-child-field';

  if (includeId) {
    const idInput = document.createElement('input');
    idInput.type = 'hidden';
    idInput.name = 'childId';
    idInput.value = child?.id ?? '';
    row.append(idInput);
  }

  const marker = document.createElement('span');
  marker.className = 'auth-child-index';
  marker.textContent = String(index + 1).padStart(2, '0');

  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Имя или псевдоним';
  const nameInput = document.createElement('input');
  nameInput.name = 'childName';
  nameInput.type = 'text';
  nameInput.maxLength = 40;
  nameInput.required = true;
  nameInput.autocomplete = 'off';
  nameInput.placeholder = `Ребёнок ${index + 1}`;
  nameInput.value = child?.name ?? '';
  nameLabel.append(nameInput);

  const ageLabel = document.createElement('label');
  ageLabel.textContent = 'Возраст';
  const ageInput = document.createElement('input');
  ageInput.name = 'childAge';
  ageInput.type = 'number';
  ageInput.min = '5';
  ageInput.max = '17';
  ageInput.required = true;
  ageInput.inputMode = 'numeric';
  ageInput.value = child?.age ?? '';
  ageLabel.append(ageInput);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'child-remove-button';
  remove.dataset.removeChild = '';
  remove.setAttribute('aria-label', `Убрать ребёнка ${index + 1}`);
  remove.textContent = '×';

  row.append(marker, nameLabel, ageLabel, remove);
  return row;
}

function renderChildFields(container, children, options) {
  const values = children.length ? children : [{}];
  container.replaceChildren(...values.map((child, index) => makeChildField(child, index, options)));
  container.querySelectorAll('[data-remove-child]').forEach((button) => {
    button.disabled = values.length === 1;
  });
}

function renderRegistrationChildren(children = childDrafts(authChildFields)) {
  renderChildFields(authChildFields, children, { includeId: false });
}

function renderProfileChildren(children = childDrafts(profileChildFields)) {
  renderChildFields(profileChildFields, children, { includeId: true });
}

function appendChild(container, options) {
  renderChildFields(container, [...childDrafts(container), {}], options);
  container.querySelector('.auth-child-field:last-child [name="childName"]')?.focus();
}

function removeChild(event, container, options) {
  const button = event.target.closest('[data-remove-child]');
  if (!button) return;
  const rows = [...container.querySelectorAll('.auth-child-field')];
  if (rows.length === 1) return;
  const removeIndex = rows.indexOf(button.closest('.auth-child-field'));
  renderChildFields(container, childDrafts(container).filter((_child, index) => index !== removeIndex), options);
}

function setAuthMode(mode) {
  authMode = mode;
  const isLogin = mode === 'login';
  authDialog.querySelector('#auth-title').textContent = isLogin ? 'Войти в CreateKids' : 'Создать семейный аккаунт';
  authSubmit.textContent = isLogin ? 'Войти' : 'Создать аккаунт';
  authPassword.autocomplete = isLogin ? 'current-password' : 'new-password';
  authChildren.hidden = isLogin;
  authChildren.querySelectorAll('input, button').forEach((input) => { input.disabled = isLogin; });
  if (!isLogin) renderRegistrationChildren();
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

function openProfile() {
  if (!currentUser) return;
  profileError.textContent = '';
  profileEmail.value = currentUser.email;
  renderProfileChildren(currentUser.children);
  if (!profileDialog.open) profileDialog.showModal();
  profileEmail.focus();
}

function updateAccountUI() {
  const signedIn = Boolean(currentUser);
  accountStatus.textContent = signedIn ? `● ${currentUser.email}` : '● Локальный режим';
  accountStatus.classList.toggle('is-online', signedIn);
  authOpen.hidden = signedIn;
  profileOpen.hidden = !signedIn;
  logoutButton.hidden = !signedIn;
  galleryAuthCta.hidden = signedIn;
  galleryLayout.hidden = !signedIn;
  resultAuthNote.hidden = signedIn;
  resultSubmit.textContent = signedIn ? 'Сохранить работу' : 'Войти и сохранить';
  saveStatus.textContent = signedIn ? 'Заметка сохраняется в аккаунте' : 'Заметка сохраняется на устройстве';
  if (!signedIn) {
    myResults.replaceChildren();
    galleryResults.replaceChildren();
  }
}

async function activateAccount(user) {
  currentUser = user;
  const children = familyChildren();
  const remappedObservations = {};
  const legacyTargets = { younger: children[0]?.id, teen: children[1]?.id };
  for (const [weekId, weekValue] of Object.entries(state.observations)) {
    const people = {};
    for (const [person, observation] of Object.entries(weekValue)) {
      const target = legacyTargets[person] ?? person;
      if (target === 'family' || children.some((child) => child.id === target)) people[target] = observation;
    }
    if (Object.keys(people).length) remappedObservations[weekId] = people;
  }
  const localState = { ...state, observations: remappedObservations };
  const remoteState = parseSavedState(JSON.stringify(await api.getProgress()));
  if (!hasProgress(remoteState) && hasProgress(localState)) {
    state = parseSavedState(JSON.stringify(await api.saveProgress(localState)));
  } else {
    state = remoteState;
  }
  localStorage.removeItem(STORAGE_KEY);
  activeWeekId = getCurrentWeek(state.completed)?.id ?? 12;
  activeAudience = children[0].id;
  renderAudienceControls();
  renderProgress();
  renderProgram();
  updateAccountUI();
  if (dialog.open) {
    renderActivity();
    renderObservations();
  }
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
  meta.textContent = `Неделя ${String(result.weekId).padStart(2, '0')} · ${result.audienceLabel ?? 'Семья'}`;
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
  resultPhoto.removeAttribute('aria-invalid');
  if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  photoPreviewUrl = '';
  photoPreview.replaceChildren();
  const [file] = resultPhoto.files;
  if (!file) {
    filePickerName.textContent = 'Добавить фотографию';
    filePickerMeta.textContent = 'PNG, JPEG или WebP · до 5 МБ';
    photoPreview.hidden = true;
    return;
  }
  filePickerName.textContent = file.name;
  filePickerMeta.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} МБ · нажмите, чтобы заменить`;
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
  resultPhoto.removeAttribute('aria-invalid');
  resultDescription.removeAttribute('aria-invalid');
  if (!currentUser) {
    resultError.textContent = 'Сначала войдите или создайте семейный аккаунт.';
    openAuth('register');
    return;
  }

  const [file] = resultPhoto.files;
  if (!file) {
    resultError.textContent = 'Добавьте фотографию результата.';
    resultPhoto.setAttribute('aria-invalid', 'true');
    resultPhoto.focus({ preventScroll: true });
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

  const data = new FormData(resultForm);
  if (!String(data.get('description') ?? '').trim()) {
    resultError.textContent = 'Коротко опишите, что получилось.';
    resultDescription.setAttribute('aria-invalid', 'true');
    resultDescription.focus();
    return;
  }

  resultSubmit.disabled = true;
  resultSubmit.textContent = 'Сохраняем…';
  try {
    const observation = state.observations[String(activeWeekId)]?.[activeAudience];
    await api.createResult({
      weekId: activeWeekId,
      audience: activeAudience,
      description: data.get('description'),
      feeling: observation?.feeling ?? '',
      nextIdea: data.get('nextIdea'),
      imageDataUrl: await readFileAsDataUrl(file),
      isPublished: data.get('isPublished') === 'on'
    });
    resultForm.reset();
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
  const names = data.getAll('childName');
  const ages = data.getAll('childAge');
  const children = names.map((name, index) => ({ name, age: Number(ages[index]) }));
  try {
    const user = authMode === 'register'
      ? await api.register(email, password, children)
      : await api.login(email, password);
    await activateAccount(user);
    authForm.reset();
    renderRegistrationChildren([{}]);
    authDialog.close();
  } catch (error) {
    authError.textContent = errorMessage(error);
  } finally {
    authSubmit.disabled = false;
    authSubmit.textContent = authMode === 'login' ? 'Войти' : 'Создать аккаунт';
  }
}

async function submitProfile(event) {
  event.preventDefault();
  profileError.textContent = '';
  profileSubmit.disabled = true;
  profileSubmit.textContent = 'Сохраняем…';
  const data = new FormData(profileForm);
  const ids = data.getAll('childId');
  const names = data.getAll('childName');
  const ages = data.getAll('childAge');
  const children = names.map((name, index) => ({
    id: ids[index],
    name,
    age: Number(ages[index])
  }));

  try {
    currentUser = await api.updateProfile(data.get('email'), children);
    const activeChildren = familyChildren();
    if (activeAudience !== 'family' && !activeChildren.some((child) => child.id === activeAudience)) {
      activeAudience = activeChildren[0].id;
    }
    renderAudienceControls();
    renderProgress();
    renderProgram();
    updateAccountUI();
    if (dialog.open) {
      renderActivity();
      renderObservations();
    }
    await loadResults();
    profileDialog.close();
  } catch (error) {
    profileError.textContent = errorMessage(error);
  } finally {
    profileSubmit.disabled = false;
    profileSubmit.textContent = 'Сохранить изменения';
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
  activeAudience = defaultChildren[0].id;
  window.clearTimeout(saveState.timer);
  if (profileDialog.open) profileDialog.close();
  renderAudienceControls();
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

audienceTabs.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-audience]');
  if (!tab) return;
  activeAudience = tab.dataset.audience;
  renderActivity();
  renderObservations();
});

audienceTabs.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...audienceTabs.querySelectorAll('[role="tab"]')];
  const currentIndex = tabs.indexOf(document.activeElement);
  if (currentIndex === -1) return;
  event.preventDefault();
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? tabs.length - 1
      : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[nextIndex].focus();
  tabs[nextIndex].click();
  tabs[nextIndex].scrollIntoView({ block: 'nearest', inline: 'nearest' });
});

dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
  const slideOption = event.target.closest('.slide-dots [data-slide-index]');
  if (slideOption) renderWeekSlide(slideOption.dataset.slideIndex);
  const feeling = event.target.closest('[data-feeling]');
  if (feeling) updateFeeling(feeling.dataset.person, feeling.dataset.feeling);
  const signal = event.target.closest('[data-signal]');
  if (signal) updateSignal(signal.dataset.person, signal.dataset.signal);
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
authAddChild.addEventListener('click', () => appendChild(authChildFields, { includeId: false }));
authChildFields.addEventListener('click', (event) => removeChild(event, authChildFields, { includeId: false }));
profileDialog.addEventListener('click', (event) => {
  if (event.target === profileDialog) profileDialog.close();
});
profileAddChild.addEventListener('click', () => appendChild(profileChildFields, { includeId: true }));
profileChildFields.addEventListener('click', (event) => removeChild(event, profileChildFields, { includeId: true }));

adultGuideOpen.addEventListener('click', () => {
  if (!adultGuideDialog.open) adultGuideDialog.showModal();
  adultGuideDialog.scrollTop = 0;
  adultGuideDialog.querySelector('#adult-guide-close').focus({ preventScroll: true });
});
adultGuideDialog.addEventListener('click', (event) => {
  if (event.target === adultGuideDialog) adultGuideDialog.close();
});

document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
document.querySelector('#slide-previous').addEventListener('click', () => renderWeekSlide(activeSlideIndex - 1));
document.querySelector('#slide-next').addEventListener('click', () => renderWeekSlide(activeSlideIndex + 1));
document.querySelector('#dialog-previous').addEventListener('click', () => openWeek(activeWeekId - 1));
document.querySelector('#dialog-next').addEventListener('click', () => openWeek(activeWeekId + 1));
document.querySelector('#auth-close').addEventListener('click', () => authDialog.close());
document.querySelector('#profile-close').addEventListener('click', () => profileDialog.close());
document.querySelector('#adult-guide-close').addEventListener('click', () => adultGuideDialog.close());
document.querySelector('#adult-guide-done').addEventListener('click', () => adultGuideDialog.close());
document.querySelector('#gallery-login').addEventListener('click', () => openAuth('register'));
completeButton.addEventListener('click', toggleActiveWeek);
currentWeekButton.addEventListener('click', () => {
  if (currentWeekButton.dataset.destination === 'map') openInterestMap();
  else openWeek(currentWeekButton.dataset.week);
});
document.querySelector('#hero-start').addEventListener('click', openNextStep);
document.querySelector('#closing-start').addEventListener('click', openNextStep);
document.querySelector('#reset-progress').addEventListener('click', resetAllData);
authOpen.addEventListener('click', () => openAuth('login'));
profileOpen.addEventListener('click', openProfile);
logoutButton.addEventListener('click', logout);
authForm.addEventListener('submit', submitAuth);
profileForm.addEventListener('submit', submitProfile);
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

renderAudienceControls();
renderRegistrationChildren();
renderProgress();
renderProgram();
updateAccountUI();
hydrateSession();
