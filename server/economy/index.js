/* Economy engine — flat-rate points for Routine·Chore completions, and reward
 * redemption. To-do and Grocery never touch this (see docs/prd.md: only
 * Routine·Chore shows a ⭐).
 */
import { db } from './db.js';

const POINTS_PER_CHORE = 1;
const now = () => new Date().toISOString();

function getBalance(memberId) {
  const row = db.prepare('SELECT points FROM balances WHERE member_id = ?').get(memberId);
  return row ? row.points : 0;
}

function bumpBalance(memberId, delta) {
  db.prepare(
    `INSERT INTO balances (member_id, points) VALUES (?, ?)
     ON CONFLICT(member_id) DO UPDATE SET points = points + excluded.points`
  ).run(memberId, delta);
}

/** { memberId: points } for every id in `memberIds` (0 if never awarded). */
export function getAllBalances(memberIds) {
  return Object.fromEntries(memberIds.map((id) => [id, getBalance(id)]));
}

/**
 * { memberId: points } net earned today (awards minus same-day reverts) for
 * every id in `memberIds`. Ledger-derived, so it only counts chores actually
 * completed through this app — see the "completed directly in Todoist" caveat
 * in DEVLOG/README.
 */
export function getTodayEarned(memberIds, localDate) {
  const rows = db
    .prepare(
      `SELECT member_id, COALESCE(SUM(delta), 0) AS total FROM ledger
       WHERE reason IN ('award', 'revert') AND local_date = ?
       GROUP BY member_id`
    )
    .all(localDate);
  const byMember = Object.fromEntries(rows.map((r) => [r.member_id, r.total]));
  return Object.fromEntries(memberIds.map((id) => [id, byMember[id] || 0]));
}

// Net award state for one chore completion. Recurring Todoist tasks reuse the
// same task_id every day, so (task_id, local_date) — not task_id alone — is
// what identifies a single day's completion. >0 = currently awarded.
function awardNet(taskId, localDate) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(delta), 0) AS net FROM ledger
       WHERE task_id = ? AND local_date = ? AND reason IN ('award', 'revert')`
    )
    .get(taskId, localDate);
  return row.net;
}

/**
 * Award a chore completion. Idempotent — re-closing an already-awarded task
 * (e.g. two heartbeats racing a re-sync) is a no-op rather than double-paying.
 * Returns the member's new balance.
 */
export function awardChore(memberId, taskId, localDate) {
  if (awardNet(taskId, localDate) <= 0) {
    db.prepare(
      `INSERT INTO ledger (member_id, delta, reason, task_id, local_date, created_at)
       VALUES (?, ?, 'award', ?, ?, ?)`
    ).run(memberId, POINTS_PER_CHORE, taskId, localDate, now());
    bumpBalance(memberId, POINTS_PER_CHORE);
  }
  return getBalance(memberId);
}

/** Revert a chore's award (task reopened). Idempotent the same way. */
export function revertChore(memberId, taskId, localDate) {
  if (awardNet(taskId, localDate) > 0) {
    db.prepare(
      `INSERT INTO ledger (member_id, delta, reason, task_id, local_date, created_at)
       VALUES (?, ?, 'revert', ?, ?, ?)`
    ).run(memberId, -POINTS_PER_CHORE, taskId, localDate, now());
    bumpBalance(memberId, -POINTS_PER_CHORE);
  }
  return getBalance(memberId);
}

/**
 * Redeem a reward. Throws 'insufficient balance' if the cost can't be covered.
 * Also drops the assignment — once redeemed it's claimed, not still "being
 * worked toward"; assign it again later to save up for a repeat.
 */
export function redeemReward(memberId, rewardId, cost) {
  const balance = getBalance(memberId);
  if (balance < cost) throw new Error('insufficient balance');
  db.prepare(
    `INSERT INTO ledger (member_id, delta, reason, reward_id, created_at)
     VALUES (?, ?, 'redeem', ?, ?)`
  ).run(memberId, -cost, rewardId, now());
  bumpBalance(memberId, -cost);
  db.prepare('DELETE FROM assignments WHERE member_id = ? AND reward_id = ?').run(memberId, rewardId);
  return getBalance(memberId);
}

/** Assign a catalog reward to a member's "working toward" list. Idempotent. */
export function assignReward(memberId, rewardId) {
  db.prepare(
    `INSERT INTO assignments (member_id, reward_id, created_at) VALUES (?, ?, ?)
     ON CONFLICT(member_id, reward_id) DO NOTHING`
  ).run(memberId, rewardId, now());
}

/** Remove a reward from a member's "working toward" list. */
export function unassignReward(memberId, rewardId) {
  db.prepare('DELETE FROM assignments WHERE member_id = ? AND reward_id = ?').run(memberId, rewardId);
}

/** Drop a reward from everyone's "working toward" list (on hide/remove). */
export function clearAssignmentsForReward(rewardId) {
  db.prepare('DELETE FROM assignments WHERE reward_id = ?').run(rewardId);
}

/** Has this reward ever been redeemed? Guards hard-delete — a reward with
 *  ledger history is hidden instead, so past redemptions stay name-resolvable. */
export function hasRedemptions(rewardId) {
  return !!db.prepare(`SELECT 1 FROM ledger WHERE reason = 'redeem' AND reward_id = ? LIMIT 1`).get(rewardId);
}

/**
 * Week-in-review stats per member, ledger-derived (so, like getTodayEarned,
 * it only sees chores completed through this app).
 *   weekDates — the window, ['YYYY-MM-DD', ...] oldest first (usually 7 days
 *   ending today); streaks may look back further via `streakDates`.
 * Returns { memberId: { chores, points, streak, redeemed: [rewardId, ...] } }.
 */
export function getWeekRecap(memberIds, weekDates, streakDates = weekDates) {
  const [weekStart] = weekDates;
  // One (task_id, local_date) pair with a positive net = one chore that
  // "stuck" (not completed-then-reopened).
  const completions = db
    .prepare(
      `SELECT member_id, local_date, COUNT(*) AS chores, SUM(net) AS points FROM (
         SELECT member_id, task_id, local_date, SUM(delta) AS net FROM ledger
         WHERE reason IN ('award', 'revert') AND local_date >= ?
         GROUP BY member_id, task_id, local_date HAVING net > 0
       )
       GROUP BY member_id, local_date`
    )
    .all(streakDates[0] < weekStart ? streakDates[0] : weekStart);

  const byMemberDay = {};
  for (const r of completions) {
    (byMemberDay[r.member_id] ??= {})[r.local_date] = { chores: r.chores, points: r.points };
  }

  // Redeem rows carry no local_date (see the schema) — window them by
  // created_at between the window's local midnights, converted to real
  // instants (never by slicing the ISO string, per the standing TZ rule).
  const toInstant = (isoDate, plusDays = 0) => {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d + plusDays).toISOString();
  };
  const redeems = db
    .prepare(
      `SELECT member_id, reward_id FROM ledger
       WHERE reason = 'redeem' AND created_at >= ? AND created_at < ? ORDER BY created_at`
    )
    .all(toInstant(weekDates[0]), toInstant(weekDates.at(-1), 1));

  const out = {};
  for (const id of memberIds) {
    const days = byMemberDay[id] || {};
    let chores = 0;
    let points = 0;
    for (const date of weekDates) {
      chores += days[date]?.chores || 0;
      points += days[date]?.points || 0;
    }
    // Streak: consecutive days with ≥1 kept completion, walking back from
    // today — but an empty *today* doesn't break it (the day isn't over yet).
    let streak = 0;
    const walk = [...streakDates].reverse();
    for (let i = 0; i < walk.length; i++) {
      if (days[walk[i]]) streak++;
      else if (i === 0)
        continue; // today still in progress
      else break;
    }
    out[id] = { chores, points, streak, redeemed: redeems.filter((r) => r.member_id === id).map((r) => r.reward_id) };
  }
  return out;
}

/** { memberId: [rewardId, ...] } for every id in `memberIds`, oldest-assigned first. */
export function getAssignments(memberIds) {
  const rows = db.prepare('SELECT member_id, reward_id FROM assignments ORDER BY created_at').all();
  const out = Object.fromEntries(memberIds.map((id) => [id, []]));
  for (const r of rows) {
    if (r.member_id in out) out[r.member_id].push(r.reward_id);
  }
  return out;
}
