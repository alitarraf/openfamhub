/* On-device settings — the few knobs a family actually tweaks from the wall
 * (sleep schedule, screensaver timings), persisted in SQLite behind the
 * parent PIN gate. Resolution order per key: DB row → .env → hardcoded
 * fallback, so a fresh install behaves exactly like before the settings
 * screen existed and .env remains the documented default.
 *
 * Every key is whitelisted + range-validated here; the routes never write
 * arbitrary keys. All values are integers for now — keep it that way until
 * something genuinely isn't.
 */
import { db } from '../economy/db.js';

const DEFS = {
  sleepStartHour: { env: 'SLEEP_START_HOUR', fallback: 22, min: 0, max: 23 },
  sleepEndHour: { env: 'SLEEP_END_HOUR', fallback: 7, min: 0, max: 23 },
  screensaverIdleMin: { env: 'SCREENSAVER_IDLE_MIN', fallback: 3, min: 1, max: 120 },
  screensaverCycleSec: { env: 'SCREENSAVER_CYCLE_SEC', fallback: 20, min: 5, max: 300 },
  // 0/1 kill-switches for the scheduled notifications (push/scheduler.js
  // checks these before every send) — so "the reminders got annoying" is a
  // Settings-screen tap, not an .env edit + container restart.
  pushChoreReminder: { env: 'PUSH_CHORE_REMINDER', fallback: 1, min: 0, max: 1 },
  pushDinnerDigest: { env: 'PUSH_DINNER_DIGEST', fallback: 1, min: 0, max: 1 },
  // Confetti + chime when a kid marks a chore done (the wall reads this from
  // the public /api/config; see app/src/lib/celebrate.js). Purely cosmetic —
  // a kill-switch for when the party gets old.
  celebrateChores: { env: 'CELEBRATE_CHORES', fallback: 1, min: 0, max: 1 }
};

const intInRange = (v, def) => {
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n >= def.min && n <= def.max ? n : null;
};

/** Current value of every setting, fully resolved (DB → env → fallback). */
export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const out = {};
  for (const [key, def] of Object.entries(DEFS)) {
    out[key] = intInRange(stored[key], def) ?? intInRange(process.env[def.env], def) ?? def.fallback;
  }
  return out;
}

/**
 * Apply a partial update ({ key: value, ... }). Throws on any unknown key or
 * out-of-range value — all-or-nothing, so a typo'd payload can't half-apply.
 * Returns the full resolved settings afterward.
 */
export function setSettings(partial) {
  const entries = Object.entries(partial || {});
  if (!entries.length) throw new Error('no settings provided');
  const upserts = [];
  for (const [key, value] of entries) {
    const def = DEFS[key];
    if (!def) throw new Error(`unknown setting "${key}"`);
    const n = intInRange(value, def);
    if (n === null) throw new Error(`"${key}" must be an integer in [${def.min}, ${def.max}]`);
    upserts.push([key, n]);
  }
  const stmt = db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  );
  const now = new Date().toISOString();
  db.transaction(() => {
    for (const [key, n] of upserts) stmt.run(key, String(n), now);
  })();
  return getSettings();
}
