/* Family roster ↔ Todoist assignee (responsible_uid).
 *
 * The roster itself — how many people, their ids/names/colors — lives in
 * `config/members.json` (gitignored; copy `config/members.example.json` to start).
 * Any number of members, any ids: this file no longer assumes a fixed dad/mom/kid
 * shape. Each entry: `{ id, name, color }` (extra fields pass through untouched,
 * e.g. for a custom client's theming).
 *
 * Each member's Todoist user id is still looked up from env at call-time —
 * `TODOIST_UID_<ID>` (uppercased `id`) — so it never needs to be committed. Run
 * `GET /api/todoist/collaborators` once the token + projects are configured to read
 * each person's id, then drop them into .env as TODOIST_UID_<ID>=...
 *
 * The frontend's own member list (`app/src/lib/data/mock.js`) is a separate,
 * build-time roster used as demo/fallback data — see README "Family roster" for
 * why the two aren't unified yet.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXAMPLE_PATH = join(ROOT, 'config', 'members.example.json');

function rosterPath() {
  const configPath = (process.env.MEMBERS_CONFIG || '').trim() || join(ROOT, 'config', 'members.json');
  return existsSync(configPath) ? configPath : EXAMPLE_PATH;
}

function roster() {
  return JSON.parse(readFileSync(rosterPath(), 'utf8'));
}

/** True only when NOTHING is configured — no `MEMBERS_CONFIG`, no
 * `config/members.json` — so we've fallen back to the shipped example roster.
 * i.e. a genuinely out-of-the-box/demo instance. An explicitly-set
 * `MEMBERS_CONFIG` (even one pointing at the example file, as the tests do)
 * counts as configured, so it never trips demo data seeding.
 * Used to gate the demo seed (see server/demo/seed.js). */
export const usingFallbackRoster = () => {
  if ((process.env.MEMBERS_CONFIG || '').trim()) return false;
  return !existsSync(join(ROOT, 'config', 'members.json'));
};

/** Roster with each member's Todoist UID resolved from env. Read at call-time
 * (like the other sources) so `docker compose up -d` picks up changes to
 * config/members.json or .env without a rebuild. */
export const members = () =>
  roster().map((m) => ({
    ...m,
    uid: (process.env[`TODOIST_UID_${m.id.toUpperCase()}`] || '').trim()
  }));

/** True once at least one member has a Todoist UID mapped. */
export const hasMembers = () => members().some((m) => m.uid);
