#!/usr/bin/env node
/*
 * record-tour.mjs — reusable Playwright screen-recorder for the OpenFamHub
 * docs "product tour".
 *
 * It records a CLEAN capture of the wall UI (NO captions / text overlays baked
 * in — captions are layered on later in the docs as HTML), walking the bottom
 * tab bar through the seven tour screens with a fixed dwell on each. Output is a
 * portrait, full-bleed webm plus an H.264 mp4 transcode for Safari.
 *
 * WHAT IT PRODUCES (overwrites in place):
 *   docs/public/img/product-tour.webm   (VP9, ~560x996, portrait)
 *   docs/public/img/product-tour.mp4    (H.264 high, yuv420p, faststart, no audio)
 *
 * ONE-SHOT USAGE (starts its own throwaway demo server, records, encodes):
 *   # deps live wherever you installed them; point TOUR_MODULES_DIR at that dir
 *   # if they are not next to this script / at the repo root:
 *   TOUR_MODULES_DIR=/path/with/node_modules node scripts/record-tour.mjs
 *
 * The demo server it spawns uses:
 *   - a throwaway sqlite DB (temp file, deleted on exit)
 *   - the shipped example roster (config/members.example.json) — NO real data
 *   - DEMO=1 so the fresh DB auto-seeds a lived-in economy + journal.
 *     NOTE: DEMO=1 is REQUIRED here. The seed's zero-config auto-trigger is
 *     `usingFallbackRoster()`, which returns false the moment MEMBERS_CONFIG is
 *     set (even to the example file). Since we set MEMBERS_CONFIG, only the
 *     explicit DEMO=1 opt-in seeds — without it Journal + economy render empty.
 *
 * It reads NO secrets: no tokens, no .env, no production DB. Everything it needs
 * is the bundled example roster + the DEMO seed.
 *
 * USEFUL FLAGS / ENV:
 *   --reuse-server            don't spawn a server; use one already on TOUR_PORT
 *   --probe                   screenshot each screen (no video) to verify framing
 *   --encode-only            skip recording; re-encode an existing raw webm
 *                             (needs TOUR_RAW, optional TOUR_TRIM / TOUR_SPAN)
 *   TOUR_PORT=8099            server port
 *   TOUR_DWELL_MS=3000        ms held on each screen
 *   TOUR_TRIM_ADJUST=0        seconds to nudge the trim start (+ = later)
 *   TOUR_MODULES_DIR=...      dir containing node_modules/{playwright,ffmpeg-static}
 *
 * Prereqs: `npm i playwright ffmpeg-static`. Chromium must be cached under
 * ~/.cache/ms-playwright (this repo's box already has chromium-1228); we never
 * re-download. ffmpeg-static ships the ffmpeg binary (full build: libvpx-vp9 +
 * libx264), so no system ffmpeg is required.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync, mkdirSync, mkdtempSync, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');

// ── Resolve runtime deps from a flexible set of node_modules locations, so this
// repo-tracked script works whether the deps were installed next to it, at the
// repo root, in the cwd, or in a scratch dir (TOUR_MODULES_DIR). ──────────────
function makeRequire() {
  const bases = [process.env.TOUR_MODULES_DIR, __dirname, REPO, process.cwd()].filter(Boolean);
  for (const base of bases) {
    if (existsSync(join(base, 'node_modules', 'playwright'))) {
      return createRequire(join(base, '_resolve.cjs'));
    }
  }
  throw new Error(
    'Could not find node_modules/playwright. Run `npm i playwright ffmpeg-static`\n' +
      'and, if not installed next to this script or at the repo root, set\n' +
      'TOUR_MODULES_DIR to the directory that holds node_modules.'
  );
}
const require = makeRequire();
const { chromium } = require('playwright');
const ffmpegPath = require('ffmpeg-static');

// ── Config ───────────────────────────────────────────────────────────────────
const PORT = Number(process.env.TOUR_PORT || 8099);
const BASE = `http://localhost:${PORT}`;
const DWELL_MS = Number(process.env.TOUR_DWELL_MS || 3000);
// Record at the wall's NATIVE 1080x1920 (exact 9:16, scale=1). This is the ONLY
// way to guarantee zero grey gutter: Frame.svelte scales its fixed 1080x1920
// `.frame` (light-lavender bg) to fit the viewport inside a #dfe3ea grey stage
// with a drop shadow. At a non-9:16 viewport the frame fits the short side and
// the grey stage + shadow bleed in as a gutter (the old 560x956 = 0.5857 bug).
// At native 1080x1920 the frame == the viewport exactly: no grey, shadow falls
// entirely outside frame. We then downscale to OUT on encode for crispness.
const VIEW = { width: 1080, height: 1920 };
// Delivered size: 560px wide (matches the prior asset), ~9:16, both even.
const OUT = { width: 560, height: 996 };
const OUT_DIR = join(REPO, 'docs', 'public', 'img');
const WEBM_OUT = join(OUT_DIR, 'product-tour.webm');
const MP4_OUT = join(OUT_DIR, 'product-tour.mp4');
const TRIM_ADJUST = Number(process.env.TOUR_TRIM_ADJUST || 0);

const PROBE = process.argv.includes('--probe');
const ENCODE_ONLY = process.argv.includes('--encode-only');
const REUSE_SERVER = process.env.TOUR_REUSE_SERVER === '1' || process.argv.includes('--reuse-server');

// The tour, in order. `tab` = a bottom-tab-bar button (matched by its visible
// label); `subtab` = an in-Tasks segmented control button. Dwell is DWELL_MS on
// each. Home is already visible when the tour starts, so it is the anchor.
const STEPS = [
  { label: 'Home', kind: 'home' },
  { label: 'Calendar', kind: 'tab', text: 'Calendar' },
  { label: 'Tasks → Chore', kind: 'tab', text: 'Tasks' }, // Tasks opens on the Chore subtab
  { label: 'Tasks → Reward', kind: 'subtab', text: 'Reward' },
  { label: 'Meals', kind: 'tab', text: 'Meals' },
  { label: 'Budget', kind: 'tab', text: 'Budget' },
  { label: 'Journal', kind: 'tab', text: 'Journal' }
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtMB = (p) => (statSync(p).size / 1e6).toFixed(3) + ' MB';

// ── ffmpeg helpers (ffmpeg-static binary) ────────────────────────────────────
function ffmpeg(args) {
  return new Promise((res, rej) => {
    const p = spawn(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? res() : rej(new Error('ffmpeg failed: ' + err))));
  });
}
// Duration (seconds) from ffmpeg's own -i probe (ffmpeg-static ships no ffprobe).
function probeDuration(file) {
  return new Promise((res) => {
    const p = spawn(ffmpegPath, ['-hide_banner', '-i', file]);
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', () => {
      const m = err.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      res(m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null);
    });
  });
}

// Trim the raw capture to start at the tour anchor and re-encode to the two
// delivery formats. `trimSec` = seconds of pre-roll (warm-up) to drop so Home
// lands at t=0; `spanSec` = tour length to keep.
async function encode(rawPath, trimSec, spanSec) {
  mkdirSync(OUT_DIR, { recursive: true });
  const ss = Math.max(0, trimSec + TRIM_ADJUST);
  console.log(`\nEncoding  trim=${ss.toFixed(3)}s  span=${spanSec.toFixed(3)}s`);
  // VP9 webm — accurate seek (ffmpeg decodes from the prior keyframe and
  // discards up to -ss when re-encoding), 25fps to match the prior asset.
  await ffmpeg([
    '-ss', String(ss), '-i', rawPath, '-t', String(spanSec),
    '-vf', `scale=${OUT.width}:${OUT.height}:flags=lanczos`,
    '-r', '25', '-an', '-pix_fmt', 'yuv420p',
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-row-mt', '1',
    WEBM_OUT
  ]);
  // H.264 mp4 for Safari — transcode from the finished webm so both are identical.
  await ffmpeg([
    '-i', WEBM_OUT,
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', '-an',
    MP4_OUT
  ]);
  const wD = await probeDuration(WEBM_OUT);
  const mD = await probeDuration(MP4_OUT);
  console.log(`  webm: ${fmtMB(WEBM_OUT)}  ${wD?.toFixed(2)}s  -> ${WEBM_OUT}`);
  console.log(`  mp4 : ${fmtMB(MP4_OUT)}  ${mD?.toFixed(2)}s  -> ${MP4_OUT}`);
}

// ── Demo server lifecycle ────────────────────────────────────────────────────
async function waitForHealth(timeoutMs = 20000) {
  const t = Date.now();
  while (Date.now() - t < timeoutMs) {
    try {
      const r = await fetch(BASE + '/', { redirect: 'manual' });
      if (r.status === 200) return;
    } catch {}
    await sleep(300);
  }
  throw new Error('demo server did not become healthy on ' + BASE);
}

function startServer() {
  const dbFile = join(mkdtempSync(join(tmpdir(), 'tour-db-')), 'demo-tour.sqlite');
  const env = {
    ...process.env,
    DEMO: '1', // REQUIRED to seed once MEMBERS_CONFIG is set (see header note)
    PORT: String(PORT),
    ECONOMY_DB_PATH: dbFile,
    MEMBERS_CONFIG: join(REPO, 'config', 'members.example.json'),
    MEMBER_PIN_MOM: '1234' // throwaway PIN; nothing in the tour uses it
  };
  const child = spawn('node', [join(REPO, 'server', 'index.js')], { env, stdio: 'ignore' });
  return {
    child,
    stop() {
      try { child.kill('SIGTERM'); } catch {}
      try { unlinkSync(dbFile); } catch {}
    }
  };
}

// ── Playwright: warm up, suppress overlays, walk the tour ────────────────────
// Locators: bottom-tab buttons carry an icon ligature + their visible label, so
// we match on the label as a SUBSTRING (hasText) rather than an exact a11y name.
const tabBtn = (page, text) => page.locator('nav.tabbar button', { hasText: text });
// All Tasks sub-screens stay mounted (display:none), so each carries its own
// `.tabs` bar with a "Reward" button — scope to the visible pane (`.pane.active`)
// so the click hits the segmented control the viewer can actually see.
const subTabBtn = (page, text) => page.locator('.pane.active .tabs button', { hasText: text });

async function gotoScreen(page, step) {
  if (step.kind === 'tab') await tabBtn(page, step.text).click();
  else if (step.kind === 'subtab') await subTabBtn(page, step.text).click();
  // 'home' is the initial state — no click.
}

async function prepPage(context) {
  const page = await context.newPage();
  // The wall holds an SSE stream open forever — 'networkidle' would never fire.
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  // Warm-up: let every (kept-alive) screen hydrate from mock -> live so the very
  // first Home frame is already live data (no mock->live flash mid-record).
  await sleep(4000);
  // Deterministically neutralise the kiosk overlays (sleep blackout, idle
  // screensaver, babysitter lock) so a run at ANY hour records a clean wall.
  // They are conditionally rendered, so this is a belt-and-braces net.
  await page.addStyleTag({
    content: '.sleep,.scr,.babysitter{display:none !important;visibility:hidden !important;}'
  });
  // Assert nothing is actually covering the wall before we start.
  const covered = await page.locator('.sleep:visible, .scr:visible, .babysitter:visible').count();
  if (covered > 0) throw new Error(`an overlay is covering the wall (${covered}) — aborting`);
  return page;
}

async function runProbe(browser) {
  const context = await browser.newContext({ viewport: VIEW, reducedMotion: 'no-preference' });
  const page = await prepPage(context);
  const dir = mkdtempSync(join(tmpdir(), 'tour-probe-'));
  for (const step of STEPS) {
    await gotoScreen(page, step);
    await sleep(600);
    const f = join(dir, step.label.replace(/\W+/g, '_') + '.png');
    await page.screenshot({ path: f });
    console.log('probe', step.label, '->', f);
  }
  await context.close();
  console.log('\nProbe screenshots in', dir);
}

async function runRecord(browser) {
  const context = await browser.newContext({
    viewport: VIEW,
    // recordVideo size MUST match the viewport (else Playwright letterboxes).
    recordVideo: { dir: mkdtempSync(join(tmpdir(), 'tour-raw-')), size: VIEW },
    // Headless Chromium defaults reducedMotion to 'reduce', which kills CSS
    // animations and yields dead frames — force motion on.
    reducedMotion: 'no-preference'
  });
  // Recording begins ~when the page starts; anchor here to compute the pre-roll
  // trim. The exact offset is verified from extracted frames afterward.
  const recordAnchor = Date.now();
  const page = await prepPage(context);

  // Tour: Home is already visible; mark t0, then dwell + click through the rest.
  const marks = [];
  const t0 = Date.now();
  for (const step of STEPS) {
    await gotoScreen(page, step); // no-op for Home
    marks.push({ label: step.label, tSec: (Date.now() - t0) / 1000 });
    await sleep(DWELL_MS);
  }
  // spanSec spans t0 -> just after the LAST screen's full dwell, so the final
  // screen keeps a full DWELL (don't hardcode STEPS*DWELL — the small per-click
  // drift would otherwise be shaved entirely off the last screen).
  const spanSec = (Date.now() - t0) / 1000;
  const recordAnchorTrim = (t0 - recordAnchor) / 1000; // fuzzy: newPage != first frame

  const video = page.video();
  await context.close(); // flushes the webm to disk
  const rawPath = await video.path();

  // Self-calibrating trim: the recording runs recordStart -> context.close, and
  // spanSec was measured right before close, so `rawDuration - spanSec` is where
  // Home (t0) sits — far tighter than the newPage anchor, which fires a beat
  // before the first frame is actually captured.
  const rawDuration = await probeDuration(rawPath);
  const trimSec = Math.max(0, rawDuration - spanSec);

  console.log('\nPer-screen marks (relative to Home = t0):');
  for (const m of marks) console.log(`  ${m.tSec.toFixed(3)}s  ${m.label}`);
  console.log(`Raw capture: ${rawPath}`);
  console.log(`raw ${rawDuration?.toFixed(2)}s  span ${spanSec.toFixed(2)}s  ` +
    `trim(raw-span) ${trimSec.toFixed(3)}s  (anchor est ${recordAnchorTrim.toFixed(3)}s)`);

  await encode(rawPath, trimSec, spanSec);

  console.log('\nFINAL per-screen timestamps in the delivered video:');
  for (const m of marks) console.log(`  ${m.tSec.toFixed(2)}s  ${m.label}`);
  console.log(`  total ${spanSec.toFixed(2)}s`);
  return { rawPath, trimSec, spanSec };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (ENCODE_ONLY) {
    const raw = process.env.TOUR_RAW;
    if (!raw) throw new Error('--encode-only needs TOUR_RAW=<raw.webm>');
    await encode(raw, Number(process.env.TOUR_TRIM || 0), Number(process.env.TOUR_SPAN || 21));
    return;
  }

  let server = null;
  if (!REUSE_SERVER) {
    console.log('Starting throwaway demo server (DEMO=1, example roster)…');
    server = startServer();
  }
  const browser = await chromium.launch({ headless: true });
  try {
    await waitForHealth();
    if (PROBE) await runProbe(browser);
    else await runRecord(browser);
  } finally {
    await browser.close();
    if (server) server.stop();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
