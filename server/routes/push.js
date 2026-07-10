/* Web-push subscription routes — the PWA subscribes after login (member
 * identity from the session, same rule as every mobile write). The public
 * VAPID key is not a secret; the private key never leaves the server. */
import { Router } from 'express';
import { requireMobileAuth } from '../auth.js';
import { hasVapid, vapidPublicKey, saveSubscription, deleteSubscription, hasSubscription } from '../push/index.js';

export const pushRoutes = Router();

// 503 (not 404) when VAPID isn't configured — "this install doesn't do push
// yet" is an unconfigured-source state, same contract as Todoist/Mealie.
pushRoutes.get('/api/push/vapid-key', (_req, res) => {
  if (!hasVapid()) return res.status(503).json({ error: 'push not configured (VAPID keys)' });
  res.json({ key: vapidPublicKey() });
});

// Whether THIS member has a subscription (drives the toggle's initial state).
pushRoutes.get('/api/push/status', requireMobileAuth, (req, res) => {
  res.json({ configured: hasVapid(), subscribed: hasSubscription(req.memberId) });
});

pushRoutes.post('/api/push/subscribe', requireMobileAuth, (req, res) => {
  try {
    saveSubscription(req.memberId, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

pushRoutes.post('/api/push/unsubscribe', requireMobileAuth, (req, res) => {
  const endpoint = req.body?.endpoint;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  deleteSubscription(endpoint);
  res.json({ ok: true });
});
