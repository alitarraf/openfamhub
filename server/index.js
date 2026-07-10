/* OpenFamHub backend — lean aggregation API + static SPA serving.
 *
 * Serves the built Svelte SPA (app/dist) and exposes /api/* endpoints that
 * aggregate external data sources with tokens kept server-side. Per the PRD
 * this is one small service on :8080 (the port the kiosk + Tailscale review hit).
 *
 * Routes live in routes/* by domain (openapi.yaml is the contract for all of
 * them); this file is just process wiring: express setup, router mounting,
 * SPA fallback, the nightly DB backup scheduler.
 */
import dns from 'node:dns';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Prefer IPv4 for every outbound lookup (notably node-ical calendar feeds).
// Some container/DNS setups (e.g. Docker behind Tailscale MagicDNS) return AAAA
// records for feed hosts (calendar.google.com, iCloud) on a host with no working
// IPv6 egress — Node's default "verbatim" order then tries the unroutable v6
// address first and the fetch stalls/fails, intermittently blanking the wall
// calendar. ipv4first makes A records win.
dns.setDefaultResultOrder('ipv4first');

import { systemRoutes } from './routes/system.js';
import { taskRoutes } from './routes/tasks.js';
import { mobileRoutes } from './routes/mobile.js';
import { economyRoutes } from './routes/economy.js';
import { journalRoutes } from './routes/journal.js';
import { mealRoutes } from './routes/meals.js';
import { sourceRoutes } from './routes/sources.js';
import { pushRoutes } from './routes/push.js';
import { babysitterRoutes } from './routes/babysitter.js';
import { startBackupScheduler } from './db/backup.js';
import { startRecapScheduler } from './journal/recap.js';
import { startPushScheduler } from './push/scheduler.js';
import { taskProvider } from './providers/registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;
const SPA_DIR = join(__dirname, '..', 'app', 'dist');

const app = express();
app.use(express.json());

app.use(systemRoutes);
app.use(taskRoutes);
app.use(mobileRoutes);
app.use(economyRoutes);
app.use(journalRoutes);
app.use(mealRoutes);
app.use(sourceRoutes);
app.use(pushRoutes);
app.use(babysitterRoutes);

// --- Static SPA --------------------------------------------------------
app.use(express.static(SPA_DIR));
// SPA fallback: anything not /api and not a static file -> index.html.
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(join(SPA_DIR, 'index.html'));
});

// Nightly snapshot of the economy/journal SQLite onto ./data (see db/backup.js).
startBackupScheduler();
// Weekly (Sun) + monthly (1st) recap entries into the Journal (journal/recap.js).
startRecapScheduler();
// Chore reminder + dinner digest to the parents' phones (push/scheduler.js).
startPushScheduler();

app.listen(PORT, () => {
  console.log(`OpenFamHub server on :${PORT} (todoist: ${taskProvider.hasToken() ? 'configured' : 'no-token'})`);
});
