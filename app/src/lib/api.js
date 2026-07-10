// Thin backend client for the read-only data API (server/index.js).
//
// Every call takes a `fallback` (the bundled mock) and returns it on any
// failure — unconfigured source, 4xx/5xx, network/backend down. This keeps the
// wall fully rendering with zero creds: screens init from mock, then hydrate.

async function getJson(path) {
  const res = await fetch(path);
  if (!res.ok) {
    const err = new Error(`${path} -> ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function postJson(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

/**
 * Open tasks for a dashboard list ('chores' | 'groceries').
 * Returns { items: [{ id?, title, done }], count? } or the fallback mock.
 */
export async function getTasks(list, fallback) {
  try {
    return await getJson(`/api/tasks/${list}`);
  } catch (err) {
    console.warn(`[api] getTasks(${list}) → mock fallback:`, err.message);
    return fallback;
  }
}

/** Current conditions + week strip: { today, week }, or the fallback mock. */
export async function getWeather(fallback) {
  try {
    return await getJson('/api/weather');
  } catch (err) {
    console.warn('[api] getWeather → mock fallback:', err.message);
    return fallback;
  }
}

/**
 * Per-member task board ('todo' | 'routine') → { members: [{ id, tasks }] }.
 * Returns null on any failure (no creds / no assignees / Todoist down) so the
 * Tasks screens keep their full mock cards unchanged.
 */
export async function getBoard(board) {
  try {
    return await getJson(`/api/board/${board}`);
  } catch (err) {
    console.warn(`[api] getBoard(${board}) → keep mock:`, err.message);
    return null;
  }
}

/**
 * Close/reopen a real Todoist task (tap-to-complete write path). Returns true on
 * success, false on any failure so callers can revert an optimistic toggle. Only
 * call with a real Todoist id — mock rows have none and stay local-only.
 */
export async function setTaskDone(id, done) {
  try {
    const res = await fetch(`/api/tasks/${id}/${done ? 'close' : 'reopen'}`, { method: 'POST' });
    return res.ok;
  } catch (err) {
    console.warn(`[api] setTaskDone(${id}) failed:`, err.message);
    return false;
  }
}

/**
 * The family roster: [{ id, name, color }], any size. Returns null on any
 * failure so callers keep their bundled mock roster unchanged.
 */
export async function getMembers() {
  try {
    return await getJson('/api/members');
  } catch (err) {
    console.warn('[api] getMembers → keep mock roster:', err.message);
    return null;
  }
}

/** Per-member avatar URLs { memberId: url } from Todoist, or {} on any failure. */
export async function getAvatars() {
  try {
    return await getJson('/api/avatars');
  } catch (err) {
    console.warn('[api] getAvatars → no photos:', err.message);
    return {};
  }
}

/** Budget snapshot { updated, demo, budgets }, or the fallback mock. */
/** `period`: 'month' (default) | 'last' | 'ytd'. Falls back to the mock on
 * any failure — including 503 for 'last'/'ytd' when that period just hasn't
 * been captured by the sidecar yet, a real state, not only a "down" one.
 * Rethrows on 401 (`err.locked = true`) instead of falling back — that means
 * "not unlocked yet", which BudgetScreen shows a PIN gate for, not mock data. */
export async function getBudget(fallback, period = 'month') {
  try {
    return await getJson(`/api/budget?period=${period}`);
  } catch (err) {
    if (err.status === 401) {
      err.locked = true;
      throw err;
    }
    console.warn(`[api] getBudget(${period}) → mock fallback:`, err.message);
    return fallback;
  }
}

/** Settings (parent-gated read — same unlock as Budget). Rethrows 401 with
 * `err.locked = true` so the Settings screen shows its PIN gate; any other
 * failure returns the fallback like every read in this file. */
export async function getSettings(fallback) {
  try {
    return await getJson('/api/settings');
  } catch (err) {
    if (err.status === 401) {
      err.locked = true;
      throw err;
    }
    console.warn('[api] getSettings → fallback:', err.message);
    return fallback;
  }
}

/** Save settings (parent-gated). Returns { ok, settings?, error? }. */
export async function saveSettings(partial) {
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial)
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, locked: res.status === 401, error: data.error || 'Save failed' };
    return { ok: true, settings: data };
  } catch (err) {
    console.warn('[api] saveSettings failed:', err.message);
    return { ok: false, error: 'Connection failed' };
  }
}

/** Unlock the wall's Budget tab (and Settings — same parent gate) with a
 * parent's PIN. Returns { ok, error? }. */
export async function unlockBudget(memberId, pin) {
  try {
    const res = await fetch('/api/budget/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, pin })
    });
    const data = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: data.error || 'Wrong PIN' };
  } catch (err) {
    console.warn('[api] unlockBudget failed:', err.message);
    return { ok: false, error: 'Connection failed' };
  }
}

/**
 * Babysitter mode — lock state + emergency info the wall shows a sitter:
 * { active, parents:[{id,name,color,phone}], contacts:[{name,phone}], notes }.
 * Public read with a safe empty fallback, like every other read here — the
 * wall must render even with the backend down (it just won't be locked).
 */
export async function getBabysitter(fallback) {
  try {
    return await getJson('/api/babysitter');
  } catch (err) {
    console.warn('[api] getBabysitter → fallback:', err.message);
    return fallback;
  }
}

/** Enter babysitter lock mode (one tap, no PIN). Returns the new state or null. */
export async function enterBabysitterMode() {
  try {
    return await postJson('/api/babysitter/lock', {});
  } catch (err) {
    console.warn('[api] enterBabysitterMode failed:', err.message);
    return null;
  }
}

/** Leave babysitter mode with a parent's PIN. Returns { ok, error? }. */
export async function exitBabysitterMode(memberId, pin) {
  try {
    const res = await fetch('/api/babysitter/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, pin })
    });
    const data = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: data.error || 'Wrong PIN' };
  } catch (err) {
    console.warn('[api] exitBabysitterMode failed:', err.message);
    return { ok: false, error: 'Connection failed' };
  }
}

/** Save the babysitter emergency info (PWA, parent-gated). Returns
 * { ok, state?, locked?, error? } — mirrors saveSettings. */
export async function saveBabysitter(info) {
  try {
    const res = await fetch('/api/babysitter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(info)
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, locked: res.status === 401, error: data.error || 'Save failed' };
    return { ok: true, state: data };
  } catch (err) {
    console.warn('[api] saveBabysitter failed:', err.message);
    return { ok: false, error: 'Connection failed' };
  }
}

/**
 * Journal entries + the "on this day" callback + tag catalog:
 * { entries, onThisDay, tags }. Returns the fallback mock on any failure —
 * unconfigured/first-run is a real state here (no external source to be
 * "down", just possibly zero entries yet), same fallback contract as the rest.
 */
export async function getJournal(fallback) {
  try {
    return await getJson('/api/journal');
  } catch (err) {
    console.warn('[api] getJournal → mock fallback:', err.message);
    return fallback;
  }
}

/** Tap-to-heart on the wall — anonymous, like tap-to-complete. Returns the
 * new count, or null on failure (caller just doesn't update optimistically). */
export async function heartJournalEntry(id) {
  try {
    const res = await fetch(`/api/journal/${id}/heart`, { method: 'POST' });
    if (!res.ok) return null;
    return (await res.json()).hearts;
  } catch (err) {
    console.warn(`[api] heartJournalEntry(${id}) failed:`, err.message);
    return null;
  }
}

/**
 * Weekly meal plan for [start, end] ('YYYY-MM-DD' strings). Returns
 * { slots, days: { date: [cell,...] } } from Mealie, or the fallback mock on any
 * failure (Mealie unconfigured / not running / down).
 */
export async function getMealPlan(start, end, fallback) {
  try {
    return await getJson(`/api/mealplan?start=${start}&end=${end}`);
  } catch (err) {
    console.warn('[api] getMealPlan → mock fallback:', err.message);
    return fallback;
  }
}

/**
 * Calendar events in [start, end] (Date objects). Returns { events }.
 * Unlike the others this THROWS on failure — the event store decides whether to
 * fall back to its mock day-of-month source (see events.svelte.js).
 */
export async function getCalendar(start, end) {
  const qs = `start=${start.toISOString()}&end=${end.toISOString()}`;
  return getJson(`/api/calendar?${qs}`);
}

/**
 * Recipe library list: [{ id, slug, title, img, time, description }], or []
 * on any failure. No mock fallback here — a fabricated recipe list would be
 * worse than an empty one (tapping into it shows fake ingredients).
 */
export async function getRecipes() {
  try {
    return await getJson('/api/recipes');
  } catch (err) {
    console.warn('[api] getRecipes → empty:', err.message);
    return [];
  }
}

/** Single recipe detail, or null on any failure (unknown slug / Mealie down). */
export async function getRecipe(slug) {
  try {
    return await getJson(`/api/recipes/${encodeURIComponent(slug)}`);
  } catch (err) {
    console.warn(`[api] getRecipe(${slug}) → null:`, err.message);
    return null;
  }
}

/** Add a recipe's ingredients to the grocery list. Returns true on success. */
export async function addRecipeToGrocery(recipeId) {
  try {
    const res = await fetch(`/api/recipes/${recipeId}/add-to-grocery`, { method: 'POST' });
    return res.ok;
  } catch (err) {
    console.warn(`[api] addRecipeToGrocery(${recipeId}) failed:`, err.message);
    return false;
  }
}

/** Assign a recipe to a day/slot in the meal plan. Returns true on success. */
export async function addRecipeToMealPlan(recipeId, date, slot) {
  try {
    const res = await fetch(`/api/recipes/${recipeId}/add-to-mealplan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, slot })
    });
    return res.ok;
  } catch (err) {
    console.warn(`[api] addRecipeToMealPlan(${recipeId}) failed:`, err.message);
    return false;
  }
}

/**
 * Grocery list (Mealie's shopping list): { items:[{id,title,done}], count, left },
 * or the fallback mock on any failure.
 */
export async function getGroceryList(fallback) {
  try {
    return await getJson('/api/grocery');
  } catch (err) {
    console.warn('[api] getGroceryList → mock fallback:', err.message);
    return fallback;
  }
}

/**
 * Check/uncheck a grocery item (tap-to-complete write path). Returns true on
 * success, false on any failure so callers can revert an optimistic toggle.
 */
export async function setGroceryItemDone(id, done) {
  try {
    const res = await fetch(`/api/grocery/${id}/${done ? 'close' : 'reopen'}`, { method: 'POST' });
    return res.ok;
  } catch (err) {
    console.warn(`[api] setGroceryItemDone(${id}) failed:`, err.message);
    return false;
  }
}

/**
 * Close/reopen a Routine·Chore task — same write as setTaskDone, but through
 * the points-aware route (awards/reverts a point; To-do/Grocery never do).
 * Returns { ok, balance } — balance is the member's new total on success.
 */
export async function setChoreDone(id, done, memberId) {
  try {
    return await postJson(`/api/board/routine/${id}/${done ? 'close' : 'reopen'}`, { memberId });
  } catch (err) {
    console.warn(`[api] setChoreDone(${id}) failed:`, err.message);
    return { ok: false, balance: null };
  }
}

/** Screensaver photo filenames (data/photos/), or [] on failure/empty folder. */
export async function getPhotos() {
  try {
    const r = await getJson('/api/photos');
    return r.files || [];
  } catch (err) {
    console.warn('[api] getPhotos → []:', err.message);
    return [];
  }
}

/** { dad: N, mom: N, ... } per-member point balances, or null on failure. */
export async function getBalances() {
  try {
    return await getJson('/api/balances');
  } catch (err) {
    console.warn('[api] getBalances → null:', err.message);
    return null;
  }
}

/** { dad: N, mom: N, ... } per-member points earned today, or null on failure. */
export async function getTodayStars() {
  try {
    return await getJson('/api/balances/today');
  } catch (err) {
    console.warn('[api] getTodayStars → null:', err.message);
    return null;
  }
}

/**
 * Reward catalog + who's working toward what + balances, in one call.
 * Returns null on failure — no mock fallback (see getRecipes: a fabricated
 * catalog would be worse than an empty one).
 */
export async function getRewards() {
  try {
    return await getJson('/api/rewards');
  } catch (err) {
    console.warn('[api] getRewards → null:', err.message);
    return null;
  }
}

/** Add/remove a catalog reward from a member's "working toward" list. */
export async function assignReward(rewardId, memberId) {
  try {
    const r = await postJson(`/api/rewards/${rewardId}/assign`, { memberId });
    return r.ok;
  } catch (err) {
    console.warn(`[api] assignReward(${rewardId}) failed:`, err.message);
    return false;
  }
}
export async function unassignReward(rewardId, memberId) {
  try {
    const r = await postJson(`/api/rewards/${rewardId}/unassign`, { memberId });
    return r.ok;
  } catch (err) {
    console.warn(`[api] unassignReward(${rewardId}) failed:`, err.message);
    return false;
  }
}

/** Redeem a reward. Returns { ok, balance } — ok is false on insufficient balance too. */
export async function redeemReward(rewardId, memberId) {
  try {
    return await postJson(`/api/rewards/${rewardId}/redeem`, { memberId });
  } catch (err) {
    console.warn(`[api] redeemReward(${rewardId}) failed:`, err.message);
    return { ok: false, balance: null };
  }
}

/** Hide or show a reward (built-in or custom) from the wall's Manage view.
 * No keyboard needed, so it's ungated like assign/unassign. Returns true on
 * success. Creating/editing/naming a reward is PWA-only (that's typing). */
export async function setRewardHidden(rewardId, hidden) {
  try {
    const r = await postJson(`/api/rewards/${rewardId}/hide`, { hidden });
    return r.ok;
  } catch (err) {
    console.warn(`[api] setRewardHidden(${rewardId}) failed:`, err.message);
    return false;
  }
}
