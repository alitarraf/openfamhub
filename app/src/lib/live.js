/* Live updates — EventSource on GET /api/live. A write anywhere (another
 * family member's phone, the wall itself, a future voice command) publishes
 * a kind; we coalesce a burst into one bumpRefresh() so rapid grocery
 * check-offs don't refetch every mounted screen once per tap. The 5-minute
 * heartbeat (refresh.svelte.js) stays as the fallback when the stream is
 * down — EventSource reconnects on its own, so this never needs babysitting.
 */
import { bumpRefresh } from './refresh.svelte.js';
import { dismissScreensaver, reloadScreensaverConfig } from './screensaver.svelte.js';
import { reloadSleepConfig } from './sleep.svelte.js';
import { reloadBabysitter } from './babysitter.svelte.js';
import { reloadCelebrateConfig } from './celebrate.js';

const COALESCE_MS = 400;
let pending = null;

function scheduleBump() {
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    bumpRefresh();
  }, COALESCE_MS);
}

let started = false;
export function startLive() {
  if (started || typeof EventSource === 'undefined') return;
  started = true;
  const es = new EventSource('/api/live');
  es.onmessage = (e) => {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    // Presence (future wall sensor) wakes the screensaver instead of
    // refetching data. Deliberately does NOT wake scheduled sleep — walking
    // through the kitchen at 2am shouldn't light the wall.
    if (msg.kind === 'presence') {
      if (msg.present) dismissScreensaver();
      return;
    }
    // Settings changed (sleep schedule / screensaver timings) — re-apply
    // rather than refetch screen data; nothing else reads these.
    if (msg.kind === 'settings') {
      reloadSleepConfig();
      reloadScreensaverConfig();
      reloadCelebrateConfig();
      return;
    }
    // Babysitter lock/unlock or an info edit from a phone — re-pull the lock
    // state + emergency info so the overlay appears/updates/clears live,
    // without refetching every mounted screen.
    if (msg.kind === 'babysitter') {
      reloadBabysitter();
      return;
    }
    scheduleBump();
  };
}
