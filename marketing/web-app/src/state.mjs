import { normalizeCompletedWeeks } from './program.mjs';
import { interestSignals } from './interest-map.mjs';

const allowedFeelings = new Set(['Хочу ещё', 'Достаточно', 'Хочу иначе', 'Пока не хочу']);
const allowedSignals = new Set(interestSignals.map((signal) => signal.id));

function normalizePersonObservation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const note = typeof value.note === 'string' ? value.note : '';
  const feeling = allowedFeelings.has(value.feeling) ? value.feeling : '';
  const signals = Array.isArray(value.signals)
    ? [...new Set(value.signals.filter((signal) => allowedSignals.has(signal)))]
    : [];
  return { note, feeling, signals };
}

function normalizeObservations(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const observations = {};
  for (const [weekId, weekValue] of Object.entries(value)) {
    const id = Number(weekId);
    if (!Number.isInteger(id) || id < 1 || id > 12 || !weekValue || typeof weekValue !== 'object') continue;
    const people = {};
    for (const [person, personValue] of Object.entries(weekValue)) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(person)) continue;
      const observation = normalizePersonObservation(personValue);
      if (observation) people[person] = observation;
    }
    if (Object.keys(people).length) observations[String(id)] = people;
  }
  return observations;
}

export function createInitialState() {
  return {
    completed: [],
    observations: {}
  };
}

export function parseSavedState(raw) {
  if (!raw) return createInitialState();
  try {
    const value = JSON.parse(raw);
    return {
      completed: normalizeCompletedWeeks(value?.completed),
      observations: normalizeObservations(value?.observations)
    };
  } catch {
    return createInitialState();
  }
}

export function updateObservation(state, weekId, person, changes) {
  const key = String(Number(weekId));
  const previousWeek = state.observations[key] ?? {};
  const previousPerson = previousWeek[person] ?? { note: '', feeling: '', signals: [] };
  return {
    ...state,
    observations: {
      ...state.observations,
      [key]: {
        ...previousWeek,
        [person]: {
          ...previousPerson,
          ...changes
        }
      }
    }
  };
}

export function toggleObservationSignal(state, weekId, person, signal) {
  if (!allowedSignals.has(signal)) return state;
  const key = String(Number(weekId));
  const previousWeek = state.observations[key] ?? {};
  const previousPerson = previousWeek[person] ?? { note: '', feeling: '', signals: [] };
  const signals = new Set(previousPerson.signals ?? []);
  if (signals.has(signal)) signals.delete(signal);
  else signals.add(signal);
  return updateObservation(state, weekId, person, { signals: [...signals] });
}
