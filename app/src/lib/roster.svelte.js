// Live family roster — hydrates from GET /api/members so the app supports any
// number of members (not just the bundled demo's four). Falls back to the
// bundled mock roster until hydration lands (unconfigured source, API down),
// same mock-first/hydrate-after pattern as avatars.svelte.js / events.svelte.js.
//
// Consumers must read through members()/byId(), not a captured const — Svelte 5
// only re-runs template blocks that read the underlying $state at the point of
// use, so `const m = members()` cached at module scope would freeze at mount.
import { untrack } from 'svelte';
import { members as mockMembers } from './data/mock.js';
import { getMembers } from './api.js';
import { tintFor, tintBorderFor, monoFor } from './theme/derive.js';
import { reconcileList } from './rosterReconcile.js';

let roster = $state(mockMembers);

function withTheme(m) {
  return {
    ...m,
    tint: m.tint || tintFor(m.color),
    tintBorder: m.tintBorder || tintBorderFor(m.color),
    mono: m.mono || monoFor(m.name)
  };
}

/** The current roster (reactive) — any size, not just the bundled demo's four. */
export function members() {
  return roster;
}

/** Member by id, or undefined (e.g. mock event data referencing a retired id). */
export function byId(id) {
  return roster.find((m) => m.id === id);
}

/** Pull the live roster once at app start. No-ops (keeps mock) on any failure. */
export async function hydrateRoster() {
  const live = await getMembers();
  if (live && live.length) roster = live.map(withTheme);
}

/**
 * Keep a per-member `list` (e.g. Chore/Todo cards, one entry per id) in sync
 * with the current roster and in roster order — see reconcileList (the actual
 * diff logic, kept in a plain testable module). Call this before each hydrate:
 * reading `roster` here (tracked, outside untrack below) means the effect
 * that calls it re-runs as soon as the live roster lands, not just on the
 * next refresh heartbeat.
 *
 * The reconcile itself reads AND writes `list` — if that happened inside the
 * caller's normal $effect tracking, the write would re-trigger the same
 * effect that just ran it (Svelte 5 `effect_update_depth_exceeded`, hit and
 * fixed here: a caller's $effect must never read-and-write one $state without
 * untrack). `list` is the caller's own $state array, not this module's
 * concern to track, so its read+write is untracked; only the `roster` read
 * above is meant to be a dependency.
 */
export function syncListToRoster(list, makeEmpty) {
  const ids = roster.map((m) => m.id);
  untrack(() => reconcileList(list, ids, makeEmpty));
}
