/* Family journal — wall Feed/Timeline reads, PWA composer writes, tap-to-heart. */
import express, { Router } from 'express';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { requireMobileAuth } from '../auth.js';
import { journalTags } from '../config/journal-tags.js';
import {
  TAGS,
  createEntry,
  listEntries,
  getOnThisDay,
  heartEntry,
  updateEntry,
  deleteEntry
} from '../journal/index.js';
import { uploadJournalPhoto, saveJournalPhoto, JOURNAL_PHOTOS_DIR } from '../journal/photos.js';
import { localDateStr, monthDayStr } from '../util/dates.js';
import { MEMBER_IDS, parseMemberIds } from '../util/roster.js';
import { publish } from '../util/bus.js';

export const journalRoutes = Router();

// Both the wall (Feed/Timeline) and the PWA composer read this. Public/no-auth:
// the wall is login-free by design, same as every other tap-to-complete surface.
journalRoutes.get('/api/journal', (_req, res) => {
  res.json({
    entries: listEntries(),
    onThisDay: getOnThisDay(monthDayStr(), localDateStr().slice(0, 4)),
    tags: journalTags()
  });
});

// Create an entry. PWA-only (nothing is authored on-wall, by design) — the
// author is always the logged-in session, never the request body. multipart
// form: text, tag (optional), memberIds (optional JSON array), photo (optional).
journalRoutes.post('/api/journal', requireMobileAuth, uploadJournalPhoto, async (req, res) => {
  const text = (req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (text.length > 2000) return res.status(400).json({ error: 'text is too long' });
  const tag = (req.body?.tag || '').trim() || null;
  if (tag && !TAGS.includes(tag)) return res.status(400).json({ error: `unknown tag "${tag}"` });
  const memberIds = parseMemberIds(req.body?.memberIds);
  if (memberIds === null) return res.status(400).json({ error: 'invalid memberIds' });
  // Resized/recompressed here (not in multer) so a bad photo can't leave an
  // orphaned file behind if an earlier validation above had failed instead.
  const photoPath = req.file ? await saveJournalPhoto(req.file.buffer) : null;
  const entry = createEntry({
    authorId: req.memberId,
    text,
    tag,
    photoPath,
    memberIds,
    localDate: localDateStr()
  });
  publish('journal');
  res.json({ ok: true, entry });
});

// Self-service edit — only the original poster can edit their own entry
// (checked inside updateEntry via authorId, never trusted from the body).
journalRoutes.post('/api/journal/:id/edit', requireMobileAuth, (req, res) => {
  const id = Number(req.params.id);
  const text = (req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (text.length > 2000) return res.status(400).json({ error: 'text is too long' });
  const tag = (req.body?.tag || '').trim() || null;
  if (tag && !TAGS.includes(tag)) return res.status(400).json({ error: `unknown tag "${tag}"` });
  const memberIds = req.body?.memberIds;
  if (memberIds && (!Array.isArray(memberIds) || !memberIds.every((m) => MEMBER_IDS.includes(m)))) {
    return res.status(400).json({ error: 'invalid memberIds' });
  }
  const entry = updateEntry(id, req.memberId, { text, tag, memberIds });
  if (!entry) return res.status(404).json({ error: 'entry not found' });
  publish('journal');
  res.json({ ok: true, entry });
});

// Self-service delete — same author check as edit. Cleans up the photo file
// on disk (if any) so deleted entries don't leak orphaned blobs.
journalRoutes.post('/api/journal/:id/delete', requireMobileAuth, async (req, res) => {
  const id = Number(req.params.id);
  const photoPath = deleteEntry(id, req.memberId);
  if (photoPath === null) return res.status(404).json({ error: 'entry not found' });
  if (photoPath) await unlink(join(JOURNAL_PHOTOS_DIR, photoPath)).catch(() => {});
  publish('journal');
  res.json({ ok: true });
});

// Tap-to-heart on the wall — anonymous, like every other on-wall tap (no
// login there by design). A plain increment, not a per-member toggle.
journalRoutes.post('/api/journal/:id/heart', (req, res) => {
  const hearts = heartEntry(Number(req.params.id));
  if (hearts === null) return res.status(404).json({ error: 'entry not found' });
  publish('journal');
  res.json({ ok: true, hearts });
});

journalRoutes.use('/api/journal/img', express.static(JOURNAL_PHOTOS_DIR));
