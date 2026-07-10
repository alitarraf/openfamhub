/* Read-only display sources — avatars, weather, screensaver photos, calendar,
 * and the PIN-gated budget snapshot. */
import express, { Router } from 'express';
import {
  taskProvider,
  calendarProvider,
  budgetProvider,
  weatherProvider,
  photosProvider
} from '../providers/registry.js';
import { members } from '../config/members.js';
import { unlockBudget, setBudgetCookie, requireBudgetAuth } from '../auth.js';

const { fetchAvatars } = taskProvider;
const { fetchWeather } = weatherProvider;
const { fetchEvents } = calendarProvider;
const { fetchBudgetPeriod } = budgetProvider;
const { listPhotos, PHOTOS_DIR } = photosProvider;

export const sourceRoutes = Router();

// Per-member avatar URLs { memberId: cdnUrl } sourced from Todoist (Sync API).
// Purely cosmetic: any failure returns {} (never 503) so chips fall back to
// monograms without disturbing the wall.
sourceRoutes.get('/api/avatars', async (_req, res) => {
  try {
    res.json(await fetchAvatars(members()));
  } catch {
    res.json({});
  }
});

// Current conditions + 10-day strip (Open-Meteo). 503 -> client mock.
sourceRoutes.get('/api/weather', async (_req, res) => {
  try {
    res.json(await fetchWeather());
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// Screensaver photo slideshow — local folder (data/photos/), not Google
// Photos (see server/sources/photos.js for why). Empty list on any failure /
// empty folder → client falls back to the decorative clock banner.
sourceRoutes.get('/api/photos', async (_req, res) => {
  res.json({ files: await listPhotos() });
});
sourceRoutes.use('/api/photos/img', express.static(PHOTOS_DIR));

// Calendar events in a window. ?start=&end= are ISO timestamps (defaults: a
// ~6-week window around now). 503 -> client keeps its mock event source.
sourceRoutes.get('/api/calendar', async (req, res) => {
  const now = Date.now();
  const start = req.query.start ? new Date(req.query.start) : new Date(now - 14 * 864e5);
  const end = req.query.end ? new Date(req.query.end) : new Date(now + 28 * 864e5);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return res.status(400).json({ error: 'invalid start/end' });
  }
  try {
    res.json(await fetchEvents(start, end));
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// Budget snapshot (read from the Monarch sidecar's JSON / history dir).
// ?period= month (default) | last | ytd. 503 if that period isn't
// captured yet — real/expected until the sidecar has run across a month
// boundary, not just an error state.
const BUDGET_PERIODS = ['month', 'last', 'ytd'];

// Budget is the one wall screen that isn't login-free — finances stay
// visible on the shared kitchen wall, but tapping in requires a parent PIN
// (BUDGET_UNLOCK_MEMBERS, default dad+mom) rather than the usual no-login
// tap-your-avatar flow. See auth.js.
sourceRoutes.post('/api/budget/unlock', (req, res) => {
  const { memberId, pin } = req.body || {};
  const result = unlockBudget(memberId, pin);
  if (!result.ok) return res.status(401).json({ error: result.error });
  setBudgetCookie(res, result.token);
  res.json({ ok: true });
});

sourceRoutes.get('/api/budget', requireBudgetAuth, async (req, res) => {
  const period = req.query.period || 'month';
  if (!BUDGET_PERIODS.includes(period)) {
    return res.status(400).json({ error: `unknown period "${period}"` });
  }
  try {
    res.json(await fetchBudgetPeriod(period));
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});
