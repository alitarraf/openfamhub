/* Auto-posted recaps — the weekly (and monthly) family summary lands in the
 * Journal as a regular entry (tag 'recap', author 'family') instead of an
 * ephemeral dashboard card, so it's part of the record: scroll back through
 * Timeline and see how any week went, and "on this day" can resurface them.
 *
 * Weekly: Sundays at RECAP_HOUR (default 19:00), covering the 7 days ending
 * that Sunday. Monthly: the 1st at RECAP_HOUR, covering the previous calendar
 * month. Idempotent per day (checked against existing recap entries), so the
 * hourly scheduler tick and restarts can't double-post. Ledger-derived, same
 * caveat as every economy stat: it only sees chores completed through this app.
 */
import { db } from './db.js';
import { createEntry } from './index.js';
import { getWeekRecap } from '../economy/index.js';
import { members } from '../config/members.js';
import { getReward } from '../rewards/index.js';
import { localDateStr, lastNDates } from '../util/dates.js';
import { publish } from '../util/bus.js';

export const RECAP_AUTHOR = 'family';
const RECAP_TAG = 'recap';
const recapHour = () => {
  const n = parseInt(process.env.RECAP_HOUR, 10);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : 19;
};
const STREAK_LOOKBACK = 30; // days of ledger to scan for streak runs

const hasRecapToday = (prefix) =>
  !!db
    .prepare(`SELECT 1 FROM journal_entries WHERE tag = ? AND local_date = ? AND text LIKE ? LIMIT 1`)
    .get(RECAP_TAG, localDateStr(), `${prefix}%`);

const fmtDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/** Journal activity inside [start, end] (inclusive local dates), recaps excluded. */
function journalStats(start, end) {
  const rows = db
    .prepare(
      `SELECT id, text, hearts FROM journal_entries
       WHERE local_date >= ? AND local_date <= ? AND (tag IS NULL OR tag != ?)
       ORDER BY hearts DESC, id DESC`
    )
    .all(start, end, RECAP_TAG);
  return { count: rows.length, top: rows[0]?.hearts > 0 ? rows[0] : null };
}

/** Compose the entry text for a window of local dates (oldest first). */
export function composeRecap(title, dates, streakDates) {
  const roster = members();
  const stats = getWeekRecap(
    roster.map((m) => m.id),
    dates,
    streakDates
  );
  const rewardName = (id) => getReward(id)?.name || id;

  const lines = [`${title} — ${fmtDay(dates[0])} to ${fmtDay(dates.at(-1))}`];
  const active = [];
  for (const m of roster) {
    const s = stats[m.id];
    if (!s.chores && !s.redeemed.length) continue;
    active.push(m.id);
    const bits = [`${s.chores} chore${s.chores === 1 ? '' : 's'} done`, `${s.points} ⭐ earned`];
    if (s.streak >= 2) bits.push(`${s.streak}-day streak`);
    lines.push(`${m.name}: ${bits.join(' · ')}`);
    for (const rid of s.redeemed) lines.push(`  ${m.name} redeemed “${rewardName(rid)}”`);
  }
  if (active.length === 0) lines.push('A quiet stretch — no chores logged.');

  const j = journalStats(dates[0], dates.at(-1));
  if (j.count) {
    const top = j.top ? ` · most loved: “${j.top.text.slice(0, 80)}${j.top.text.length > 80 ? '…' : ''}”` : '';
    lines.push(`${j.count} journal moment${j.count === 1 ? '' : 's'}${top}`);
  }
  return { text: lines.join('\n'), memberIds: active };
}

function postRecap(title, dates, streakDates) {
  const { text, memberIds } = composeRecap(title, dates, streakDates);
  createEntry({ authorId: RECAP_AUTHOR, text, tag: RECAP_TAG, photoPath: null, memberIds, localDate: localDateStr() });
  publish('journal');
  console.log(`recap: posted "${title}" (${dates[0]} → ${dates.at(-1)})`);
}

/** Local dates of the previous calendar month, oldest first. */
function prevMonthDates() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const out = [];
  for (const d = new Date(first); d.getMonth() === first.getMonth(); d.setDate(d.getDate() + 1)) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return out;
}

/** Post whichever recaps are due right now (exported for tests). */
export function postDueRecaps(now = new Date()) {
  if (now.getHours() < recapHour()) return;
  // Weekly on Sundays — the 7 days ending today.
  if (now.getDay() === 0 && !hasRecapToday('Weekly recap')) {
    postRecap('Weekly recap', lastNDates(7), lastNDates(STREAK_LOOKBACK));
  }
  // Monthly on the 1st — the previous calendar month. Streaks use the same
  // window (a streak crossing the boundary shows up in the next one).
  if (now.getDate() === 1 && !hasRecapToday('Monthly recap')) {
    const dates = prevMonthDates();
    postRecap('Monthly recap', dates, dates);
  }
}

/** Hourly tick, same shape as the backup scheduler. Failures log, never throw. */
export function startRecapScheduler() {
  const run = () => {
    try {
      postDueRecaps();
    } catch (err) {
      console.error(`recap: failed: ${err.message}`);
    }
  };
  run();
  setInterval(run, 60 * 60 * 1000).unref();
}
