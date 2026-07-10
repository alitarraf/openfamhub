/* Demo seed — makes a fresh, unconfigured instance show a *lived-in* wall
 * (populated Journal feed, kids with point balances, chores earned this week,
 * rewards being worked toward) instead of empty DB-backed screens.
 *
 * Why this exists: journal + economy are the only domains with NO mock
 * fallback (unlike tasks/meals/budget, which the frontend fills from bundled
 * mock when their integration is blank). A brand-new demo DB therefore shows
 * a genuinely empty Journal and everyone at 0 points. This seeds those two.
 *
 * SAFETY — this must never touch a real family install:
 *   1. Gated on `isDemo()` — an explicit `DEMO` env flag, or (zero-config) NO
 *      roster configured at all (no MEMBERS_CONFIG, no config/members.json), so
 *      we've fallen back to the shipped example roster. A configured family, or
 *      any explicit MEMBERS_CONFIG (as the tests use), never trips it; `DEMO=0`
 *      force-opts-out.
 *   2. Per-table empty checks — only ever seeds an empty table, so it never
 *      overwrites real rows and never re-seeds (idempotent across restarts).
 *   3. Wrapped in try/catch — a seed failure logs and is swallowed; it must
 *      not take down server boot.
 *
 * Dates are RELATIVE to today (see util/dates.js) so the demo always looks
 * recent, no matter when someone runs it. Member ids match members.example.json
 * (dad/mom/kid1=Mia/kid2=Leo); author_id/member_id are plain TEXT (no FK to the
 * file-based roster), so a differing roster just renders fallback avatars.
 */
import { rewards } from '../config/rewards.js';
import { lastNDates } from '../util/dates.js';
import { usingFallbackRoster } from '../config/members.js';

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);
const FALSY = new Set(['0', 'false', 'no', 'off']);

/** Is this a demo instance we should populate? Explicit DEMO flag wins; absent
 * that, treat the shipped example roster as the demo tell. */
function isDemo() {
  const flag = (process.env.DEMO || '').trim().toLowerCase();
  if (TRUTHY.has(flag)) return true; // explicit opt-in wins — even in tests (so the seed itself is testable)
  if (FALSY.has(flag)) return false;
  // Automated tests run zero-config (throwaway DB, no roster) and would otherwise
  // look exactly like a demo instance — never auto-seed inside `node --test`.
  if (process.env.NODE_TEST_CONTEXT) return false;
  return usingFallbackRoster();
}

export function seedDemo(db) {
  if (!isDemo()) return;
  try {
    const seeded = [];
    if (seedEconomy(db)) seeded.push('economy');
    if (seedJournal(db)) seeded.push('journal');
    if (seeded.length) console.log(`[demo] seeded ${seeded.join(' + ')} sample data`);
  } catch (e) {
    console.warn('[demo] seed skipped:', e.message);
  }
}

const nonEmpty = (db, table) => !!db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get();

/* ── Economy: balances + ledger (chores earned this week) + reward assignments ── */
function seedEconomy(db) {
  if (nonEmpty(db, 'balances') || nonEmpty(db, 'ledger') || nonEmpty(db, 'assignments')) return false;

  const d = lastNDates(7); // [6-days-ago … today]
  const at = (date, hh = '09') => `${date}T${hh}:00:00.000Z`;

  // Per-kid chore log. Each entry is one date's chores (distinct task_ids per
  // day so getWeekRecap counts each as a separate chore). Today's row makes the
  // "earned today" number non-zero on the wall.
  const chores = {
    kid1: [
      [d[6], ['feed-dog', 'make-bed', 'homework']],
      [d[5], ['dishes', 'tidy-room']],
      [d[4], ['feed-dog', 'homework']],
      [d[3], ['make-bed', 'dishes']],
      [d[2], ['feed-dog', 'tidy-room']],
      [d[1], ['homework', 'make-bed']],
      [d[0], ['feed-dog', 'dishes']]
    ],
    kid2: [
      [d[6], ['feed-fish', 'make-bed']],
      [d[5], ['tidy-room']],
      [d[4], ['homework']],
      [d[3], ['feed-fish', 'make-bed']],
      [d[2], ['tidy-room']],
      [d[1], ['homework']]
    ]
  };
  // A redemption or two, so balances aren't just "total chores" and the Rewards
  // screen has redemption history. { member, rewardId, cost, date }.
  const redemptions = [{ member: 'kid1', rewardId: 'ice-cream', cost: 5, date: d[4] }];
  // What each kid is currently working toward (validated against the catalog).
  const working = { kid1: ['movie-night-pick', 'extra-screen-time'], kid2: ['ice-cream', 'pick-dessert'] };

  const catalog = new Set(rewards().map((r) => r.id));
  const award = db.prepare(
    `INSERT INTO ledger (member_id, delta, reason, task_id, local_date, created_at)
     VALUES (?, 1, 'award', ?, ?, ?)`
  );
  const redeem = db.prepare(
    `INSERT INTO ledger (member_id, delta, reason, reward_id, created_at) VALUES (?, ?, 'redeem', ?, ?)`
  );
  const setBalance = db.prepare(`INSERT INTO balances (member_id, points) VALUES (?, ?)`);
  const assign = db.prepare(`INSERT INTO assignments (member_id, reward_id, created_at) VALUES (?, ?, ?)`);

  const tx = db.transaction(() => {
    const earned = {};
    for (const [member, log] of Object.entries(chores)) {
      earned[member] = 0;
      for (const [date, taskIds] of log) {
        for (const taskId of taskIds) {
          award.run(member, taskId, date, at(date));
          earned[member] += 1;
        }
      }
    }
    for (const r of redemptions) {
      if (!catalog.has(r.rewardId)) continue;
      redeem.run(r.member, -r.cost, r.rewardId, at(r.date, '18'));
      earned[r.member] = (earned[r.member] || 0) - r.cost;
    }
    for (const [member, points] of Object.entries(earned)) setBalance.run(member, points);
    for (const [member, ids] of Object.entries(working)) {
      for (const id of ids) if (catalog.has(id)) assign.run(member, id, at(d[6]));
    }
  });
  tx();
  return true;
}

/* ── Journal: a warm, varied feed with a photo entry + an "on this day" anchor ── */
function seedJournal(db) {
  if (nonEmpty(db, 'journal_entries')) return false;

  const d = lastNDates(7); // [6-days-ago … today]
  const t = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const anniversary = `${t.getFullYear() - 1}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; // one year ago today

  // Oldest first isn't required (created_at drives feed order), but each entry
  // gets a created_at derived from its local_date so the feed reads newest-first
  // and the year-old anchor sinks to the bottom while still lighting "on this day".
  const entries = [
    {
      localDate: anniversary,
      authorId: 'dad',
      tag: 'milestone',
      memberIds: ['kid2'],
      text: 'One year ago today — Leo took his first wobbly steps across the living room, straight into the couch.'
    },
    {
      localDate: d[1],
      authorId: 'mom',
      tag: 'school',
      memberIds: ['kid1'],
      text: "Mia's last day of 2nd grade. Report card on the fridge, then straight to the pool to celebrate."
    },
    {
      localDate: d[2],
      authorId: 'dad',
      tag: 'quote',
      memberIds: ['kid2'],
      text: 'Leo at breakfast: "When I grow up I want to be a dinosaur that helps people."'
    },
    {
      localDate: d[3],
      authorId: 'mom',
      tag: 'recap',
      memberIds: ['kid1', 'kid2'],
      text: 'Beach day — sandcastles, three popsicles each, and a very quiet drive home.'
    },
    {
      localDate: d[5],
      authorId: 'dad',
      tag: 'health',
      memberIds: ['kid1'],
      text: "Mia's 6-month dental check: no cavities. Very proud of the dinosaur sticker."
    },
    {
      localDate: d[6],
      authorId: 'mom',
      tag: 'milestone',
      memberIds: ['kid2'],
      photoPath: '/demo/journal/pancakes.png',
      text: 'Pancakes this morning. Leo flipped one entirely by himself (it mostly landed back in the pan).'
    }
  ];

  const insEntry = db.prepare(
    `INSERT INTO journal_entries (author_id, text, tag, photo_path, hearts, local_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insMember = db.prepare(`INSERT INTO journal_entry_members (entry_id, member_id) VALUES (?, ?)`);

  const tx = db.transaction(() => {
    for (const e of entries) {
      const hearts = e.tag === 'milestone' ? 2 : 0; // a couple hearts so the feed feels used
      const info = insEntry.run(e.authorId, e.text, e.tag, e.photoPath || null, hearts, e.localDate, `${e.localDate}T09:00:00.000Z`);
      for (const m of e.memberIds) insMember.run(info.lastInsertRowid, m);
    }
  });
  tx();
  return true;
}
