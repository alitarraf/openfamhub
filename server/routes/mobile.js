/* Companion PWA (mobile) — view + complete Routine·Chore only for now.
 * The wall stays login-free (trusted kiosk); this is the one surface that
 * needs a PIN, since a phone isn't a shared trusted device. See auth.js. */
import { Router } from 'express';
import { taskProvider } from '../providers/registry.js';
import { members } from '../config/members.js';
import {
  checkLogin,
  sessionMember,
  destroySession,
  getSessionCookie,
  setSessionCookie,
  clearSessionCookie,
  requireMobileAuth
} from '../auth.js';
import { getAllBalances, awardChore, revertChore } from '../economy/index.js';
import { localDateStr } from '../util/dates.js';
import { publish } from '../util/bus.js';
import { BOARD_PROJECTS } from './tasks.js';

const { fetchBoard, setTaskDone, hasToken } = taskProvider;

export const mobileRoutes = Router();

mobileRoutes.post('/api/mobile/login', (req, res) => {
  const { memberId, pin } = req.body || {};
  const result = checkLogin(memberId, pin);
  if (!result.ok) return res.status(401).json({ error: result.error });
  setSessionCookie(res, result.sessionId);
  res.json({ memberId: result.memberId });
});

mobileRoutes.post('/api/mobile/logout', (req, res) => {
  destroySession(getSessionCookie(req));
  clearSessionCookie(res);
  res.json({ ok: true });
});

mobileRoutes.get('/api/mobile/me', (req, res) => {
  const memberId = sessionMember(getSessionCookie(req));
  if (!memberId) return res.status(401).json({ error: 'not logged in' });
  res.json({ memberId });
});

// Only the logged-in session's own tasks/balance — memberId comes from the
// session, never the request, so a phone can only act as whoever logged in.
mobileRoutes.get('/api/mobile/chores', requireMobileAuth, async (req, res) => {
  const project = BOARD_PROJECTS.routine();
  if (!project) return res.status(503).json({ error: 'routine board project not configured' });
  if (!hasToken()) return res.status(503).json({ error: 'TODOIST_TOKEN not set' });
  try {
    const board = await fetchBoard(project, members(), { withCompleted: true });
    const mine = board.members.find((m) => m.id === req.memberId);
    res.json({ tasks: mine ? mine.tasks : [], balance: getAllBalances([req.memberId])[req.memberId] });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

mobileRoutes.post('/api/mobile/chores/:id/:action', requireMobileAuth, async (req, res) => {
  const { id, action } = req.params;
  if (action !== 'close' && action !== 'reopen') {
    return res.status(400).json({ error: `unknown action "${action}"` });
  }
  if (!hasToken()) return res.status(503).json({ error: 'TODOIST_TOKEN not set' });
  try {
    await setTaskDone(id, action === 'close');
    const date = localDateStr();
    const balance = action === 'close' ? awardChore(req.memberId, id, date) : revertChore(req.memberId, id, date);
    publish('economy');
    res.json({ ok: true, balance });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});
