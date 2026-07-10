/* Auth tests — PIN verification, lockout, session expiry, and the Budget
 * unlock gate. Pins the roster to the committed example file (MEMBERS_CONFIG)
 * so a real gitignored config/members.json on the dev box can't change what
 * the tests see. Env + Date.now are set up BEFORE auth.js is imported (module
 * state: sessions/attempts Maps), hence the dynamic import.
 */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
process.env.MEMBERS_CONFIG = join(ROOT, 'config', 'members.example.json');
process.env.MEMBER_PIN_DAD = '1234';
process.env.MEMBER_PIN_MOM = '5678';
process.env.MEMBER_PIN_KID1 = '1111';
// kid2 deliberately has no PIN configured.
process.env.BUDGET_UNLOCK_MEMBERS = 'dad,mom';

const { checkLogin, sessionMember, destroySession, unlockBudget } = await import('../auth.js');

let passed = 0;
const ok = (name, fn) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

/** Run fn with Date.now() shifted forward by `ms`. */
const realNow = Date.now;
function atOffset(ms, fn) {
  Date.now = () => realNow() + ms;
  try {
    return fn();
  } finally {
    Date.now = realNow;
  }
}

const HOUR = 60 * 60 * 1000;

console.log('login');
ok('right PIN logs in and issues a session', () => {
  const r = checkLogin('dad', '1234');
  assert.equal(r.ok, true);
  assert.equal(r.memberId, 'dad');
  assert.equal(sessionMember(r.sessionId), 'dad');
});
ok('wrong PIN, unknown member, and unconfigured PIN all refuse', () => {
  assert.equal(checkLogin('dad', '0000').ok, false);
  assert.equal(checkLogin('stranger', '1234').error, 'unknown member');
  assert.equal(checkLogin('kid2', '1234').error, 'PIN not configured for this member');
});
ok('a bogus/destroyed session id resolves to nobody', () => {
  assert.equal(sessionMember('not-a-session'), null);
  const r = checkLogin('dad', '1234');
  destroySession(r.sessionId);
  assert.equal(sessionMember(r.sessionId), null);
});

console.log('session expiry');
ok('session survives 23h, dies at 25h (24h rolling)', () => {
  const r = checkLogin('mom', '5678');
  assert.equal(
    atOffset(23 * HOUR, () => sessionMember(r.sessionId)),
    'mom'
  );
  assert.equal(
    atOffset(25 * HOUR, () => sessionMember(r.sessionId)),
    null
  );
  // expiry is destructive — the session is gone even back at "now"
  assert.equal(sessionMember(r.sessionId), null);
});

console.log('lockout');
ok('5 wrong attempts lock the member out — even with the right PIN', () => {
  for (let i = 0; i < 5; i++) assert.equal(checkLogin('kid1', '9999').ok, false);
  assert.match(checkLogin('kid1', '1111').error, /too many attempts/);
});
ok('lockout expires after 15 minutes and a good login clears the counter', () => {
  const r = atOffset(16 * 60 * 1000, () => checkLogin('kid1', '1111'));
  assert.equal(r.ok, true);
  // counter reset: one more wrong attempt doesn't re-lock
  checkLogin('kid1', '9999');
  assert.equal(checkLogin('kid1', '1111').ok, true);
});
ok('lockout is per-member — dad locked, mom unaffected', () => {
  for (let i = 0; i < 5; i++) checkLogin('dad', '0000');
  assert.match(checkLogin('dad', '1234').error, /too many attempts/);
  assert.equal(checkLogin('mom', '5678').ok, true);
});

console.log('budget unlock');
ok('only BUDGET_UNLOCK_MEMBERS can unlock, with their PIN', () => {
  assert.match(unlockBudget('kid1', '1111').error, /ask a parent/);
  assert.equal(unlockBudget('mom', '0000').ok, false);
  assert.equal(unlockBudget('mom', '5678').ok, true);
});
ok('a budget unlock does NOT create a mobile session', () => {
  const r = unlockBudget('mom', '5678');
  assert.equal(r.ok, true);
  assert.equal(sessionMember(r.token), null); // separate token space by design
});

console.log(`\n${passed} auth assertions passed`);
