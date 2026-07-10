/* Journal engine — family feed/timeline entries. Multi-author by "who's this
 * about" (journal_entry_members), single "author_id" for who posted it.
 * Delete/edit are self-service only: the caller must pass the session's own
 * memberId as authorId, and it must match the row's author_id.
 */
import { db } from './db.js';

export const TAGS = ['milestone', 'quote', 'school', 'health', 'recap'];
const now = () => new Date().toISOString();

const setMembers = db.transaction((entryId, memberIds) => {
  db.prepare('DELETE FROM journal_entry_members WHERE entry_id = ?').run(entryId);
  const insert = db.prepare('INSERT INTO journal_entry_members (entry_id, member_id) VALUES (?, ?)');
  for (const id of memberIds) insert.run(entryId, id);
});

function membersByEntry(entryIds) {
  if (!entryIds.length) return {};
  const placeholders = entryIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT entry_id, member_id FROM journal_entry_members WHERE entry_id IN (${placeholders})`)
    .all(...entryIds);
  const out = Object.fromEntries(entryIds.map((id) => [id, []]));
  for (const r of rows) out[r.entry_id].push(r.member_id);
  return out;
}

function hydrate(rows) {
  const byEntry = membersByEntry(rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    authorId: r.author_id,
    text: r.text,
    tag: r.tag,
    photoPath: r.photo_path,
    hearts: r.hearts,
    localDate: r.local_date,
    createdAt: r.created_at,
    memberIds: byEntry[r.id] || []
  }));
}

/**
 * Create an entry. `localDate` must be computed by the caller with the same
 * TZ-safe helper the economy ledger uses (server/index.js's localDateStr) —
 * never derived from slicing an ISO/UTC timestamp here.
 */
export function createEntry({ authorId, text, tag, photoPath, memberIds, localDate }) {
  const info = db
    .prepare(
      `INSERT INTO journal_entries (author_id, text, tag, photo_path, local_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(authorId, text, tag || null, photoPath || null, localDate, now());
  setMembers(info.lastInsertRowid, memberIds || []);
  return hydrate([db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(info.lastInsertRowid)])[0];
}

/** Most recent `limit` entries, newest first. Feed and timeline both read
 * this same list and re-sort/group client-side — there's only one shape of
 * "all the entries," just two ways of looking at it. */
export function listEntries(limit = 60) {
  const rows = db.prepare('SELECT * FROM journal_entries ORDER BY created_at DESC LIMIT ?').all(limit);
  return hydrate(rows);
}

/** Entries whose local_date shares today's month-day, from a past year.
 * `monthDay` is 'MM-DD', `currentYear` is 'YYYY' — both caller-supplied so
 * this stays a pure string match, no per-call Date/TZ logic in here. */
export function getOnThisDay(monthDay, currentYear) {
  const rows = db
    .prepare(
      `SELECT * FROM journal_entries
       WHERE substr(local_date, 6, 5) = ? AND substr(local_date, 1, 4) != ?
       ORDER BY local_date DESC`
    )
    .all(monthDay, currentYear);
  return hydrate(rows);
}

/** Tap-to-heart on the wall is anonymous (the wall is login-free by design,
 * like every other tap-to-complete gesture) — a plain increment, not a
 * per-member toggle. Returns the new count, or null if the entry's gone. */
export function heartEntry(id) {
  const info = db.prepare('UPDATE journal_entries SET hearts = hearts + 1 WHERE id = ?').run(id);
  if (info.changes === 0) return null;
  return db.prepare('SELECT hearts FROM journal_entries WHERE id = ?').get(id).hearts;
}

/** Self-service edit — only the original poster can edit their own entry.
 * Returns the updated entry, or null if it doesn't exist / isn't theirs. */
export function updateEntry(id, authorId, { text, tag, memberIds }) {
  const row = db.prepare('SELECT * FROM journal_entries WHERE id = ? AND author_id = ?').get(id, authorId);
  if (!row) return null;
  db.prepare('UPDATE journal_entries SET text = ?, tag = ? WHERE id = ?').run(text, tag || null, id);
  if (memberIds) setMembers(id, memberIds);
  return hydrate([db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(id)])[0];
}

/** Self-service delete — only the original poster can delete their own
 * entry. Returns the deleted row's photoPath (so the route layer can clean
 * up the file — file I/O doesn't belong in this DB module) and true; null
 * if it doesn't exist / isn't theirs. */
export function deleteEntry(id, authorId) {
  const row = db.prepare('SELECT photo_path FROM journal_entries WHERE id = ? AND author_id = ?').get(id, authorId);
  if (!row) return null;
  db.prepare('DELETE FROM journal_entries WHERE id = ?').run(id); // ON DELETE CASCADE drops entry_members rows
  return row.photo_path;
}
