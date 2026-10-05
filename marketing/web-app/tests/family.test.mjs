import test from 'node:test';
import assert from 'node:assert/strict';
import { childAgeLabel, defaultChildren, normalizeChildren } from '../src/family.mjs';

test('family profile supports any number of children with stable ids', () => {
  const children = normalizeChildren([
    { id: 'child-a', name: 'Аня', age: 6 },
    { id: 'child-b', name: 'Боря', age: 11 },
    { id: 'child-c', name: 'Вера', age: 17 },
    { id: 'child-d', name: 'Глеб', age: 9 },
    { id: 'child-e', name: 'Даша', age: 13 }
  ]);
  assert.equal(children.length, 5);
  assert.deepEqual(children.map((child) => child.id), ['child-a', 'child-b', 'child-c', 'child-d', 'child-e']);
});

test('invalid family profiles fall back to the legacy two-child profile', () => {
  assert.deepEqual(normalizeChildren([]), defaultChildren);
  assert.deepEqual(normalizeChildren([{ id: 'child-a', name: 'Аня', age: 4 }]), defaultChildren);
  assert.equal(childAgeLabel(11), '11 лет');
});
