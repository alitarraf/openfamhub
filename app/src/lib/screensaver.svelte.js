/* Screensaver — idle-timeout (not scheduled/manual like sleep.svelte.js,
 * which is a separate, deliberately distinct concept: this is "still on,
 * just idle," sleep is "off"). After IDLE_MS with no touch/click anywhere,
 * shows ScreensaverOverlay.svelte: a local-photo slideshow from data/photos/
 * (server/sources/photos.js) with a clock/weather corner overlay, falling
 * back to a decorative clock banner when the folder is empty. Any
 * interaction dismisses it. Home's screensaver button triggers it on demand
 * via forceScreensaver().
 */
let idleMs = 3 * 60 * 1000; // 3 minutes — overwritten from /api/config
let cycleMs = 20 * 1000; // photo slideshow interval — overwritten the same way

let active = $state(false);
let timer = null;

export const isScreensaverActive = () => active;
/** Photo cycle interval — read by ScreensaverOverlay each time it mounts. */
export const screensaverCycleMs = () => cycleMs;

// Pull idle/cycle timings from the settings store (same pattern + rationale
// as sleep.svelte.js's reloadSleepConfig — startup + on 'settings' publish).
export function reloadScreensaverConfig() {
  return fetch('/api/config')
    .then((r) => (r.ok ? r.json() : null))
    .then((cfg) => {
      if (cfg?.screensaverIdleMin != null) idleMs = cfg.screensaverIdleMin * 60 * 1000;
      if (cfg?.screensaverCycleSec != null) cycleMs = cfg.screensaverCycleSec * 1000;
      if (!active) arm(); // re-arm with the new idle timeout
    })
    .catch(() => {});
}

function arm() {
  clearTimeout(timer);
  timer = setTimeout(() => (active = true), idleMs);
}

export function dismissScreensaver() {
  active = false;
  arm();
}

export function forceScreensaver() {
  active = true;
}

let started = false;
export function startScreensaverIdleWatch() {
  if (started) return; // idempotent — App calls this once, but guard anyway
  started = true;
  arm();
  reloadScreensaverConfig();
  // Capture phase so a tap resets the idle clock even if a screen's own
  // handler calls stopPropagation. While active, a tap should dismiss (not
  // just reset the timer) — handled by the overlay's own click, which calls
  // dismissScreensaver() directly; this listener no-ops while active so the
  // two don't race.
  document.addEventListener(
    'pointerdown',
    () => {
      if (!active) arm();
    },
    { capture: true }
  );
}
