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

let state = loadState();
let activeWeekId = getCurrentWeek(state.completed)?.id ?? 12;
let activeAudience = 'younger';
let activeFilter = 'all';

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

function loadState() {
  try {
    return parseSavedState(localStorage.getItem(STORAGE_KEY));
  } catch {
    return createInitialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  saveStatus.textContent = 'Сохранено на этом устройстве';
  window.clearTimeout(saveState.timer);
  saveState.timer = window.setTimeout(() => {
    saveStatus.textContent = 'Сохраняется на устройстве';
  }, 1800);
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

    const top = document.createElement('span');
    top.className = 'week-card-top';
    top.innerHTML = `<strong>${String(week.id).padStart(2, '0')}</strong><i aria-hidden="true">${week.icon}</i>`;

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
    card.append(top, body, status);
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
  dialog.querySelectorAll('[role="tab"]').forEach((tab) => {
    const selected = tab.dataset.audience === activeAudience;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
}

function openWeek(id) {
  const week = getWeekById(id);
  if (!week) return;
  activeWeekId = week.id;
  activeAudience = 'younger';

  dialog.className = `week-dialog dialog-${week.color}`;
  dialog.querySelector('#dialog-number').textContent = String(week.id).padStart(2, '0');
  dialog.querySelector('#dialog-label').textContent = `Неделя ${week.id} · ${week.short}`;
  dialog.querySelector('#dialog-title').textContent = week.title;
  dialog.querySelector('#dialog-skill').textContent = week.skill;
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

function resetAllData() {
  if (!window.confirm('Удалить прогресс и личные заметки с этого устройства?')) return;
  state = createInitialState();
  localStorage.removeItem(STORAGE_KEY);
  activeWeekId = 1;
  renderProgress();
  renderProgram();
}

grid.addEventListener('click', (event) => {
  const card = event.target.closest('[data-week]');
  if (card) openWeek(card.dataset.week);
});

document.querySelectorAll('.filter-button').forEach((button) => {
  button.addEventListener('click', () => setFilter(button.dataset.filter));
});

document.querySelectorAll('[role="tab"]').forEach((tab) => {
  tab.addEventListener('click', () => {
    activeAudience = tab.dataset.audience;
    renderActivity();
  });
});

dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
  const feeling = event.target.closest('[data-feeling]');
  if (feeling) updateFeeling(feeling.dataset.person, feeling.dataset.feeling);
});

dialog.addEventListener('input', (event) => {
  if (event.target.matches('[data-note]')) updateNote(event.target.dataset.note, event.target.value);
});

document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
document.querySelector('#dialog-previous').addEventListener('click', () => openWeek(activeWeekId - 1));
document.querySelector('#dialog-next').addEventListener('click', () => openWeek(activeWeekId + 1));
completeButton.addEventListener('click', toggleActiveWeek);
currentWeekButton.addEventListener('click', () => openWeek(currentWeekButton.dataset.week));
document.querySelector('#hero-start').addEventListener('click', () => openWeek(getCurrentWeek(state.completed)?.id ?? 12));
document.querySelector('#closing-start').addEventListener('click', () => openWeek(getCurrentWeek(state.completed)?.id ?? 12));
document.querySelector('#reset-progress').addEventListener('click', resetAllData);

renderProgress();
renderProgram();
