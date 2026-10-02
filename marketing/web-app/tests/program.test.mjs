import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCurrentWeek,
  getProgress,
  getWeekById,
  normalizeCompletedWeeks,
  toggleCompletedWeek,
  weeks
} from '../src/program.mjs';

test('getWeekById returns the requested week', () => {
  const week = getWeekById(4);
  assert.equal(week.id, 4);
  assert.equal(week.title, 'Ритм, звук и музыка');
});

test('program contains twelve complete weeks', () => {
  assert.equal(weeks.length, 12);
  for (const week of weeks) {
    assert.ok(week.title);
    assert.ok(week.skill);
    assert.ok(week.younger);
    assert.ok(week.teen);
    assert.ok(week.family);
    assert.ok(week.artifact);
    assert.ok(week.color);
  }
});

test('toggleCompletedWeek adds and removes a week without mutating input', () => {
  const initial = [1, 3];
  const added = toggleCompletedWeek(initial, 2);
  assert.deepEqual(added, [1, 2, 3]);
  assert.deepEqual(initial, [1, 3]);
  assert.deepEqual(toggleCompletedWeek(added, 2), [1, 3]);
});

test('getProgress returns completed count and percentage', () => {
  assert.deepEqual(getProgress([1, 2, 3]), { completed: 3, total: 12, percent: 25 });
});

test('normalizeCompletedWeeks keeps only unique valid week ids', () => {
  assert.deepEqual(normalizeCompletedWeeks([3, '2', 3, 99, 'bad']), [2, 3]);
  assert.deepEqual(normalizeCompletedWeeks(null), []);
});

test('getCurrentWeek returns the first unfinished week', () => {
  assert.equal(getCurrentWeek([1, 2, 3]).id, 4);
  assert.equal(getCurrentWeek(weeks.map((week) => week.id)), null);
});
