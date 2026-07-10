/* Health, client config, and the OpenAPI contract (raw + Swagger UI). */
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { taskProvider, calendarProvider, weatherProvider } from '../providers/registry.js';
import { hasMembers } from '../config/members.js';
import { sseHandler, publish } from '../util/bus.js';
import { getSettings, setSettings } from '../settings/index.js';
import { requireBudgetAuth } from '../auth.js';

const { hasToken } = taskProvider;
const { hasWeather } = weatherProvider;
const { hasCalendar } = calendarProvider;

const OPENAPI_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'openapi.yaml');

export const systemRoutes = Router();

// --- API docs (OpenAPI) -------------------------------------------------
// openapi.yaml is the contract for every /api/* route; served both raw
// (for codegen/Postman/etc.) and as interactive Swagger UI.
const OPENAPI_SPEC = YAML.parse(readFileSync(OPENAPI_PATH, 'utf8'));
systemRoutes.get('/api/openapi.yaml', (_req, res) => {
  res.type('text/yaml').sendFile(OPENAPI_PATH);
});
systemRoutes.use('/api/docs', swaggerUi.serve, swaggerUi.setup(OPENAPI_SPEC));

systemRoutes.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    sources: {
      todoist: hasToken() ? 'configured' : 'no-token',
      members: hasMembers() ? 'configured' : 'no-uids',
      weather: hasWeather() ? 'configured' : 'not-configured',
      calendar: hasCalendar() ? 'configured' : 'not-configured'
      // budget is file-backed (Monarch sidecar); reported per-request on /api/budget
    }
  });
});

// Live-update stream (SSE). Write routes publish; connected walls/PWAs
// re-hydrate immediately instead of waiting out the 5-minute heartbeat.
systemRoutes.get('/api/live', sseHandler);

// --- Presence (scaffold for a future wall sensor) -----------------------
// A PIR/mmWave sensor (ESP32 or anything that can HTTP POST) reports motion
// here; connected walls get a 'presence' publish and wake the screensaver
// (deliberately NOT scheduled sleep — see app/src/lib/live.js). Plain HTTP
// by choice: no MQTT broker to run. Until the sensor exists this is dormant.
//
//   curl -X POST http://<host>:8080/api/presence \
//        -H 'content-type: application/json' -d '{"present": true}'
//
// If PRESENCE_TOKEN is set, the sensor must send it as X-Presence-Token —
// optional hardening for LANs with more devices than trust.
let presence = { present: false, changedAt: null };

systemRoutes.post('/api/presence', (req, res) => {
  const expected = (process.env.PRESENCE_TOKEN || '').trim();
  if (expected && req.get('x-presence-token') !== expected) {
    return res.status(401).json({ error: 'bad presence token' });
  }
  const present = req.body?.present;
  if (typeof present !== 'boolean') {
    return res.status(400).json({ error: 'body must be {"present": true|false}' });
  }
  if (present !== presence.present) {
    presence = { present, changedAt: new Date().toISOString() };
    publish('presence', { present });
  }
  res.json({ ok: true });
});

systemRoutes.get('/api/presence', (_req, res) => {
  res.json(presence);
});

// Client-side config that can't be baked into the JS bundle — the sleep
// schedule and screensaver timings. Backed by the settings store (DB row →
// .env → fallback, see server/settings/index.js), so the on-device settings
// screen and .env both feed the same read path. Public read: nothing here
// is sensitive and the wall needs it before anyone could unlock anything.
systemRoutes.get('/api/config', (_req, res) => {
  // mealieUrl is a static, browser-facing launch target (the companion PWA's
  // Meals tab opens it) — the HTTPS ts.net URL of the family's Mealie, distinct
  // from MEALIE_URL (the container→Mealie proxy address). Not a tweakable
  // setting, so it lives here in env rather than the integer-only settings store.
  res.json({ ...getSettings(), mealieUrl: process.env.MEALIE_APP_URL || '' });
});

// Settings behind the parent PIN gate (same unlock as Budget — see auth.js):
// GET so the settings screen can tell locked (401) from current values,
// POST to change them. Publishes 'settings' so every connected wall/PWA
// re-applies immediately.
systemRoutes.get('/api/settings', requireBudgetAuth, (_req, res) => {
  res.json(getSettings());
});

systemRoutes.post('/api/settings', requireBudgetAuth, (req, res) => {
  try {
    const settings = setSettings(req.body);
    publish('settings');
    res.json(settings);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
