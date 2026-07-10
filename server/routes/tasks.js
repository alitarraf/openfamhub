/* Todoist-backed task routes — dashboard list, per-member boards, the
 * tap-to-complete write path, and the Routine·Chore variant that also moves
 * the points economy. */
import { Router } from 'express';
import { taskProvider } from '../providers/registry.js';
import { members, hasMembers } from '../config/members.js';
import { awardChore, revertChore } from '../economy/index.js';
import { localDateStr } from '../util/dates.js';
import { MEMBER_IDS } from '../util/roster.js';
import { publish } from '../util/bus.js';

const { fetchProjectTasks, fetchBoard, fetchCollaborators, setTaskDone, hasToken } = taskProvider;

// Maps a dashboard summary card to its Todoist project. The Home "To Do" card
// reuses the same project the To-do Tasks tab splits by assignee (flat list here,
// a summary — not per-member). Snapshot at load; `up -d` restarts to reload .env.
// Groceries moved to Mealie's shopping list (see routes/meals.js) — Mealie
// is the only source that can link recipe ingredients into the list.
const TODOIST_PROJECTS = {
  todos: process.env.TODOIST_TODO_PROJECT || ''
};

// Per-member task screens: each tab (board) draws from one shared Todoist project,
// split by assignee. Read at call-time so `docker compose up -d` reloads .env.
// (routes/mobile.js reuses the routine board.)
export const BOARD_PROJECTS = {
  todo: () => process.env.TODOIST_TODO_PROJECT || '',
  routine: () => process.env.TODOIST_ROUTINE_PROJECT || ''
};

export const taskRoutes = Router();

// Read-only task list for a dashboard card (todos). Groceries lives on Mealie
// now — see routes/meals.js.
// On any failure (no token, project missing, Todoist down) returns 503 with a
// reason; the client falls back to its bundled mock so the wall still renders.
taskRoutes.get('/api/tasks/:list', async (req, res) => {
  const { list } = req.params;
  if (!(list in TODOIST_PROJECTS)) {
    return res.status(404).json({ error: `unknown list "${list}"` });
  }
  // Require an explicit project per list; otherwise the source would fetch ALL
  // tasks. Unset → unconfigured → 503 so the client falls back to mock.
  if (!TODOIST_PROJECTS[list]) {
    return res.status(503).json({ error: `${list} project not configured` });
  }
  try {
    // To Do keeps a same-day record of completed items (clears at local midnight).
    const data = await fetchProjectTasks(TODOIST_PROJECTS[list], { withCompleted: list === 'todos' });
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// Per-member task board for a Tasks screen (todo | routine). One shared Todoist
// project split by assignee → { members: [{ id, tasks }] }. Needs the project
// AND at least one member UID mapped; otherwise 503 → client keeps its mock.
taskRoutes.get('/api/board/:board', async (req, res) => {
  const { board } = req.params;
  if (!(board in BOARD_PROJECTS)) {
    return res.status(404).json({ error: `unknown board "${board}"` });
  }
  const project = BOARD_PROJECTS[board]();
  if (!project) {
    return res.status(503).json({ error: `${board} board project not configured` });
  }
  if (!hasMembers()) {
    return res.status(503).json({ error: 'no member UIDs configured' });
  }
  try {
    // Both per-member boards (To-do, Routine·Chore) show today's completed items
    // struck through — a daily record that keeps the chore progress ring honest.
    res.json(await fetchBoard(project, members(), { withCompleted: true }));
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// Discovery helper: list collaborators (id/name/email) of the board projects so
// their Todoist UIDs can be pasted into .env (TODOIST_UID_*). Not a display feed.
taskRoutes.get('/api/todoist/collaborators', async (_req, res) => {
  const projects = [BOARD_PROJECTS.todo(), BOARD_PROJECTS.routine()].filter(Boolean);
  if (!hasToken()) return res.status(503).json({ error: 'TODOIST_TOKEN not set' });
  if (!projects.length) return res.status(503).json({ error: 'no board projects configured' });
  try {
    res.json({ projects: await fetchCollaborators(projects) });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// Tap-to-complete write path: close/reopen a Todoist task by id. The id comes
// from a live board fetch (mock rows carry none, so the client never calls
// this for them). 502 on Todoist error → client reverts.
taskRoutes.post('/api/tasks/:id/:action', async (req, res) => {
  const { id, action } = req.params;
  if (action !== 'close' && action !== 'reopen') {
    return res.status(400).json({ error: `unknown action "${action}"` });
  }
  if (!hasToken()) return res.status(503).json({ error: 'TODOIST_TOKEN not set' });
  try {
    await setTaskDone(id, action === 'close');
    publish('tasks');
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Routine·Chore tap-to-complete: closes/reopens the Todoist task (same as
// /api/tasks/:id/:action) AND awards/reverts a point — only Routine·Chore
// touches the economy (To-do and Grocery don't). Body: { memberId }.
taskRoutes.post('/api/board/routine/:id/:action', async (req, res) => {
  const { id, action } = req.params;
  const { memberId } = req.body || {};
  if (action !== 'close' && action !== 'reopen') {
    return res.status(400).json({ error: `unknown action "${action}"` });
  }
  if (!MEMBER_IDS.includes(memberId)) {
    return res.status(400).json({ error: `unknown memberId "${memberId}"` });
  }
  if (!hasToken()) return res.status(503).json({ error: 'TODOIST_TOKEN not set' });
  try {
    await setTaskDone(id, action === 'close');
    const date = localDateStr();
    const balance = action === 'close' ? awardChore(memberId, id, date) : revertChore(memberId, id, date);
    publish('economy');
    res.json({ ok: true, balance });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});
