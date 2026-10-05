import { normalizeCompletedWeeks, weeks } from './program.mjs';
import { defaultChildren, normalizeChildren } from './family.mjs';

export const interestSignals = [
  { id: 'chose', label: 'Выбрал сам', mapLabel: 'самостоятельный выбор', hint: 'Сам предложил идею, материал или способ работы.' },
  { id: 'stayed', label: 'Задержался', mapLabel: 'долгое внимание', hint: 'Продолжал дольше ожидаемого и сохранял внимание.' },
  { id: 'returned', label: 'Вернулся', mapLabel: 'возвращение без напоминания', hint: 'Позже снова продолжил работу без просьбы взрослого.' },
  { id: 'improved', label: 'Улучшил', mapLabel: 'развитие первой версии', hint: 'Переделал, уточнил или развил первую версию.' },
  { id: 'shared', label: 'Поделился', mapLabel: 'желание показать результат', hint: 'Сам захотел показать работу или рассказать о процессе.' }
];

export const interestDirections = [
  'Наблюдение и персонажи',
  'Визуальные образы',
  'Истории и слова',
  'Звук и ритм',
  'Конструирование',
  'Театр и движение',
  'Кино и анимация',
  'Цифровые проекты',
  'Смешение форм',
  'Дизайн для людей',
  'Авторский проект',
  'Показ и рефлексия'
];

const feelingScores = {
  'Хочу ещё': 4,
  'Хочу иначе': 3,
  'Достаточно': 1,
  'Пока не хочу': 0
};

function personObservation(state, weekId, person) {
  const value = state?.observations?.[String(weekId)]?.[person];
  return value && typeof value === 'object' ? value : {};
}

function normalizeSignals(value) {
  const allowed = new Set(interestSignals.map((signal) => signal.id));
  return Array.isArray(value)
    ? [...new Set(value.filter((signal) => allowed.has(signal)))]
    : [];
}

export function buildPersonInterestMap(state, person) {
  const signalCounts = Object.fromEntries(interestSignals.map((signal) => [signal.id, 0]));
  const directions = [];
  const notes = [];
  let observedWeeks = 0;

  for (const week of weeks) {
    const observation = personObservation(state, week.id, person);
    const note = typeof observation.note === 'string' ? observation.note.trim() : '';
    const feeling = typeof observation.feeling === 'string' ? observation.feeling : '';
    const signals = normalizeSignals(observation.signals);
    const hasEvidence = Boolean(note || feeling || signals.length);
    if (!hasEvidence) continue;

    observedWeeks += 1;
    signals.forEach((signal) => { signalCounts[signal] += 1; });
    const score = (feelingScores[feeling] ?? 0) + signals.length;
    directions.push({
      weekId: week.id,
      title: interestDirections[week.id - 1],
      score,
      feeling,
      signals
    });
    if (note) notes.push({ weekId: week.id, title: week.title, text: note, score });
  }

  directions.sort((a, b) => b.score - a.score || a.weekId - b.weekId);
  notes.sort((a, b) => b.score - a.score || b.weekId - a.weekId);

  return {
    person,
    observedWeeks,
    directions,
    topDirections: directions.filter((direction) => direction.score > 0).slice(0, 3),
    signalCounts,
    notes: notes.slice(0, 3)
  };
}

export function buildFamilyInterestMap(state, familyChildren = defaultChildren) {
  const completed = normalizeCompletedWeeks(state?.completed);
  const children = normalizeChildren(familyChildren);
  return {
    unlocked: completed.length === weeks.length,
    completed: completed.length,
    total: weeks.length,
    people: Object.fromEntries(children.map((child) => [
      child.id,
      { child, ...buildPersonInterestMap(state, child.id) }
    ]))
  };
}
