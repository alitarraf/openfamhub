/* Meals (Mealie) — weekly plan, recipe library, thumbnail proxy, and the
 * single shared grocery list. */
import { Router } from 'express';
import { mealsProvider } from '../providers/registry.js';
import { publish } from '../util/bus.js';

const {
  fetchMealPlan,
  fetchRecipeImage,
  fetchRecipeList,
  fetchRecipeDetail,
  fetchGroceryList,
  setGroceryItemDone,
  addRecipeToGroceryList,
  addRecipeToMealPlan,
  SLOTS,
  hasMealie
} = mealsProvider;

export const mealRoutes = Router();

// Weekly meal plan (Mealie). ?start=&end= are ISO 'YYYY-MM-DD' dates.
// Returns { slots, days:{ date: [cell,...] } }. 503 -> client falls back to the
// mock menu so the grid still fills.
mealRoutes.get('/api/mealplan', async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: 'start & end required (YYYY-MM-DD)' });
  }
  if (!hasMealie()) return res.status(503).json({ error: 'MEALIE not configured' });
  try {
    res.json(await fetchMealPlan(start, end));
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// Recipe thumbnail proxy + cache. Serves Mealie's pre-sized image (cached to
// data/), keeping the token server-side and the Wyse out of image processing.
// 404 on any miss/failure so the client's <img onerror> placeholder fires.
mealRoutes.get('/api/mealie/img/:id', async (req, res) => {
  try {
    const buf = await fetchRecipeImage(req.params.id);
    res.type('image/webp').set('Cache-Control', 'public, max-age=86400').send(buf);
  } catch {
    res.status(404).end();
  }
});

// Recipe library (read-only browse — authoring stays in Mealie's own UI).
mealRoutes.get('/api/recipes', async (_req, res) => {
  if (!hasMealie()) return res.status(503).json({ error: 'MEALIE not configured' });
  try {
    res.json(await fetchRecipeList());
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

mealRoutes.get('/api/recipes/:slug', async (req, res) => {
  if (!hasMealie()) return res.status(503).json({ error: 'MEALIE not configured' });
  try {
    res.json(await fetchRecipeDetail(req.params.slug));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Add a recipe's ingredients to the shared grocery list (one-tap from the
// recipe detail view). Needs the recipe's Mealie id, not its slug.
mealRoutes.post('/api/recipes/:id/add-to-grocery', async (req, res) => {
  if (!hasMealie()) return res.status(503).json({ error: 'MEALIE not configured' });
  try {
    await addRecipeToGroceryList(req.params.id);
    publish('meals');
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// Assign a recipe to a day/slot in Mealie's own meal plan. Body: { date, slot }
// — date is 'YYYY-MM-DD', slot is one of SLOTS' keys (breakfast|lunch|dinner|
// side). Syncs with Mealie itself, not just this app's grid.
const SLOT_KEYS = SLOTS.map((s) => s.key);
mealRoutes.post('/api/recipes/:id/add-to-mealplan', async (req, res) => {
  if (!hasMealie()) return res.status(503).json({ error: 'MEALIE not configured' });
  const { date, slot } = req.body || {};
  if (!date || !SLOT_KEYS.includes(slot)) {
    return res.status(400).json({ error: `date and a slot in [${SLOT_KEYS.join(', ')}] are required` });
  }
  try {
    await addRecipeToMealPlan(req.params.id, date, slot);
    publish('meals');
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// Grocery list — Mealie's single shopping list. Same shape as /api/tasks/:list
// ({ items:[{id,title,done}], count, left }) so the Home dashboard card and its
// tap-to-check-off logic didn't need to change.
mealRoutes.get('/api/grocery', async (_req, res) => {
  if (!hasMealie()) return res.status(503).json({ error: 'MEALIE not configured' });
  try {
    res.json(await fetchGroceryList());
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

mealRoutes.post('/api/grocery/:id/:action', async (req, res) => {
  if (!hasMealie()) return res.status(503).json({ error: 'MEALIE not configured' });
  const { id, action } = req.params;
  if (action !== 'close' && action !== 'reopen') {
    return res.status(400).json({ error: `unknown action "${action}"` });
  }
  try {
    await setGroceryItemDone(id, action === 'close');
    publish('meals');
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});
