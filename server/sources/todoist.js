/* Todoist source — server-side Todoist REST access.
 *
 * The token comes from the TODOIST_TOKEN environment variable, never from the
 * client.
 *
 * Todoist unified API v1. The old /rest/v2 endpoints now return HTTP 410.
 */
const API = 'https://api.todoist.com/api/v1';

const token = () => (process.env.TODOIST_TOKEN || '').trim();

export const hasToken = () => token().length > 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiGet(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token()}` }
  });
  if (!res.ok) throw new Error(`Todoist GET ${path} -> ${res.status}`);
  const json = await res.json();
  // v1 wraps collections as { results: [...], next_cursor }. Unwrap to an array.
  return Array.isArray(json) ? json : json.results || json;
}

// Todoist avatar CDN (image_id -> square jpg). Sizes: small/medium/big/s640.
const AVATAR_CDN = 'https://dcff1xvirvpfp.cloudfront.net';

// Start of "today" in the server's local timezone, as a UTC instant. The
// container sets TZ (America/Portland), and Node's Date methods honor it, so
// setHours(0,...) lands on *local* midnight — the cutoff for "completed today",
// which makes the day's record clear at local midnight, not UTC midnight.
function todayStartISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Tasks in a project completed since local midnight — the "record of what got
 * done today". Todoist's completed feed isn't project-scoped, so filter here
 * (family-scale volume is tiny). Returns raw Todoist task objects; the `id` on
 * each equals the live task id, so it stays closeable/reopenable.
 */
async function fetchCompletedToday(projectId) {
  const params = new URLSearchParams({ since: todayStartISO(), until: new Date().toISOString() });
  const res = await fetch(`${API}/tasks/completed/by_completion_date?${params}`, {
    headers: { Authorization: `Bearer ${token()}` }
  });
  if (!res.ok) throw new Error(`Todoist completed -> ${res.status}`);
  const data = await res.json();
  const items = data.items || data.results || [];
  return items.filter((t) => String(t.project_id) === String(projectId));
}

// name(lower) -> id, resolved lazily and cached for the process lifetime.
let projectCache = null;
async function resolveProjectId(projectName) {
  if (!projectName) return null;
  if (!projectCache) {
    const projects = await apiGet('/projects');
    projectCache = {};
    projects.forEach((p) => {
      projectCache[p.name.toLowerCase()] = p.id;
    });
  }
  return projectCache[projectName.toLowerCase()] || null;
}

/**
 * Fetch tasks for a Todoist project. Returns the read-only shape the dashboard
 * cards consume: { items: [{ id, title, done }], count, left }.
 * Open tasks come first; with `withCompleted`, tasks completed since local
 * midnight are appended as `done:true` (a same-day record that clears overnight).
 * `count`/`left` count OPEN items only. Throws if the project can't be resolved.
 */
export async function fetchProjectTasks(projectName, { withCompleted = false } = {}) {
  if (!hasToken()) throw new Error('TODOIST_TOKEN not set');

  let path = '/tasks';
  let pid = null;
  if (projectName) {
    pid = await resolveProjectId(projectName);
    if (!pid) throw new Error(`Todoist project "${projectName}" not found`);
    path += `?project_id=${pid}`;
  }
  const tasks = await apiGet(path);
  // v1 tasks order by `child_order` (older API used `order`).
  tasks.sort((a, b) => (a.child_order ?? a.order ?? 0) - (b.child_order ?? b.order ?? 0));
  const open = tasks.map((t) => ({ id: t.id, title: t.content, done: false }));

  let done = [];
  if (withCompleted && pid) {
    const completed = await fetchCompletedToday(pid);
    completed.sort((a, b) => (a.completed_at < b.completed_at ? -1 : 1));
    done = completed.map((t) => ({ id: t.id, title: t.content, done: true }));
  }
  return {
    items: [...open, ...done],
    count: `${open.length} item${open.length === 1 ? '' : 's'}`,
    left: `${open.length} left today`
  };
}

/**
 * Pure transform: bucket a project's tasks by family member using each member's
 * Todoist assignee id. Tasks assigned to nobody (or to an unmapped collaborator)
 * are dropped. Returns one entry per member, in roster order, even if empty:
 *   [{ id:'dad', tasks:[{ id, title, done }] }, ...]
 * Open tasks (done:false) come first in each bucket, then `completed` (done:true,
 * completed today) — a same-day record. The assignee field is `responsible_uid`
 * on v1; older shapes used `assignee_id`.
 */
export function groupByAssignee(open, completed, members) {
  const uidToMember = {};
  for (const m of members) if (m.uid) uidToMember[String(m.uid)] = m.id;

  const buckets = new Map(members.map((m) => [m.id, []]));
  const place = (t, done) => {
    const uid = t.responsible_uid ?? t.assignee_id ?? t.responsibleUid ?? null;
    const memberId = uid != null ? uidToMember[String(uid)] : undefined;
    if (memberId) buckets.get(memberId).push({ id: t.id, title: t.content, done });
  };

  [...open]
    .sort((a, b) => (a.child_order ?? a.order ?? 0) - (b.child_order ?? b.order ?? 0))
    .forEach((t) => place(t, false));
  [...completed].sort((a, b) => (a.completed_at < b.completed_at ? -1 : 1)).forEach((t) => place(t, true));

  return members.map((m) => ({ id: m.id, tasks: buckets.get(m.id) }));
}

/**
 * Fetch one shared project and split it into per-member task lists by assignee.
 * `members` is the roster from config/members.js. With `withCompleted`, each
 * member's list also carries what they completed today (done:true, struck
 * through in the UI). Returns { members: [...] }. Throws so the route can 503.
 */
export async function fetchBoard(projectName, members, { withCompleted = false } = {}) {
  if (!hasToken()) throw new Error('TODOIST_TOKEN not set');
  const pid = await resolveProjectId(projectName);
  if (!pid) throw new Error(`Todoist project "${projectName}" not found`);
  const open = await apiGet(`/tasks?project_id=${pid}`);
  const completed = withCompleted ? await fetchCompletedToday(pid) : [];
  return { members: groupByAssignee(open, completed, members) };
}

/**
 * List collaborators (id, name, email) for each named project — the discovery
 * helper for filling in members.js UIDs once the token is set. Never exposes the
 * token; ids/emails are only reachable by someone who already holds it.
 */
export async function fetchCollaborators(projectNames) {
  if (!hasToken()) throw new Error('TODOIST_TOKEN not set');
  const out = [];
  for (const name of projectNames) {
    const pid = await resolveProjectId(name);
    if (!pid) {
      out.push({ project: name, error: 'project not found' });
      continue;
    }
    const collab = await apiGet(`/projects/${pid}/collaborators`);
    out.push({
      project: name,
      collaborators: collab.map((c) => ({ id: c.id, name: c.name, email: c.email }))
    });
  }
  return out;
}

/**
 * Tap-to-complete write path: close (`done=true`) or reopen a task by id.
 * The only mutating call in this module. Both endpoints return 204 on success.
 * Throws on any non-2xx so the route/client can revert an optimistic toggle.
 *
 * Retries transient failures (network/DNS blips, 5xx) a couple of times with a
 * short backoff so a sub-second hiccup doesn't silently revert a tap. The
 * container's `dns:` override is the real fix for the recurring `ENOTFOUND`;
 * this is defense-in-depth for whatever slips through. The write is idempotent
 * enough to retry safely: the dangerous case is a request that lands
 * server-side but whose response we lose — on the retry the task is already in
 * the target state, so Todoist 404s it ("not an active task"), which we treat
 * as success *only after* we've already seen a transient failure.
 */
export async function setTaskDone(id, done) {
  if (!hasToken()) throw new Error('TODOIST_TOKEN not set');
  const action = done ? 'close' : 'reopen';
  const url = `${API}/tasks/${id}/${action}`;
  const attempts = 3;
  let sawTransient = false;
  for (let i = 1; i <= attempts; i++) {
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
    } catch (err) {
      // Network-level failure (DNS ENOTFOUND/EAI_AGAIN, ECONNRESET, timeout).
      sawTransient = true;
      if (i < attempts) {
        await sleep(300 * i);
        continue;
      }
      throw err;
    }
    if (res.ok) return;
    // Already in the target state after an earlier attempt likely landed — the
    // request succeeded, we just lost the ack. Don't report a spurious failure.
    if (res.status === 404 && sawTransient) return;
    // 5xx is worth another try; 4xx is deterministic (bad id/token) — surface it.
    if (res.status >= 500 && i < attempts) {
      sawTransient = true;
      await sleep(300 * i);
      continue;
    }
    throw new Error(`Todoist ${action} ${id} -> ${res.status}`);
  }
}

/**
 * Per-member avatar URLs { memberId: cdnUrl } from Todoist's Sync API, which
 * (unlike the REST collaborators endpoint) carries each user's `image_id`.
 * `members` is the roster from config/members.js; members without a mapped uid or
 * without a photo set are simply omitted (the chip falls back to a monogram).
 * Purely cosmetic — the route swallows failures to {}.
 */
export async function fetchAvatars(members) {
  if (!hasToken()) throw new Error('TODOIST_TOKEN not set');
  const res = await fetch(`${API}/sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ sync_token: '*', resource_types: '["collaborators","user"]' })
  });
  if (!res.ok) throw new Error(`Todoist sync -> ${res.status}`);
  const data = await res.json();

  // uid(string) -> image_id, from every collaborator plus the token owner (self),
  // so the account holder's photo is covered even if a project omits self.
  const imageByUid = {};
  for (const c of data.collaborators || []) if (c.image_id) imageByUid[String(c.id)] = c.image_id;
  if (data.user?.image_id) imageByUid[String(data.user.id)] = data.user.image_id;

  const out = {};
  for (const m of members) {
    const img = m.uid ? imageByUid[String(m.uid)] : null;
    if (img) out[m.id] = `${AVATAR_CDN}/${img}_big.jpg`;
  }
  return out;
}
