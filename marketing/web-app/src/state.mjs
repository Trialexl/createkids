import { normalizeCompletedWeeks } from './program.mjs';

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
      observations: value?.observations && typeof value.observations === 'object'
        ? value.observations
        : {}
    };
  } catch {
    return createInitialState();
  }
}

export function updateObservation(state, weekId, person, changes) {
  const key = String(Number(weekId));
  const previousWeek = state.observations[key] ?? {};
  const previousPerson = previousWeek[person] ?? { note: '', feeling: '' };
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
