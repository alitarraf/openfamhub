/* Sleep overlay — scheduled (SLEEP_START_HOUR/SLEEP_END_HOUR, from .env via
 * GET /api/config; defaults to 22:00–07:00 local if unset/unreachable) +
 * manual, app-level blackout only. Never `xset dpms` — that kills touch-wake
 * on these monitors (see CLAUDE.md). Tapping the overlay wakes it; if the
 * wake happened during the scheduled window, it re-arms after IDLE_REARM_MS
 * so a quick overnight check doesn't leave the wall lit until morning. A
 * manual sleep (the Home button) doesn't re-arm — once woken, it just stays
 * awake.
 */
let SLEEP_START_HOUR = 22; // 10pm local — overwritten by /api/config on startup
let SLEEP_END_HOUR = 7; // 7am local — overwritten by /api/config on startup
const IDLE_REARM_MS = 2 * 60 * 1000;

let asleep = $state(false);
let manual = false; // asleep because of the manual button, not the schedule
let rearmTimer = null;

const inScheduledWindow = () => {
  const h = new Date().getHours();
  return SLEEP_START_HOUR > SLEEP_END_HOUR
    ? h >= SLEEP_START_HOUR || h < SLEEP_END_HOUR // window wraps past midnight
    : h >= SLEEP_START_HOUR && h < SLEEP_END_HOUR;
};

export const isAsleep = () => asleep;

export function manualSleep() {
  manual = true;
  asleep = true;
  clearTimeout(rearmTimer);
  rearmTimer = null;
}

export function wake() {
  asleep = false;
  const wasManual = manual;
  manual = false;
  clearTimeout(rearmTimer);
  rearmTimer = null;
  if (!wasManual && inScheduledWindow()) {
    rearmTimer = setTimeout(() => {
      asleep = true;
      rearmTimer = null;
    }, IDLE_REARM_MS);
  }
}

// Pick up sleep hours from GET /api/config (settings store: DB → .env →
// defaults) — falls back to the 22/07 defaults above if the fetch fails, same
// as every other source in this app degrading to a sane default rather than
// breaking. Called at startup and again whenever live.js sees a 'settings'
// publish, so a change saved on the settings screen applies without a reload.
export function reloadSleepConfig() {
  return fetch('/api/config')
    .then((r) => (r.ok ? r.json() : null))
    .then((cfg) => {
      if (cfg?.sleepStartHour != null) SLEEP_START_HOUR = cfg.sleepStartHour;
      if (cfg?.sleepEndHour != null) SLEEP_END_HOUR = cfg.sleepEndHour;
    })
    .catch(() => {});
}

let started = false;
export function startSleepSchedule() {
  if (started) return; // idempotent — App calls this once, but guard anyway
  started = true;
  const check = () => {
    if (!manual && !asleep && !rearmTimer && inScheduledWindow()) asleep = true;
  };
  reloadSleepConfig().finally(check);
  setInterval(check, 60 * 1000); // re-check every minute
}
