/* Mobile PWA auth — 4-digit PIN per member, session cookie, in-memory store.
 *
 * The wall stays login-free by design (trusted physical kiosk — tap your
 * avatar to act). This is only for the companion PWA, reachable over
 * Tailscale (network layer does the real access control — see PRD). PIN
 * auth here is defense-in-depth on top of that, not the primary boundary.
 *
 * PINs live in `.env` as plain values (MEMBER_PIN_DAD=1234, ...), consistent
 * with every other credential in this app (Todoist token, Mealie token,
 * Monarch password all live the same way) — a hashed-at-rest PIN store would
 * need a separate CLI/step to populate and buys little at this trust level.
 * Compared with a timing-safe hash comparison, not a plain `===`.
 *
 * Sessions are an in-memory Map, not persisted — a server restart just means
 * everyone re-enters their PIN, which is an acceptable tradeoff for a family
 * app (no session-store infra to run/maintain).
 */
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { members } from './config/members.js';

const SESSION_MS = 24 * 60 * 60 * 1000; // "daily login" — 24h rolling from last login
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const sessions = new Map(); // sessionId -> { memberId, expiresAt }
const attempts = new Map(); // memberId -> { count, lockedUntil }

const pinFor = (memberId) => (process.env[`MEMBER_PIN_${memberId.toUpperCase()}`] || '').trim();

function safeEqual(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return ha.length === hb.length && timingSafeEqual(ha, hb);
}

/** Shared by mobile login and the budget unlock gate — checks the PIN and
 * the shared lockout counter, without issuing a mobile session. */
function verifyPin(memberId, pin) {
  if (!members().some((m) => m.id === memberId)) return { ok: false, error: 'unknown member' };
  const configured = pinFor(memberId);
  if (!configured) return { ok: false, error: 'PIN not configured for this member' };

  const a = attempts.get(memberId);
  if (a?.lockedUntil && a.lockedUntil > Date.now()) {
    return { ok: false, error: 'too many attempts — try again later' };
  }
  if (!pin || !safeEqual(pin, configured)) {
    const count = (a?.count || 0) + 1;
    attempts.set(memberId, { count, lockedUntil: count >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : null });
    return { ok: false, error: 'wrong PIN' };
  }
  attempts.delete(memberId);
  return { ok: true };
}

/** { ok:true, sessionId, memberId } or { ok:false, error }. */
export function checkLogin(memberId, pin) {
  const v = verifyPin(memberId, pin);
  if (!v.ok) return v;
  const sessionId = randomBytes(24).toString('hex');
  sessions.set(sessionId, { memberId, expiresAt: Date.now() + SESSION_MS });
  return { ok: true, sessionId, memberId };
}

/** memberId for a valid, unexpired session, else null. */
export function sessionMember(sessionId) {
  const s = sessionId && sessions.get(sessionId);
  if (!s) return null;
  if (s.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return s.memberId;
}

export function destroySession(sessionId) {
  if (sessionId) sessions.delete(sessionId);
}

const COOKIE_NAME = 'openfamhub_session';

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const found = raw
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : null;
}

export function getSessionCookie(req) {
  return getCookie(req, COOKIE_NAME);
}

export function setSessionCookie(res, sessionId) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${sessionId}; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS / 1000}; Path=/`
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/`);
}

/** Express middleware — 401s without a valid session, else sets req.memberId. */
export function requireMobileAuth(req, res, next) {
  const memberId = sessionMember(getSessionCookie(req));
  if (!memberId) return res.status(401).json({ error: 'not logged in' });
  req.memberId = memberId;
  next();
}

/** Like requireMobileAuth, but also requires the logged-in member to be a
 * parent — for PWA writes that only parents may make (editing the babysitter
 * emergency info). No second PIN: identity was already proven at PWA login, so
 * a parent's session is sufficient (403 for a signed-in non-parent, e.g. a kid). */
export function requireParentMobileAuth(req, res, next) {
  const memberId = sessionMember(getSessionCookie(req));
  if (!memberId) return res.status(401).json({ error: 'not logged in' });
  if (!parentIds().includes(memberId)) return res.status(403).json({ error: 'parents only' });
  req.memberId = memberId;
  next();
}

/* --- Budget tab gate — the wall stays login-free everywhere else, but
 * finances get a lightweight PIN check on top, restricted to a parent
 * subset of the roster (BUDGET_UNLOCK_MEMBERS, default "dad,mom"). Separate
 * from the mobile session above: shorter-lived (re-locks after 15 idle
 * minutes rather than 24h) and scoped to its own cookie, so unlocking
 * Budget on the shared kiosk doesn't also hand out a day-long mobile
 * session for that member. */
const BUDGET_COOKIE = 'openfamhub_budget';
const BUDGET_UNLOCK_MS = 15 * 60 * 1000;
const budgetTokens = new Map(); // token -> expiresAt

/** Roster ids allowed through the parent gate (Budget, Settings, and the
 * Babysitter-mode exit). BUDGET_UNLOCK_MEMBERS keeps its historical name; the
 * concept it names is simply "the parents". */
export const parentIds = () =>
  (process.env.BUDGET_UNLOCK_MEMBERS || 'dad,mom')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** Check a parent's PIN without minting any session or cookie — for one-shot
 * confirmations like exiting Babysitter mode. { ok:true } or { ok:false, error }. */
export function verifyParentPin(memberId, pin) {
  if (!parentIds().includes(memberId)) return { ok: false, error: 'ask a parent' };
  return verifyPin(memberId, pin);
}

/** { ok:true, token } or { ok:false, error }. */
export function unlockBudget(memberId, pin) {
  const v = verifyParentPin(memberId, pin);
  if (!v.ok) return v.error === 'ask a parent' ? { ok: false, error: 'ask a parent to view Budget' } : v;
  const token = randomBytes(24).toString('hex');
  budgetTokens.set(token, Date.now() + BUDGET_UNLOCK_MS);
  return { ok: true, token };
}

export function setBudgetCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${BUDGET_COOKIE}=${token}; HttpOnly; SameSite=Lax; Max-Age=${BUDGET_UNLOCK_MS / 1000}; Path=/`
  );
}

/** Express middleware — 401s without a valid, unexpired budget unlock. */
export function requireBudgetAuth(req, res, next) {
  const token = getCookie(req, BUDGET_COOKIE);
  const expiresAt = token && budgetTokens.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    if (token) budgetTokens.delete(token);
    return res.status(401).json({ error: 'budget locked' });
  }
  next();
}
