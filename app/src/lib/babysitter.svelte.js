/* Babysitter mode (wall) — a reload-proof lockdown: when active, a full-screen
 * emergency-info overlay seals off the dashboard until a parent's PIN unlocks
 * it. The lock flag is global and server-side (GET /api/babysitter), so this
 * fetches it on startup — a kiosk reload lands right back in the lock — and
 * again whenever live.js sees a 'babysitter' publish (a phone edit, or another
 * device locking/unlocking). Degrades to "not locked" if the backend is down,
 * same fail-soft posture as the rest of the app. */
import { enterBabysitterMode, exitBabysitterMode, getBabysitter } from './api.js';

const EMPTY = { active: false, parents: [], contacts: [], notes: '' };

let state = $state({ ...EMPTY });

export const isBabysitterLocked = () => state.active;
export const babysitterInfo = () => state;

/** Pull the current lock state + emergency info. Called at startup and on each
 * 'babysitter' live event. Never throws — falls back to the unlocked empty view. */
export function reloadBabysitter() {
  return getBabysitter(EMPTY).then((s) => {
    state = { ...EMPTY, ...s };
  });
}

/** Enter the lock (Home quick-action). Optimistic so the overlay appears
 * instantly; the server publish + reload confirm it across devices. */
export async function enterBabysitter() {
  state = { ...state, active: true };
  const s = await enterBabysitterMode();
  // If the lock didn't confirm server-side (backend down/old), don't strand the
  // wall locked with no parents to unlock it — fall back to unlocked.
  state = s ? { ...EMPTY, ...s } : { ...EMPTY };
}

/** Leave the lock with a parent's PIN. Returns { ok, error? }; on success the
 * 'babysitter' publish (and this reload) clear the overlay everywhere. */
export async function exitBabysitter(memberId, pin) {
  const result = await exitBabysitterMode(memberId, pin);
  if (result.ok) await reloadBabysitter();
  return result;
}

let started = false;
export function startBabysitter() {
  if (started) return;
  started = true;
  reloadBabysitter();
}
