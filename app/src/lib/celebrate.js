/* Chore-completion celebration — a confetti burst + a synthesized chime, fired
 * when a kid marks a chore done (see TasksChoreScreen + PersonCard). Kept
 * dependency-free and asset-free on purpose (weak 2011 kiosk CPU, offline
 * appliance, "self-host everything"): the confetti is a small canvas particle
 * burst (CelebrationLayer.svelte) and the sound is generated with the WebAudio
 * API — no binary in the repo, nothing extra for the service worker to cache.
 *
 * Gated by the `celebrateChores` on-device setting (0/1, DB→env→fallback),
 * read from the public /api/config and re-read on the 'settings' live event.
 */

// Overwritten from /api/config on startup; default matches the server fallback
// so the very first render (before the fetch resolves) behaves as configured.
let enabled = true;

/** Whether chore celebrations are currently switched on. */
export const celebrationsOn = () => enabled;

/** (Re)load the on/off state from the public config. Called at startup and on
 *  every 'settings' live event (see live.js). Fail-soft: leaves the last known
 *  value if the fetch fails. */
export function reloadCelebrateConfig() {
  return fetch('/api/config')
    .then((r) => (r.ok ? r.json() : null))
    .then((cfg) => {
      if (cfg && cfg.celebrateChores != null) enabled = cfg.celebrateChores === 1;
    })
    .catch(() => {});
}

// --- Confetti burst emitter -------------------------------------------------
// A plain listener set (not Svelte $state) so any PersonCard can fire a burst
// into the single mounted CelebrationLayer without cross-component reactivity
// bookkeeping. onBurst() returns an unsubscribe for the layer's $effect cleanup.
const listeners = new Set();

/** Subscribe to bursts. Returns an unsubscribe fn. */
export function onBurst(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Fire a confetti burst. spec = { x, y, colors } in viewport pixels. */
export function burst(spec) {
  for (const fn of listeners) fn(spec);
}

// --- Synthesized chime ------------------------------------------------------
// One shared AudioContext, created lazily on the first user gesture (primeAudio,
// wired to the first pointerdown in App.svelte). Browsers require a prior
// gesture before audio can start; the wall is all taps, so it unlocks on the
// first touch and stays warm.
let actx = null;

function ctx() {
  if (actx) return actx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  actx = new AC();
  return actx;
}

/** Unlock/resume the AudioContext from within a user gesture. Safe to call
 *  repeatedly; no-ops once running. */
export function primeAudio() {
  const c = ctx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

/** A short bright ascending arpeggio — a kid "you did it!" ding. Silent no-op
 *  if WebAudio is unavailable or the device has no working audio output. */
export function playChime() {
  const c = ctx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const now = c.currentTime;
  const master = c.createGain();
  master.gain.value = 0.28;
  master.connect(c.destination);
  // C6 · E6 · G6 · C7 — a major triad resolving up an octave, staggered.
  const notes = [1046.5, 1318.51, 1567.98, 2093.0];
  notes.forEach((f, i) => {
    const t = now + i * 0.075;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.012); // quick attack
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); // decay tail
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}
