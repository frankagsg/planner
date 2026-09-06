import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOME_WIDGETS, defaultHomeLayout, normalizeHomeLayout, moveHomeWidget, resizeHomeColumns } from '../client/src/lib/homeLayout.ts';

test('old settings preserve the original three-column home layout', () => {
  assert.deepEqual(normalizeHomeLayout(undefined), defaultHomeLayout());
  assert.deepEqual(defaultHomeLayout().columns[0], ['clock', 'weather', 'countdowns']);
});
test('malformed settings cannot drop, duplicate, or invent widgets', () => {
  const value = normalizeHomeLayout({ version: 1, columns: [['clock', 'clock', '__proto__'], null], hidden: ['clock', 'clock', 'invalid'] });
  assert.equal(value.columns.length, 2);
  assert.deepEqual([...value.columns.flat()].sort(), Object.keys(HOME_WIDGETS).sort());
  assert.deepEqual(value.hidden, ['clock']);
});
test('moving between columns preserves every widget and visibility without mutating saved layout', () => {
  const original = defaultHomeLayout(); original.hidden = ['weather'];
  const moved = moveHomeWidget(original, 'clock', 1, 1);
  assert.deepEqual(moved.columns[1], ['today', 'clock', 'tasks', 'chores']);
  assert.equal(original.columns[0][0], 'clock');
  assert.deepEqual(moved.hidden, ['weather']);
  assert.equal(new Set(moved.columns.flat()).size, Object.keys(HOME_WIDGETS).length);
});
test('up/down movements and reducing columns retain order and hidden widgets', () => {
  const down = moveHomeWidget(defaultHomeLayout(), 'clock', 0, 1);
  assert.deepEqual(down.columns[0], ['weather', 'clock', 'countdowns']);
  assert.deepEqual(moveHomeWidget(down, 'clock', 0, 0), defaultHomeLayout());
  const compact = resizeHomeColumns(down, 1);
  assert.deepEqual(compact.columns[0], down.columns.flat());
  const expanded = resizeHomeColumns(compact, 3);
  assert.deepEqual(expanded.columns, [compact.columns[0], [], []]);
});
