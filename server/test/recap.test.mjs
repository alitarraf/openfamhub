/* Recap tests — the composed journal text and the scheduler's posting rules
 * (Sunday/1st gates, hour gate, once-per-day idempotency). Same throwaway-DB
 * setup as economy.test.mjs.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = mkdtempSync(join(tmpdir(), 'openfamhub-recap-'));
process.env.ECONOMY_DB_PATH = join(tmp, 'test.sqlite');
process.env.MEMBERS_CONFIG = join(ROOT, 'config', 'members.example.json');
process.env.RECAP_HOUR = '19';
process.on('exit', () => rmSync(tmp, { recursive: true, force: true }));

const { awardChore, redeemReward } = await import('../economy/index.js');
const { createEntry, listEntries, heartEntry } = await import('../journal/index.js');
const { composeRecap, postDueRecaps, RECAP_AUTHOR } = await import('../journal/recap.js');
const { lastNDates, localDateStr } = await import('../util/dates.js');

let passed = 0;
const ok = (name, fn) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

const week = lastNDates(7);
const today = localDateStr();

// Seed: kid1 did chores on the last 3 days (a streak), redeemed something;
// one hearted journal entry this week.
awardChore('kid1', 'dishes', week.at(-3));
awardChore('kid1', 'dishes', week.at(-2));
awardChore('kid1', 'laundry', week.at(-2));
awardChore('kid1', 'dishes', week.at(-1));
redeemReward('kid1', 'movie-night', 1);
const entry = createEntry({
  authorId: 'mom',
  text: 'Kid1 rode a bike with no training wheels!',
  tag: 'milestone',
  photoPath: null,
  memberIds: ['kid1'],
  localDate: today
});
heartEntry(entry.id);

console.log('composeRecap');
ok('names active members with chores, points, and streaks; skips inactive ones', () => {
  const { text, memberIds } = composeRecap('Weekly recap', week, week);
  assert.match(text, /^Weekly recap — /);
  assert.match(text, /Kid 1: 4 chores done · 4 ⭐ earned · 3-day streak/);
  assert.doesNotMatch(text, /Kid 2:/); // no activity → not listed
  assert.deepEqual(memberIds, ['kid1']);
});
ok('lists redemptions and the week’s journal moments with the most-loved quote', () => {
  const { text } = composeRecap('Weekly recap', week, week);
  assert.match(text, /Kid 1 redeemed “movie-night”/);
  assert.match(text, /1 journal moment · most loved: “Kid1 rode a bike/);
});
ok('an empty week reads as a quiet stretch, not an error', () => {
  const past = ['2020-01-01', '2020-01-02', '2020-01-03'];
  const { text, memberIds } = composeRecap('Weekly recap', past, past);
  assert.match(text, /A quiet stretch/);
  assert.deepEqual(memberIds, []);
});

console.log('postDueRecaps');
const countRecaps = () => listEntries().filter((e) => e.tag === 'recap').length;
// A Sunday at 20:00 (past RECAP_HOUR) — date components only matter via
// getDay()/getDate()/getHours(), so a fixed historical Sunday works.
const sunday8pm = new Date(2026, 6, 5, 20, 0, 0); // 2026-07-05 is a Sunday
const monday8pm = new Date(2026, 6, 6, 20, 0, 0);
const sunday6pm = new Date(2026, 6, 5, 18, 0, 0);
const first8pm = new Date(2026, 7, 1, 20, 0, 0); // Aug 1st

ok('does nothing before RECAP_HOUR or on a non-recap day', () => {
  postDueRecaps(sunday6pm);
  postDueRecaps(monday8pm);
  assert.equal(countRecaps(), 0);
});
ok('posts the weekly recap on Sunday evening, exactly once', () => {
  postDueRecaps(sunday8pm);
  postDueRecaps(sunday8pm); // second tick same evening — must not double-post
  assert.equal(countRecaps(), 1);
  const recap = listEntries().find((e) => e.tag === 'recap');
  assert.equal(recap.authorId, RECAP_AUTHOR);
  assert.match(recap.text, /^Weekly recap/);
});
ok('posts the monthly recap on the 1st, independently of the weekly', () => {
  postDueRecaps(first8pm);
  postDueRecaps(first8pm);
  assert.equal(countRecaps(), 2);
  assert.ok(listEntries().some((e) => e.tag === 'recap' && /^Monthly recap/.test(e.text)));
});

console.log(`\n${passed} recap assertions passed`);
