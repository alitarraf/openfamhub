/* Fixture tests for reconcileList — the roster/per-member-list diff at the
 * heart of "does the frontend handle a family of any size". No Svelte, no
 * network: reconcileList is deliberately plain JS (see rosterReconcile.js)
 * so it's testable without a component-test harness.
 */
import assert from 'node:assert/strict';
import { reconcileList } from '../src/lib/rosterReconcile.js';

const empty = () => ({ points: 0, tasks: [] });

console.log('rosterReconcile');
let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

ok('grows a small list to a large roster (7 members), in roster order', () => {
  const list = [
    { id: 'dad', points: 5, tasks: ['x'] },
    { id: 'mom', points: 3, tasks: [] }
  ];
  const roster = ['parent1', 'parent2', 'kid1', 'kid2', 'kid3', 'kid4', 'kid5'];
  reconcileList(list, roster, empty);
  assert.deepEqual(
    list.map((x) => x.id),
    roster
  ); // exact roster order, not append order
  assert.deepEqual(list[2], { id: 'kid1', points: 0, tasks: [] }); // fresh empty entry
});

ok('preserves surviving entries and reorders to match the roster, even with partial id overlap', () => {
  // Regression: a transition where some old ids (e.g. bundled mock demo ids)
  // happen to overlap with the new live roster's ids must not leave survivors
  // stuck at their old position instead of the roster's actual order.
  const list = [
    { id: 'dad', points: 1, tasks: [] },
    { id: 'mom', points: 2, tasks: [] },
    { id: 'kid1', points: 10, tasks: ['make bed'] }, // survives, should move
    { id: 'kid2', points: 20, tasks: [] } // survives, should move
  ];
  const roster = ['parent1', 'parent2', 'kid1', 'kid2', 'kid3'];
  reconcileList(list, roster, empty);
  assert.deepEqual(
    list.map((x) => x.id),
    roster
  );
  // kid1's hydrated data is preserved by identity, not reset to empty
  assert.deepEqual(list.find((x) => x.id === 'kid1').tasks, ['make bed']);
  assert.equal(list.find((x) => x.id === 'kid1').points, 10);
  // dad/mom (no longer in the roster) are gone
  assert.ok(!list.some((x) => x.id === 'dad' || x.id === 'mom'));
});

ok('shrinks when the roster shrinks (e.g. a member removed from config)', () => {
  const list = [
    { id: 'a', points: 1, tasks: [] },
    { id: 'b', points: 2, tasks: [] },
    { id: 'c', points: 3, tasks: [] }
  ];
  reconcileList(list, ['a', 'c'], empty);
  assert.deepEqual(
    list.map((x) => x.id),
    ['a', 'c']
  );
});

ok('mutates the same array reference (Svelte $state reactivity relies on this)', () => {
  const list = [{ id: 'a', points: 1, tasks: [] }];
  const ref = list;
  reconcileList(list, ['a', 'b'], empty);
  assert.equal(list, ref);
});

console.log(`\n${passed} checks passed.`);
