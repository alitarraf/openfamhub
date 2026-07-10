/* Budget source — reads the snapshot the Python Monarch sidecar writes.
 *
 * Monarch has no official API, so the fragile login/scrape stays in fetcher/
 * (Python cron) which writes data/monarch.json. This module only *reads* that
 * file and normalizes it; the backend never touches Monarch creds.
 *
 * Path must match where the fetcher writes + the compose mount: repo ./data
 * (overridable with MONARCH_JSON). The fetcher's snapshot shape is:
 *   { updated, demo, budgets: [{ Category, Budget, Spent, Left }] }
 *
 * `mapBudget` is pure (snapshot -> normalized rows) for fixture testing.
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { budgetCategoryStyle } from '../config/budget-categories.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = () => (process.env.MONARCH_JSON || '').trim() || join(__dirname, '..', '..', 'data', 'monarch.json');
const historyDir = () =>
  (process.env.MONARCH_HISTORY_DIR || '').trim() || join(__dirname, '..', '..', 'data', 'monarch-history');

// 'YYYY-MM' in server-local time — must match the fetcher's own
// datetime.now().strftime("%Y-%m") (also naive/local, both read the same
// container TZ env var), or history files would file under the wrong month
// near a month boundary.
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Tolerates both the fetcher's TitleCase keys and lowercase, in case the
// transform_budgets() shape is tuned once a real Monarch payload is seen.
//
// `totals` is a true net across every category, including unbudgeted spend
// and overspending — sum(budget) - sum(spent), no per-category flooring at
// zero. A category with $0 budget but real spend still drags totals.left
// down instead of vanishing from the number; an overspent category's excess
// does the same. This is the deliberate choice (over the alternative of
// floor-per-category + separate over/unbudgeted callouts): the Budget
// screen's whole premise is one honest "safe to spend" figure.
export function mapBudget(data) {
  const rows = Array.isArray(data && data.budgets) ? data.budgets : [];
  const budgets = rows.map((b) => {
    const category = b.Category ?? b.category ?? '';
    const budget = num(b.Budget ?? b.budget);
    const spent = num(b.Spent ?? b.spent);
    // Always recomputed, never trusted off the raw snapshot's own Left field
    // (the fetcher's is redundant anyway — round(budget - spent)) — a merged
    // row from mergeRawBudgets() has no Left field at all, so trusting it
    // silently produced $0-left for every Last Month / YTD category.
    return { category, budget, spent, left: budget - spent, ...budgetCategoryStyle(category) };
  });
  const totals = budgets.reduce(
    (acc, b) => ({ budget: acc.budget + b.budget, spent: acc.spent + b.spent, left: acc.left + (b.budget - b.spent) }),
    { budget: 0, spent: 0, left: 0 }
  );
  return {
    updated: (data && data.updated) || null,
    demo: !!(data && data.demo),
    totals,
    budgets
  };
}

/**
 * Read + normalize the latest (current-month) budget snapshot.
 * Returns { updated, demo, totals, budgets:[{category,budget,spent,left,icon,catKey}] }.
 * Throws if the file is missing/unreadable so the route can fall back.
 */
export async function fetchBudget() {
  const raw = await readFile(jsonPath(), 'utf8');
  return mapBudget(JSON.parse(raw));
}

async function readSnapshot(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Pure: sums multiple raw snapshots' budgets per-category by name, into the
 * raw TitleCase shape mapBudget() expects. Split out from fetchBudgetYTD so
 * the merge math (the actually-interesting new logic) is fixture-testable
 * without touching the filesystem.
 */
export function mergeRawBudgets(snapshots) {
  const byCategory = new Map(); // name -> { Category, Budget, Spent }
  for (const snap of snapshots) {
    for (const row of Array.isArray(snap && snap.budgets) ? snap.budgets : []) {
      const name = row.Category ?? row.category ?? '';
      const prev = byCategory.get(name) || { Category: name, Budget: 0, Spent: 0 };
      prev.Budget += num(row.Budget ?? row.budget);
      prev.Spent += num(row.Spent ?? row.spent);
      byCategory.set(name, prev);
    }
  }
  return [...byCategory.values()];
}

/**
 * Last calendar month's snapshot, from the fetcher's history directory.
 * Throws (same contract as fetchBudget) if that month was never captured —
 * a real, expected state until the sidecar has run across a month boundary.
 */
export async function fetchBudgetLast() {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const path = join(historyDir(), `${monthKey(lastMonth)}.json`);
  const raw = await readFile(path, 'utf8'); // throws ENOENT if not captured yet
  return mapBudget(JSON.parse(raw));
}

/**
 * Year-to-date: sums every captured month of the current year (from history)
 * plus the live current-month snapshot, merged per-category by name, then
 * run through the same mapBudget() so totals/icon/catKey logic isn't
 * duplicated. Always includes at least the current month — a fresh install
 * with no history yet still gets a meaningful (if partial) YTD.
 */
export async function fetchBudgetYTD() {
  const now = new Date();
  const year = String(now.getFullYear());

  let historyFiles = [];
  try {
    historyFiles = (await readdir(historyDir())).filter((f) => f.startsWith(`${year}-`) && f.endsWith('.json'));
  } catch {
    /* no history directory yet — YTD still works from the current month alone */
  }

  const snapshots = (await Promise.all(historyFiles.map((f) => readSnapshot(join(historyDir(), f))))).filter(Boolean);

  const current = await readSnapshot(jsonPath());
  if (current) snapshots.push(current);
  if (!snapshots.length) throw new Error('no budget data captured yet');

  // Most recent snapshot's `updated` is the freshest; YTD is "demo" if the
  // current (freshest) component is — a household mid-setup shouldn't see a
  // confident-looking YTD number built partly on demo data.
  return mapBudget({
    updated: current?.updated ?? snapshots.at(-1)?.updated ?? null,
    demo: !!current?.demo,
    budgets: mergeRawBudgets(snapshots)
  });
}

/** Dispatch by period id — the shape server/index.js's route wants. */
export function fetchBudgetPeriod(period) {
  if (period === 'last') return fetchBudgetLast();
  if (period === 'ytd') return fetchBudgetYTD();
  return fetchBudget();
}

export const budgetPath = jsonPath;
