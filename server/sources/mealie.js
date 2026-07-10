/* Mealie source — the self-hosted recipe manager / meal planner on the homelab PC.
 * Feeds the Meals screen: weekly meal-plan grid, recipe list/detail, and the
 * single grocery list (Mealie's shopping list is the one source of truth for
 * groceries — the old Todoist groceries project was retired in favor of this,
 * since only Mealie can link recipe ingredients into the list). Config comes
 * from the environment (token never reaches the client): MEALIE_URL, MEALIE_TOKEN.
 *
 * Endpoint paths below are verified against a live v3.20.1 instance (2026-07-01).
 *
 * The pure transform (mapMealPlan) is exported so it can be checked against a
 * fixture without network or creds (server/test/transforms.test.mjs).
 */
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const env = (k) => (process.env[k] || '').trim();
const cfg = () => ({
  url: env('MEALIE_URL').replace(/\/+$/, ''), // trim trailing slash
  token: env('MEALIE_TOKEN')
});

export const hasMealie = () => {
  const c = cfg();
  return !!(c.url && c.token);
};

// ⚠️ VERIFY against live Mealie — every string/path/field here is a guess until
// checked on the real instance. Centralized so verification is one edit.
export const MEALIE_API = {
  // Meal-plan entries in a date range. Mealie v1: /api/households/mealplans
  // (older builds: /api/groups/mealplans). Returns { items: [entry], ... } paged.
  mealplans: (start, end) => `/api/households/mealplans?start_date=${start}&end_date=${end}&perPage=200`,
  // Per-recipe thumbnail. Mealie pre-generates sizes; `min-original` is the small
  // one — proxy THAT (never full-res) so the Wyse never downscales.
  recipeImage: (id) => `/api/media/recipes/${id}/images/min-original.webp`,
  // Field accessors on a meal-plan entry.
  entryDate: (e) => e.date, //  'YYYY-MM-DD' (local calendar date)
  entryType: (e) => e.entryType, //  breakfast | lunch | dinner | side
  entryTitle: (e) => e.title || (e.recipe && e.recipe.name) || '',
  entryRecipeId: (e) => (e.recipe && e.recipe.id) || null,
  // Recipe library (read-only browse — recipe authoring stays in Mealie's own
  // UI; this app only assigns existing recipes to grocery/meal-plan).
  recipes: () => `/api/recipes?perPage=100&orderBy=name`,
  recipe: (slug) => `/api/recipes/${encodeURIComponent(slug)}`,
  mealplanCreate: () => `/api/households/mealplans`,
  mealplanEntry: (id) => `/api/households/mealplans/${id}`,
  // Groceries: a household has exactly one shopping list in our setup — we take
  // the first one returned rather than requiring a configured id.
  shoppingLists: () => `/api/households/shopping/lists?perPage=1`,
  shoppingItems: (listId) =>
    `/api/households/shopping/items?queryFilter=${encodeURIComponent(`shoppingListId="${listId}"`)}&perPage=200&orderBy=position`,
  shoppingItem: (itemId) => `/api/households/shopping/items/${itemId}`,
  addRecipeToList: (listId, recipeId) => `/api/households/shopping/lists/${listId}/recipe/${recipeId}`
};

// The four columns the wall shows, in order. Mealie's entry types are breakfast /
// lunch / dinner / side; we surface "side" under the Snack column — a conscious
// map so a `side` entry lands somewhere instead of silently vanishing.
export const SLOTS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'side', label: 'Snack' }
];
const SLOT_INDEX = Object.fromEntries(SLOTS.map((s, i) => [s.key, i]));

/**
 * Meal-plan entries -> { 'YYYY-MM-DD': [cell,cell,cell,cell] } keyed by date, each
 * value a 4-slot array aligned to SLOTS (null = empty slot). A cell is
 * { title, img } where img is our proxy path (client-safe, no token) or null.
 * Entries with an unknown type or missing date are skipped.
 */
export function mapMealPlan(items) {
  const byDate = {};
  for (const e of items || []) {
    const date = MEALIE_API.entryDate(e);
    const idx = SLOT_INDEX[MEALIE_API.entryType(e)];
    if (!date || idx == null) continue;
    if (!byDate[date]) byDate[date] = [null, null, null, null];
    const rid = MEALIE_API.entryRecipeId(e);
    byDate[date][idx] = {
      title: MEALIE_API.entryTitle(e),
      img: rid != null ? `/api/mealie/img/${rid}` : null,
      // Only meal-plan entries with a linked recipe (not a freeform title/text
      // note) can be tapped through to a recipe detail view.
      slug: rid != null && e.recipe ? e.recipe.slug : null
    };
  }
  return byDate;
}

async function getJson(path) {
  const c = cfg();
  const res = await fetch(`${c.url}${path}`, {
    headers: { Authorization: `Bearer ${c.token}`, Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`Mealie ${path.split('?')[0]} -> ${res.status}`);
  return res.json();
}

async function sendJson(method, path, body) {
  const c = cfg();
  const res = await fetch(`${c.url}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${c.token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`Mealie ${method} ${path.split('?')[0]} -> ${res.status}`);
  return res.status === 204 ? null : res.json();
}

/**
 * Live meal plan for [start, end] (ISO 'YYYY-MM-DD' strings).
 * Returns { slots: [label], days: { date: [cell,...] } }.
 * Throws if unconfigured or Mealie errors, so the route falls back to mock.
 */
export async function fetchMealPlan(start, end) {
  if (!hasMealie()) throw new Error('mealie not configured (url/token)');
  const json = await getJson(MEALIE_API.mealplans(start, end));
  const items = json.items || json.results || (Array.isArray(json) ? json : []);
  return { slots: SLOTS.map((s) => s.label), days: mapMealPlan(items) };
}

// --- image proxy + cache ----------------------------------------------------
// Cache Mealie's pre-sized thumbnails to the gitignored data/ dir. No eviction,
// no invalidation — family scale, staleness is fine (bust by deleting the file).
const IMG_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'mealie-img');

/**
 * Recipe thumbnail bytes, cache-first. Serves the cached file if present,
 * else fetches Mealie's min-original.webp, caches it, and returns the buffer.
 * Throws on a bad id or any upstream failure so the route can 404 (→ the
 * <img onerror> placeholder fires instead of a broken image).
 */
export async function fetchRecipeImage(recipeId) {
  const safe = String(recipeId).replace(/[^a-zA-Z0-9_-]/g, ''); // no path traversal
  if (!safe) throw new Error('bad recipe id');
  const file = join(IMG_DIR, `${safe}.webp`);
  try {
    return await fs.readFile(file); // cache hit
  } catch {
    /* miss → fetch below */
  }
  const c = cfg();
  if (!hasMealie()) throw new Error('mealie not configured (url/token)');
  const res = await fetch(`${c.url}${MEALIE_API.recipeImage(recipeId)}`, {
    headers: { Authorization: `Bearer ${c.token}` }
  });
  if (!res.ok) throw new Error(`Mealie image ${safe} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(IMG_DIR, { recursive: true });
  await fs.writeFile(file, buf);
  return buf;
}

// --- recipe library (read-only browse) --------------------------------------
// Mealie's `image` field ("no image" sentinel vs. an opaque hash) is meant to
// say whether a thumbnail exists, but it's unreliable: recipes created via the
// AI image-import feature can have a real image file on disk while this flag
// is still stuck at "no image" (confirmed directly against the media endpoint
// on a live instance). So we always point at the image proxy and let its
// existing 404 → <img onerror> fallback handle recipes that truly have none,
// rather than trusting this flag to decide.

/** Recipe list: [{ id, slug, title, img, time, description }]. */
export async function fetchRecipeList() {
  if (!hasMealie()) throw new Error('mealie not configured (url/token)');
  const json = await getJson(MEALIE_API.recipes());
  const items = json.items || [];
  return items.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.name,
    img: `/api/mealie/img/${r.id}`,
    time: r.totalTime || null,
    description: r.description || ''
  }));
}

/** Recipe detail: { id, title, img, servings, time, ingredients, instructions }. */
export async function fetchRecipeDetail(slug) {
  if (!hasMealie()) throw new Error('mealie not configured (url/token)');
  const r = await getJson(MEALIE_API.recipe(slug));
  return {
    id: r.id,
    slug: r.slug,
    title: r.name,
    img: `/api/mealie/img/${r.id}`,
    servings: r.recipeServings || null,
    time: r.totalTime || null,
    ingredients: (r.recipeIngredient || []).map((i) => i.display).filter(Boolean),
    instructions: (r.recipeInstructions || []).map((s) => s.text).filter(Boolean)
  };
}

// --- grocery list (single shared shopping list) ------------------------------
// The household has exactly one shopping list in our setup; cache its id for
// the process lifetime (re-resolved on a 404 in case it's ever recreated).
let shoppingListId = null;
async function getShoppingListId() {
  if (shoppingListId) return shoppingListId;
  const json = await getJson(MEALIE_API.shoppingLists());
  const list = (json.items || [])[0];
  if (!list) throw new Error('no Mealie shopping list found');
  shoppingListId = list.id;
  return shoppingListId;
}

/**
 * Grocery list in the same shape as the Todoist task lists it replaced:
 * { items: [{ id, title, done }], count, left }. Checked items are kept
 * (struck-through) rather than filtered, so a tap doesn't make the row vanish
 * mid-interaction — they accumulate until cleared from Mealie's own UI.
 */
export async function fetchGroceryList() {
  if (!hasMealie()) throw new Error('mealie not configured (url/token)');
  const listId = await getShoppingListId();
  const json = await getJson(MEALIE_API.shoppingItems(listId));
  const items = (json.items || []).map((it) => ({ id: it.id, title: it.display, done: it.checked }));
  const open = items.filter((i) => !i.done).length;
  return { items, count: `${open} item${open === 1 ? '' : 's'}`, left: `${open} left` };
}

/**
 * Flip a grocery item's checked state. Read-modify-write against Mealie's PUT
 * (which replaces the whole item) — fetch it fresh, flip `checked`, send the
 * rest back unchanged. Verified against a live instance: no duplicate items or
 * foods get created; Mealie's own PUT drops the item→recipe backlink
 * (`recipeReferences`) on any update regardless of what's sent — a Mealie
 * server-side quirk, not something this call can prevent.
 */
export async function setGroceryItemDone(id, done) {
  if (!hasMealie()) throw new Error('mealie not configured (url/token)');
  const item = await getJson(MEALIE_API.shoppingItem(id));
  const { id: _id, groupId: _g, householdId: _h, label: _l, createdAt: _c, updatedAt: _u, ...body } = item;
  await sendJson('PUT', MEALIE_API.shoppingItem(id), { ...body, checked: done });
}

/** Add a recipe's ingredients to the shared grocery list. */
export async function addRecipeToGroceryList(recipeId) {
  if (!hasMealie()) throw new Error('mealie not configured (url/token)');
  const listId = await getShoppingListId();
  await sendJson('POST', MEALIE_API.addRecipeToList(listId, recipeId), null);
}

/**
 * Assign a recipe to a day/slot in Mealie's own meal plan — this is the same
 * plan the weekly grid (fetchMealPlan) reads and Mealie's own UI shows, so an
 * entry added here shows up in both places, not just this app.
 *
 * Replace, not append: the grid shows one cell per day/slot, but Mealie's API
 * is pure create — POSTing a second entry for an already-occupied slot just
 * adds a sibling entry rather than swapping it, and mapMealPlan()'s last-one-
 * wins overwrite means the *old* entry can keep winning depending on Mealie's
 * return order (this is what looked like "changing the recipe did nothing").
 * So clear any existing entry for this exact date+slot first.
 */
export async function addRecipeToMealPlan(recipeId, date, entryType) {
  if (!hasMealie()) throw new Error('mealie not configured (url/token)');
  const json = await getJson(MEALIE_API.mealplans(date, date));
  const items = json.items || json.results || (Array.isArray(json) ? json : []);
  const existing = items.filter((e) => MEALIE_API.entryType(e) === entryType);
  for (const e of existing) {
    await sendJson('DELETE', MEALIE_API.mealplanEntry(e.id));
  }
  await sendJson('POST', MEALIE_API.mealplanCreate(), { date, entryType, recipeId });
}
