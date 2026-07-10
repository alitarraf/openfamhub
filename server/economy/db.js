/* Economy DB — SQLite via better-sqlite3 (synchronous; no async ceremony needed
 * for a single-process, family-scale app — every statement below is atomic by
 * construction since Node can't interleave code between them).
 *
 * Lives on a named Docker volume (/db), NOT the drvfs-backed ./server or
 * ./data bind mounts (see docker-compose.yml) — same POSIX-locking hazard
 * already worked around for Mealie's SQLite. This is the one genuinely
 * irreplaceable state in the app (see server/db/backup.js).
 *
 * Schema lives in server/db/migrations.js (PRAGMA user_version runner) —
 * add columns/tables there, never here.
 */
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { migrate } from '../db/migrations.js';
import { seedDemo } from '../demo/seed.js';

export const DB_PATH = process.env.ECONOMY_DB_PATH || '/db/openfamhub.sqlite';
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
migrate(db);
seedDemo(db); // no-op unless this is a demo instance with empty tables (see server/demo/seed.js)
