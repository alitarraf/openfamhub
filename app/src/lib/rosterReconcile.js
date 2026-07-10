// Pure roster-diff logic, split out of roster.svelte.js so it's testable with
// plain node:test — a .svelte.js file's `$state` rune isn't valid outside the
// Svelte compiler, so the reactive module can't be imported directly by a test.
//
// Rebuilds `list` (one entry per member id, e.g. Chore/Todo cards) to exactly
// match `rosterIds`, in that order: keeps + repositions surviving entries
// (preserving their already-hydrated task/points data), drops ids no longer in
// the roster, and appends a fresh `makeEmpty()` entry for any new id. Mutates
// `list` in place (same array reference) so a caller's Svelte $state array
// stays reactive.
export function reconcileList(list, rosterIds, makeEmpty) {
  const byId = new Map(list.map((x) => [x.id, x]));
  const next = rosterIds.map((id) => byId.get(id) || { id, ...makeEmpty() });
  list.length = 0;
  list.push(...next);
}
