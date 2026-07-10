/* Roster, balances, and the reward catalog/assignment/redemption routes. */
import { Router } from 'express';
import { members } from '../config/members.js';
import {
  getRewards,
  getReward,
  createReward,
  updateReward,
  setRewardHidden,
  removeCustomReward
} from '../rewards/index.js';
import {
  getAllBalances,
  getTodayEarned,
  redeemReward,
  assignReward,
  unassignReward,
  getAssignments
} from '../economy/index.js';
import { requireParentMobileAuth } from '../auth.js';
import { localDateStr } from '../util/dates.js';
import { MEMBER_IDS } from '../util/roster.js';
import { publish } from '../util/bus.js';

export const economyRoutes = Router();

// The family roster (id/name/color/…, no UIDs or PINs) — the single source of
// truth is config/members.json (see server/config/members.js).
economyRoutes.get('/api/members', (_req, res) => {
  res.json(members().map(({ uid: _uid, ...m }) => m));
});

// Per-member point balances, e.g. { dad: 12, mom: 8, kid1: 3, kid2: 5 }.
economyRoutes.get('/api/balances', (_req, res) => {
  res.json(getAllBalances(MEMBER_IDS));
});

// Per-member points earned today (net of same-day reverts), for the Profile
// screen's "N stars earned today" — see server/economy/index.js.
economyRoutes.get('/api/balances/today', (_req, res) => {
  res.json(getTodayEarned(MEMBER_IDS, localDateStr()));
});

// Reward catalog + who's currently working toward what + balances, in one
// response — both the Reward tab and its Manage view need all three.
economyRoutes.get('/api/rewards', (_req, res) => {
  // includeHidden: the Manage views show hidden rewards (to offer an unhide);
  // the redeem/assign surfaces filter `hidden` out client-side.
  res.json({
    catalog: getRewards({ includeHidden: true }),
    assignments: getAssignments(MEMBER_IDS),
    balances: getAllBalances(MEMBER_IDS)
  });
});

// Manage-view actions: assign/unassign a catalog reward to a member's
// "working toward" list. Body: { memberId }.
economyRoutes.post('/api/rewards/:id/assign', (req, res) => {
  const { id } = req.params;
  const { memberId } = req.body || {};
  if (!MEMBER_IDS.includes(memberId)) return res.status(400).json({ error: `unknown memberId "${memberId}"` });
  // Only assignable if it exists and isn't hidden.
  if (!getReward(id, { includeHidden: false })) return res.status(404).json({ error: `unknown reward "${id}"` });
  assignReward(memberId, id);
  publish('economy');
  res.json({ ok: true });
});

economyRoutes.post('/api/rewards/:id/unassign', (req, res) => {
  const { id } = req.params;
  const { memberId } = req.body || {};
  if (!MEMBER_IDS.includes(memberId)) return res.status(400).json({ error: `unknown memberId "${memberId}"` });
  unassignReward(memberId, id);
  publish('economy');
  res.json({ ok: true });
});

// Redeem: check balance, deduct, log, drop the assignment. 409 if the balance
// can't cover the cost.
economyRoutes.post('/api/rewards/:id/redeem', (req, res) => {
  const { id } = req.params;
  const { memberId } = req.body || {};
  if (!MEMBER_IDS.includes(memberId)) return res.status(400).json({ error: `unknown memberId "${memberId}"` });
  const reward = getReward(id);
  if (!reward) return res.status(404).json({ error: `unknown reward "${id}"` });
  try {
    const balance = redeemReward(memberId, id, reward.cost);
    publish('economy');
    res.json({ ok: true, balance });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

// --- Catalog editing ------------------------------------------------------
// Creating/editing/removing a reward is typing, so it's companion-PWA-only and
// parent-gated (requireParentMobileAuth — a valid mobile session belonging to a
// parent). Hiding needs no keyboard, so it's also reachable from the login-free
// wall Manage view and left ungated, matching assign/unassign above.

// Create a custom reward.
economyRoutes.post('/api/rewards', requireParentMobileAuth, (req, res) => {
  try {
    const reward = createReward(req.body || {});
    publish('economy');
    res.json({ ok: true, reward });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Edit a custom reward's fields (id stays frozen; built-ins are file-only).
economyRoutes.patch('/api/rewards/:id', requireParentMobileAuth, (req, res) => {
  try {
    const reward = updateReward(req.params.id, req.body || {});
    publish('economy');
    res.json({ ok: true, reward });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Remove a custom reward (hard-delete if never redeemed, else hide).
economyRoutes.delete('/api/rewards/:id', requireParentMobileAuth, (req, res) => {
  try {
    const result = removeCustomReward(req.params.id);
    publish('economy');
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Hide or show any reward (built-in or custom). Ungated — reachable from the
// wall Manage view as well as the PWA.
economyRoutes.post('/api/rewards/:id/hide', (req, res) => {
  try {
    const reward = setRewardHidden(req.params.id, !!(req.body || {}).hidden);
    publish('economy');
    res.json({ ok: true, reward });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
