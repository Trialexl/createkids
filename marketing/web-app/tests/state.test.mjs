import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, parseSavedState, updateObservation } from '../src/state.mjs';

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
  assert.deepEqual(initial.observations, {});
});
