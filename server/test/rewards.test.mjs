/* Reward-catalog tests — the two-layer merge (file base + PWA-added customs)
 * and the rules that fall out of the no-FK ledger design: an id is frozen on
 * edit, ids never collide, built-ins can only be hidden, and a reward with
 * redemption history is hidden (never hard-deleted) so the recap can still
 * resolve its name. Throwaway SQLite on the OS tmpdir — ECONOMY_DB_PATH must be
 * set BEFORE economy/db.js is imported, hence the dynamic import.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'openfamhub-rewards-'));
process.env.ECONOMY_DB_PATH = join(tmp, 'test.sqlite');
process.on('exit', () => rmSync(tmp, { recursive: true, force: true }));

const { getRewards, getReward, createReward, updateReward, setRewardHidden, removeCustomReward, CAT_KEYS } =
  await import('../rewards/index.js');
const { awardChore, redeemReward, assignReward, getAssignments } = await import('../economy/index.js');
const { rewards: baseRewards } = await import('../config/rewards.js');

let passed = 0;
const ok = (name, fn) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

const BASE_N = baseRewards().length;
const validFields = (over = {}) => ({ name: 'Bubble Tea', icon: 'local_cafe', catKey: 'sky', cost: 10, ...over });

console.log('catalog merge');
ok('a fresh DB exposes exactly the file-authored base rewards', () => {
  assert.equal(getRewards().length, BASE_N);
  assert.ok(getRewards().every((r) => r.source === 'builtin'));
});
ok('a created custom reward appends to the base, tagged source:custom', () => {
  const r = createReward(validFields());
  assert.equal(r.source, 'custom');
  assert.equal(r.id, 'bubble-tea');
  assert.deepEqual({ name: r.name, icon: r.icon, catKey: r.catKey, cost: r.cost, hidden: r.hidden }, {
    name: 'Bubble Tea',
    icon: 'local_cafe',
    catKey: 'sky',
    cost: 10,
    hidden: false
  });
  assert.equal(getRewards().length, BASE_N + 1);
});

console.log('validation');
ok('name is required', () => assert.throws(() => createReward(validFields({ name: '  ' })), /name is required/));
ok('icon must be a Material Symbols name', () => {
  assert.throws(() => createReward(validFields({ icon: 'Ice Cream' })), /Material Symbols/);
  assert.throws(() => createReward(validFields({ icon: '' })), /Material Symbols/);
});
ok('catKey must be one of the finite set', () => {
  assert.throws(() => createReward(validFields({ catKey: 'purple' })), /catKey must be one of/);
  for (const k of CAT_KEYS) assert.doesNotThrow(() => cleanOk(k));
});
function cleanOk(catKey) {
  // create + immediately delete, just to exercise each valid catKey
  const r = createReward(validFields({ name: `probe-${catKey}`, catKey }));
  removeCustomReward(r.id);
}
ok('cost must be a non-negative integer within range', () => {
  assert.throws(() => createReward(validFields({ cost: -1 })), /cost must be an integer/);
  assert.throws(() => createReward(validFields({ cost: 1.5 })), /cost must be an integer/);
  assert.throws(() => createReward(validFields({ cost: 999999 })), /cost must be an integer/);
  assert.doesNotThrow(() => removeCustomReward(createReward(validFields({ name: 'free', cost: 0 })).id));
});

console.log('id generation');
ok('a duplicate name suffixes -2, -3 … never colliding', () => {
  const a = createReward(validFields({ name: 'Movie Night' }));
  const b = createReward(validFields({ name: 'Movie Night' }));
  const c = createReward(validFields({ name: 'Movie Night' }));
  assert.deepEqual([a.id, b.id, c.id], ['movie-night', 'movie-night-2', 'movie-night-3']);
});
ok('a custom id never collides with a base reward id', () => {
  const baseId = baseRewards()[0].id; // e.g. 'ice-cream' already taken by base? use its literal name
  const clash = createReward(validFields({ name: baseId.replace(/-/g, ' ') }));
  assert.notEqual(clash.id, baseId);
  removeCustomReward(clash.id);
});

console.log('edit rules');
ok('editing a custom reward keeps its id frozen while changing fields', () => {
  const r = createReward(validFields({ name: 'Pizza', icon: 'local_pizza', catKey: 'coral', cost: 20 }));
  const before = r.id;
  const after = updateReward(r.id, validFields({ name: 'Pizza Party', icon: 'celebration', catKey: 'gold', cost: 25 }));
  assert.equal(after.id, before); // id frozen — past redemptions stay resolvable
  assert.equal(after.name, 'Pizza Party');
  assert.equal(after.icon, 'celebration');
  assert.equal(after.cost, 25);
});
ok('editing a built-in is refused (file-only)', () => {
  const baseId = baseRewards()[0].id;
  assert.throws(() => updateReward(baseId, validFields()), /built-in rewards can only be hidden/);
});
ok('editing an unknown reward throws', () => {
  assert.throws(() => updateReward('nope-xyz', validFields()), /unknown reward/);
});

console.log('hide / show');
ok('hiding a built-in drops it from the default catalog but not includeHidden', () => {
  const baseId = baseRewards()[0].id;
  setRewardHidden(baseId, true);
  assert.ok(!getRewards().some((r) => r.id === baseId));
  assert.ok(getRewards({ includeHidden: true }).some((r) => r.id === baseId && r.hidden));
  setRewardHidden(baseId, false); // restore
  assert.ok(getRewards().some((r) => r.id === baseId));
});
ok('hiding clears the reward from everyone working toward it', () => {
  const r = createReward(validFields({ name: 'Sleepover', icon: 'bedtime', catKey: 'iris', cost: 30 }));
  assignReward('kid1', r.id);
  assert.deepEqual(getAssignments(['kid1']).kid1.includes(r.id), true);
  setRewardHidden(r.id, true);
  assert.equal(getAssignments(['kid1']).kid1.includes(r.id), false);
  removeCustomReward(r.id);
});

console.log('remove');
ok('a never-redeemed custom reward hard-deletes', () => {
  const r = createReward(validFields({ name: 'Toy', icon: 'toys', catKey: 'fern', cost: 5 }));
  assert.deepEqual(removeCustomReward(r.id), { removed: 'deleted' });
  assert.equal(getReward(r.id), null);
});
ok('a redeemed custom reward hides instead of deleting (recap keeps the name)', () => {
  const r = createReward(validFields({ name: 'Arcade', icon: 'stadia_controller', catKey: 'sky', cost: 2 }));
  awardChore('kid2', 'chore-x', '2026-07-01');
  awardChore('kid2', 'chore-y', '2026-07-02');
  redeemReward('kid2', r.id, r.cost); // now it has redemption history
  assert.deepEqual(removeCustomReward(r.id), { removed: 'hidden' });
  // Gone from the visible catalog, but still resolvable by id for the recap.
  assert.ok(!getRewards().some((x) => x.id === r.id));
  assert.equal(getReward(r.id)?.name, 'Arcade');
});
ok('a built-in cannot be deleted, only hidden', () => {
  const baseId = baseRewards()[0].id;
  assert.throws(() => removeCustomReward(baseId), /cannot be deleted, only hidden/);
});

console.log(`\n${passed} reward assertions passed`);
