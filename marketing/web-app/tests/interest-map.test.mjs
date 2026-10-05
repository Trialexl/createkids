import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFamilyInterestMap, buildPersonInterestMap, interestSignals } from '../src/interest-map.mjs';
import { weeks } from '../src/program.mjs';

test('interest map stays locked until all twelve weeks are completed', () => {
  const locked = buildFamilyInterestMap({ completed: weeks.slice(0, 11).map((week) => week.id), observations: {} });
  assert.equal(locked.unlocked, false);
  assert.equal(locked.completed, 11);
  const unlocked = buildFamilyInterestMap({ completed: weeks.map((week) => week.id), observations: {} });
  assert.equal(unlocked.unlocked, true);
});

test('family map creates an independent map for every registered child', () => {
  const children = [
    { id: 'child-a', name: 'Аня', age: 6 },
    { id: 'child-b', name: 'Боря', age: 11 },
    { id: 'child-c', name: 'Вера', age: 17 }
  ];
  const map = buildFamilyInterestMap({ completed: [], observations: {} }, children);
  assert.deepEqual(Object.keys(map.people), ['child-a', 'child-b', 'child-c']);
  assert.equal(map.people['child-c'].child.name, 'Вера');
});

test('every observable signal has an accessible explanation', () => {
  assert.equal(interestSignals.length, 5);
  interestSignals.forEach((signal) => assert.ok(signal.hint.length > 20));
});

test('person map ranks directions using feelings and observable signals', () => {
  const map = buildPersonInterestMap({
    observations: {
      2: { younger: { note: 'Долго выбирал цвет', feeling: 'Достаточно', signals: ['stayed'] } },
      5: { younger: { note: 'Сам вернулся к мосту', feeling: 'Хочу ещё', signals: ['chose', 'returned', 'improved'] } },
      7: { younger: { note: '', feeling: 'Хочу иначе', signals: ['shared'] } }
    }
  }, 'younger');

  assert.equal(map.observedWeeks, 3);
  assert.equal(map.topDirections[0].title, 'Конструирование');
  assert.equal(map.signalCounts.returned, 1);
  assert.equal(map.signalCounts.shared, 1);
  assert.equal(map.notes[0].weekId, 5);
});
