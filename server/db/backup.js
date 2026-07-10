/* Nightly SQLite backup — the economy ledger + journal entries are the only
 * state in the app that can't be re-fetched from a source app, and they live
 * on a named Docker volume (safe from drvfs, but invisible to the D:\
 * file-copy backup habits that cover ./data).
 *
 * Strategy: better-sqlite3's online backup API writes a consistent snapshot
 * NEXT TO the live DB (named volume — full POSIX lock semantics), then the
 * finished file is byte-copied onto the ./data bind mount where it's plain
 * bulk data (no SQLite locking involved, so drvfs is fine — same reasoning
 * as journal photos). One file per local day, newest BACKUP_KEEP retained.
 */
import { copyFile, unlink, readdir } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, DB_PATH } from '../economy/db.js';
import { localDateStr } from '../util/dates.js';

// ./data/backups — same container-root resolution as journal photos
// (/server/db → /data inside the container, ./data on the host).
export const BACKUP_DIR =
  process.env.BACKUP_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'backups');

const KEEP = Math.max(1, parseInt(process.env.BACKUP_KEEP, 10) || 14);
const CHECK_MS = 60 * 60 * 1000; // hourly "is today's backup done yet" check
const PREFIX = 'openfamhub-';

const backupName = (date) => `${PREFIX}${date}.sqlite`;

/** Delete all but the newest KEEP backups (date-stamped names sort naturally). */
async function prune() {
  const files = (await readdir(BACKUP_DIR)).filter((f) => f.startsWith(PREFIX) && f.endsWith('.sqlite')).sort();
  for (const f of files.slice(0, Math.max(0, files.length - KEEP))) {
    await unlink(join(BACKUP_DIR, f)).catch(() => {});
  }
}

/** Write today's backup if it doesn't exist yet. Returns the path when a new
 * backup was written, null when today's was already there. */
export async function backupIfDue() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const target = join(BACKUP_DIR, backupName(localDateStr()));
  if (existsSync(target)) return null;
  const tmp = join(dirname(DB_PATH), `.backup-${process.pid}.sqlite`);
  try {
    await db.backup(tmp);
    await copyFile(tmp, target);
  } finally {
    await unlink(tmp).catch(() => {});
  }
  await prune();
  return target;
}

/** Boot-time scheduler: back up now if today's is missing, then re-check
 * hourly (cheap no-op once the day's file exists; catches both the daily
 * rollover and a box that was asleep at the time). Failures are logged, never
 * thrown — a broken backup must not take the wall down. */
export function startBackupScheduler() {
  const run = () =>
    backupIfDue().then(
      (path) => path && console.log(`db: backed up to ${path}`),
      (err) => console.error(`db: backup failed: ${err.message}`)
    );
  run();
  setInterval(run, CHECK_MS).unref();
}
