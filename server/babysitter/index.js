/* Babysitter mode — a reload-proof lockdown the wall drops into when a sitter
 * is watching the kids: a full-screen emergency-info card, with every other
 * screen sealed off until a parent's PIN returns to the dashboard.
 *
 * Two things live in the single-row `babysitter` table (migration v4):
 *   - `active` (0/1): the global lock flag. The wall reads it on boot so a
 *     kiosk reload (or opening the URL on any device) can't escape the lock.
 *   - `data` (JSON): the editable emergency info — parent phone numbers,
 *     emergency contacts, and free-form notes. Edited only from the PWA behind
 *     the parent PIN gate (see routes/babysitter.js).
 *
 * Parent NAMES are never stored here — they're derived live from the roster
 * (the members in BUDGET_UNLOCK_MEMBERS, i.e. whoever can unlock parent-gated
 * surfaces) so renaming a member in config/members.json just works. Only their
 * phone numbers, keyed by member id, are persisted.
 */
import { db } from '../economy/db.js';
import { members } from '../config/members.js';
import { parentIds } from '../auth.js';

// Caps so a compromised/fat-fingered PWA can't grow the blob unbounded.
const MAX_CONTACTS = 12;
const MAX_NAME = 60;
const MAX_PHONE = 40;
const MAX_NOTES = 2000;

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function readRow() {
  const row = db.prepare('SELECT active, data FROM babysitter WHERE id = 1').get();
  if (!row) return { active: 0, data: {} };
  let data;
  try {
    data = JSON.parse(row.data) || {};
  } catch {
    data = {}; // corrupt blob → behave like empty, never throw at the wall
  }
  return { active: row.active, data };
}

/** The full view the wall/PWA render: lock state + parent block (names live
 * from the roster) + emergency contacts + notes. Safe to serve publicly — it's
 * exactly what a sitter is meant to see. */
export function getBabysitter() {
  const { active, data } = readRow();
  const phones = data.parentPhones || {};
  const roster = members();
  const parents = parentIds()
    .map((id) => roster.find((m) => m.id === id))
    .filter(Boolean)
    .map((m) => ({ id: m.id, name: m.name, color: m.color, phone: str(phones[m.id], MAX_PHONE) }));
  const contacts = Array.isArray(data.contacts)
    ? data.contacts
        .map((c) => ({ name: str(c?.name, MAX_NAME), phone: str(c?.phone, MAX_PHONE) }))
        .filter((c) => c.name || c.phone)
    : [];
  return { active: active === 1, parents, contacts, notes: str(data.notes, MAX_NOTES) };
}

/** Flip the lock on/off. Entering is a one-tap (a parent on their way out);
 * leaving is gated on a parent PIN at the route layer, not here. */
export function setActive(active) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO babysitter (id, active, updated_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET active = excluded.active, updated_at = excluded.updated_at`
  ).run(active ? 1 : 0, now);
  return getBabysitter();
}

/**
 * Replace the emergency info ({ parentPhones, contacts, notes }). Whitelists
 * parent-phone keys to actual parents, caps list length and every string, and
 * drops blank contacts — so a malformed payload is sanitized, not rejected.
 * Preserves the current `active` flag (editing from a phone must not unlock the
 * wall). Returns the full resolved view.
 */
export function setInfo(partial) {
  const allowed = new Set(parentIds());
  const parentPhones = {};
  const inPhones = partial?.parentPhones || {};
  for (const [id, phone] of Object.entries(inPhones)) {
    if (allowed.has(id)) parentPhones[id] = str(phone, MAX_PHONE);
  }
  const contacts = (Array.isArray(partial?.contacts) ? partial.contacts : [])
    .slice(0, MAX_CONTACTS)
    .map((c) => ({ name: str(c?.name, MAX_NAME), phone: str(c?.phone, MAX_PHONE) }))
    .filter((c) => c.name || c.phone);
  const notes = str(partial?.notes, MAX_NOTES);

  const data = JSON.stringify({ parentPhones, contacts, notes });
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO babysitter (id, data, updated_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).run(data, now);
  return getBabysitter();
}
