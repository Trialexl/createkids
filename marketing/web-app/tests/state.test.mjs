import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  parseSavedState,
  toggleObservationSignal,
  updateObservation
} from '../src/state.mjs';

test('parseSavedState sanitizes completed weeks and survives malformed JSON', () => {
  assert.deepEqual(parseSavedState('{bad json'), createInitialState());
  const parsed = parseSavedState(JSON.stringify({ completed: [2, 2, 99], observations: {} }));
  assert.deepEqual(parsed.completed, [2]);
});

test('updateObservation saves a child note and feeling immutably', () => {
  const initial = createInitialState();
  const next = updateObservation(initial, 3, 'younger', {
    note: 'Сам придумал вторую концовку',
    feeling: 'Хочу ещё'
  });
  assert.equal(next.observations['3'].younger.note, 'Сам придумал вторую концовку');
  assert.equal(next.observations['3'].younger.feeling, 'Хочу ещё');
  assert.deepEqual(next.observations['3'].younger.signals, []);
  assert.deepEqual(initial.observations, {});
});

test('family activity can have its own observation', () => {
  const next = updateObservation(createInitialState(), 2, 'family', {
    note: 'Каждый добавил свою часть',
    feeling: 'Хочу ещё'
  });
  assert.equal(next.observations['2'].family.note, 'Каждый добавил свою часть');
});

test('toggleObservationSignal records and removes observable interest signals', () => {
  const selected = toggleObservationSignal(createInitialState(), 5, 'teen', 'returned');
  assert.deepEqual(selected.observations['5'].teen.signals, ['returned']);
  const removed = toggleObservationSignal(selected, 5, 'teen', 'returned');
  assert.deepEqual(removed.observations['5'].teen.signals, []);
  assert.equal(toggleObservationSignal(removed, 5, 'teen', 'unknown'), removed);
});

test('parseSavedState removes unsupported observation fields and signals', () => {
  const parsed = parseSavedState(JSON.stringify({
    completed: [1],
    observations: {
      1: { younger: { note: 'Вернулся сам', feeling: 'Хочу ещё', signals: ['returned', 'bad'] } },
      99: { teen: { note: 'Не должно сохраниться' } }
    }
  }));
  assert.deepEqual(parsed.observations, {
    1: { younger: { note: 'Вернулся сам', feeling: 'Хочу ещё', signals: ['returned'] } }
  });
});
