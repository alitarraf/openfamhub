/* Scheduled notifications — the two the family asked for first:
 *   • Morning chore reminder (CHORE_REMINDER_HOUR, default 8): how many
 *     chores are still open per kid today.
 *   • Dinner digest (DINNER_DIGEST_HOUR, default 17): what's planned for
 *     dinner tonight, from the Mealie meal plan.
 * Both go to PUSH_MEMBERS (default "dad,mom") — the parents asked to be the
 * audience; kids' phones can subscribe but only get what's aimed at them
 * (nothing, today).
 *
 * "Sent already?" is tracked in the settings table under internal.* keys —
 * deliberately outside the settings whitelist (server/settings/index.js
 * validates route input; these rows are only ever written here), so a
 * restart can't double-send the way an in-memory flag would allow.
 * Skips quietly when there's nothing to say (no open chores / no dinner
 * planned) or when VAPID keys aren't configured.
 */
import { db } from '../economy/db.js';
import { hasVapid, sendToMembers } from './index.js';
import { taskProvider, mealsProvider } from '../providers/registry.js';
import { members } from '../config/members.js';
import { getSettings } from '../settings/index.js';
import { localDateStr } from '../util/dates.js';

const { fetchBoard, hasToken } = taskProvider;
const { fetchMealPlan, hasMealie } = mealsProvider;

const hourEnv = (key, fallback) => {
  const n = parseInt(process.env[key], 10);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : fallback;
};
const pushMembers = () =>
  (process.env.PUSH_MEMBERS || 'dad,mom')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const sentKey = (kind) => `internal.push.${kind}`;
const sentToday = (kind) =>
  db.prepare('SELECT value FROM settings WHERE key = ?').get(sentKey(kind))?.value === localDateStr();
const markSent = (kind) =>
  db
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(sentKey(kind), localDateStr(), new Date().toISOString());

/** "3 chores left for Lila, 1 for Jude" (open Routine·Chore items today). */
async function choreReminderBody() {
  const project = (process.env.TODOIST_ROUTINE_PROJECT || '').trim();
  if (!hasToken() || !project) return null;
  const board = await fetchBoard(project, members(), { withCompleted: false });
  const parts = [];
  for (const bm of board.members) {
    const open = bm.tasks.filter((t) => !t.done).length;
    if (!open) continue;
    const name = members().find((m) => m.id === bm.id)?.name || bm.id;
    parts.push(`${open} for ${name}`);
  }
  if (!parts.length) return null; // everything's done — no nag without a reason
  return `Chores still open today: ${parts.join(', ')}.`;
}

/** "Dinner tonight: Tacos" from today's meal plan, or null if none planned. */
async function dinnerDigestBody() {
  if (!hasMealie()) return null;
  const today = localDateStr();
  const plan = await fetchMealPlan(today, today);
  const day = plan.days?.[today];
  if (!day) return null;
  const dinnerIdx = plan.slots.indexOf('Dinner');
  const cell = dinnerIdx >= 0 ? day[dinnerIdx] : null;
  return cell?.title ? `Dinner tonight: ${cell.title}` : null;
}

async function tick(now = new Date()) {
  if (!hasVapid()) return;
  const hour = now.getHours();
  // Settings-screen kill-switches (parent-PIN gated on the wall) — checked
  // per tick so flipping one off takes effect without a restart.
  const settings = getSettings();

  if (settings.pushChoreReminder && hour >= hourEnv('CHORE_REMINDER_HOUR', 8) && !sentToday('choreReminder')) {
    markSent('choreReminder'); // mark first — a send error shouldn't retry-spam
    const body = await choreReminderBody().catch(() => null);
    if (body) await sendToMembers(pushMembers(), { title: 'Chores today', body, url: '/m' });
  }

  if (settings.pushDinnerDigest && hour >= hourEnv('DINNER_DIGEST_HOUR', 17) && !sentToday('dinnerDigest')) {
    markSent('dinnerDigest');
    const body = await dinnerDigestBody().catch(() => null);
    if (body) await sendToMembers(pushMembers(), { title: "What's for dinner", body, url: '/m' });
  }
}

/** 5-minute tick — cheap (two settings-table reads) until something is due. */
export function startPushScheduler() {
  const run = () => tick().catch((err) => console.error(`push: scheduler failed: ${err.message}`));
  run();
  setInterval(run, 5 * 60 * 1000).unref();
}
