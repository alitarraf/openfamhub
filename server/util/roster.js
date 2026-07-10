/* Roster-derived helpers shared by the route modules. */
import { members } from '../config/members.js';

// Snapshot at load (same as the pre-split index.js) — the roster file itself
// only changes with a `docker compose up -d`, which restarts the process.
export const MEMBER_IDS = members().map((m) => m.id);

/** Parse an optional JSON-array-of-member-ids form field. Returns [] when
 * absent, the array when valid, null when malformed/unknown ids. */
export function parseMemberIds(raw) {
  if (!raw) return [];
  let ids;
  try {
    ids = JSON.parse(raw);
  } catch {
    return null;
  }
  return Array.isArray(ids) && ids.every((id) => MEMBER_IDS.includes(id)) ? ids : null;
}
