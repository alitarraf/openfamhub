/* Babysitter mode — a wall lockdown for when a sitter is watching the kids.
 * The wall drops to a full-screen emergency-info card and every other screen is
 * sealed off until a parent's PIN returns to the dashboard. State is global and
 * server-side (see server/babysitter/index.js) so a kiosk reload can't escape
 * the lock. Every write publishes 'babysitter' so connected walls react live. */
import { Router } from 'express';
import { getBabysitter, setActive, setInfo } from '../babysitter/index.js';
import { verifyParentPin, requireParentMobileAuth } from '../auth.js';
import { publish } from '../util/bus.js';

export const babysitterRoutes = Router();

// Public read: the wall shows this to a sitter (who has no PIN) and reads
// `active` on boot so a reload lands straight back in the lock. Nothing here is
// sensitive — it's exactly what the sitter is meant to see.
babysitterRoutes.get('/api/babysitter', (_req, res) => {
  res.json(getBabysitter());
});

// Enter babysitter mode — one tap on the wall as a parent heads out. Public by
// design: the worst a prankster manages is locking the wall, which any parent
// PIN immediately reverses. Leaving is the gated direction, not entering.
babysitterRoutes.post('/api/babysitter/lock', (_req, res) => {
  const state = setActive(true);
  publish('babysitter');
  res.json(state);
});

// Leave babysitter mode — a parent's PIN, verified without minting a session or
// cookie (a one-shot confirmation, not a login).
babysitterRoutes.post('/api/babysitter/unlock', (req, res) => {
  const { memberId, pin } = req.body || {};
  const v = verifyParentPin(memberId, pin);
  if (!v.ok) return res.status(401).json({ error: v.error });
  const state = setActive(false);
  publish('babysitter');
  res.json(state);
});

// Edit the emergency info — PWA only, restricted to a signed-in parent (a kid's
// session gets a 403). Identity was proven at PWA login, so no second PIN.
// Never touches the lock flag.
babysitterRoutes.post('/api/babysitter', requireParentMobileAuth, (req, res) => {
  try {
    const state = setInfo(req.body);
    publish('babysitter');
    res.json(state);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
