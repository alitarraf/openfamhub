/* Economy engine tests — the award/revert idempotency and redeem balance
 * check are the highest-stakes logic in the app (they move the kids' real
 * points). Runs against a throwaway SQLite file (ECONOMY_DB_PATH must be set
 * BEFORE economy/db.js is imported, hence the dynamic import), on the OS
 * tmpdir — real POSIX locks, unlike the drvfs-mounted repo dir.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const tmp = mkdtempSync(join(tmpdir(), 'openfamhub-economy-'));
process.env.ECONOMY_DB_PATH = join(tmp, 'test.sqlite');
process.on('exit', () => rmSync(tmp, { recursive: true, force: true }));

const {
  awardChore,
  revertChore,
  redeemReward,
  assignReward,
  unassignReward,
  getAssignments,
  getAllBalances,
  getTodayEarned
} = await import('../economy/index.js');
const { db } = await import('../economy/db.js');
const { migrate, MIGRATIONS } = await import('../db/migrations.js');

let passed = 0;
const ok = (name, fn) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

const D1 = '2026-07-03';
const D2 = '2026-07-04';

console.log('migrations');
ok('fresh DB lands on the latest user_version', () => {
  assert.equal(db.pragma('user_version', { simple: true }), MIGRATIONS.at(-1).version);
});
ok('a pre-runner DB (tables exist, user_version 0) adopts the baseline cleanly', () => {
  // Simulates the already-deployed Wyse database: schema created by the old
  // CREATE TABLE IF NOT EXISTS code, no version stamp.
  const legacy = new Database(join(tmp, 'legacy.sqlite'));
  legacy.exec('CREATE TABLE balances (member_id TEXT PRIMARY KEY, points INTEGER NOT NULL DEFAULT 0)');
  legacy.prepare('INSERT INTO balances (member_id, points) VALUES (?, ?)').run('dad', 7);
  migrate(legacy); // must not throw on existing tables, must not touch rows
  assert.equal(legacy.pragma('user_version', { simple: true }), MIGRATIONS.at(-1).version);
  assert.equal(legacy.prepare('SELECT points FROM balances WHERE member_id = ?').get('dad').points, 7);
  legacy.close();
});
ok('migrate() is a no-op the second time', () => {
  migrate(db);
  assert.equal(db.pragma('user_version', { simple: true }), MIGRATIONS.at(-1).version);
});

console.log('award / revert');
ok('completing a chore awards exactly 1 point', () => {
  assert.equal(awardChore('kid1', 'task-a', D1), 1);
});
ok('re-awarding the same (task, date) is a no-op — no double pay', () => {
  assert.equal(awardChore('kid1', 'task-a', D1), 1);
});
ok('the same recurring task id on a NEW date awards again', () => {
  assert.equal(awardChore('kid1', 'task-a', D2), 2);
});
ok('reopening reverts the point', () => {
  assert.equal(revertChore('kid1', 'task-a', D2), 1);
});
ok('re-reverting is a no-op — balance never goes below the real state', () => {
  assert.equal(revertChore('kid1', 'task-a', D2), 1);
});
ok('close → reopen → close pays exactly once net', () => {
  awardChore('kid2', 'task-b', D1);
  revertChore('kid2', 'task-b', D1);
  assert.equal(awardChore('kid2', 'task-b', D1), 1);
});
ok('getTodayEarned nets same-day reverts and ignores other days', () => {
  // kid1 today (D1): one award still standing. The D2 award+revert nets out of D2, not D1.
  assert.deepEqual(getTodayEarned(['kid1', 'kid2'], D1), { kid1: 1, kid2: 1 });
  assert.deepEqual(getTodayEarned(['kid1', 'kid2'], D2), { kid1: 0, kid2: 0 });
});

console.log('redeem');
ok('redeem checks the balance first', () => {
  assert.throws(() => redeemReward('kid1', 'pony', 999), /insufficient balance/);
  assert.equal(getAllBalances(['kid1']).kid1, 1); // nothing deducted on the failed attempt
});
ok('redeem deducts, and drops the assignment (claimed ≠ still working toward)', () => {
  assignReward('kid1', 'ice-cream');
  assert.deepEqual(getAssignments(['kid1']).kid1, ['ice-cream']);
  assert.equal(redeemReward('kid1', 'ice-cream', 1), 0);
  assert.deepEqual(getAssignments(['kid1']).kid1, []);
});

console.log('assignments');
ok('assign is idempotent; unassign removes', () => {
  assignReward('kid2', 'movie');
  assignReward('kid2', 'movie');
  assert.deepEqual(getAssignments(['kid2']).kid2, ['movie']);
  unassignReward('kid2', 'movie');
  assert.deepEqual(getAssignments(['kid2']).kid2, []);
});
ok('balances default to 0 for members who never earned', () => {
  assert.deepEqual(getAllBalances(['nobody']), { nobody: 0 });
});

console.log(`\n${passed} economy assertions passed`);
