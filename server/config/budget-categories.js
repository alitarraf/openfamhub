/* Budget category → icon/color — same idiom as config/rewards.js and
 * config/journal-tags.js, but keyed by name-match instead of a stable id:
 * Monarch category names are whatever the household named them there, not
 * something this app controls or can assign a stable id to. Unmatched
 * categories (any name not in this list) fall back to DEFAULT — common,
 * expected, not an error — a family's Monarch categories will always include
 * names this curated list doesn't happen to cover.
 */
const MAP = {
  groceries: { icon: 'local_grocery_store', catKey: 'fern' },
  'dining out': { icon: 'restaurant', catKey: 'coral' },
  restaurants: { icon: 'restaurant', catKey: 'coral' },
  household: { icon: 'home', catKey: 'sky' },
  'kids activities': { icon: 'sports_soccer', catKey: 'iris' },
  gas: { icon: 'local_gas_station', catKey: 'gold' },
  transportation: { icon: 'directions_car', catKey: 'gold' },
  gifts: { icon: 'redeem', catKey: 'coral' },
  entertainment: { icon: 'movie', catKey: 'iris' },
  subscriptions: { icon: 'subscriptions', catKey: 'sky' },
  utilities: { icon: 'bolt', catKey: 'gold' },
  medical: { icon: 'favorite', catKey: 'coral' },
  travel: { icon: 'flight', catKey: 'sky' }
};
const DEFAULT = { icon: 'category', catKey: 'sky' };

/** { icon, catKey } for a Monarch category name, case-insensitive, with a
 * sensible default for anything not in the curated map above. */
export function budgetCategoryStyle(name) {
  return MAP[(name || '').trim().toLowerCase()] || DEFAULT;
}
