/* Periodic refresh heartbeat.
 *
 * Screens now stay mounted (App keeps them alive to kill the tab-switch flash),
 * so they'd otherwise only fetch once per page load and go stale on an all-day
 * wall. This is a single process-wide timer: `tick` bumps every REFRESH_MS, and
 * a screen that reads `refreshTick()` inside an $effect re-hydrates on each bump.
 * One timer drives every screen — cheaper and simpler than a timer per screen.
 */
let tick = $state(0);
const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

// Call inside an $effect to make it re-run on every heartbeat.
export const refreshTick = () => tick;

let started = false;
export function startRefresh() {
  if (started) return; // idempotent — App calls this once, but guard anyway
  started = true;
  setInterval(() => (tick += 1), REFRESH_MS);
}

// Call right after a write (grocery toggle, add-recipe-to-grocery, task
// close, ...) so every other mounted screen re-hydrates immediately instead
// of waiting up to REFRESH_MS — screens stay mounted (see App.svelte), so a
// write on one screen wouldn't otherwise reach another until the next
// heartbeat, which reads as "not synced" even though it was just a delay.
export function bumpRefresh() {
  tick += 1;
}
