/* Fixture tests for the Phase-2 source transforms — the parts most likely to be
 * wrong (auth/fetch is a faithful port). No network, no creds.
 *
 * Forced to UTC below (not just documented) — ical.js's expand() reads local
 * wall-clock hours, so a system TZ other than UTC silently shifted the
 * expected '16:00' assertions and failed on any non-UTC dev machine.
 */
process.env.TZ = 'UTC';
import assert from 'node:assert/strict';
import ical from 'node-ical';
import { condKey, mapCurrent, mapForecast } from '../sources/weather.js';
import { expand } from '../sources/ical.js';
import { mapBudget, mergeRawBudgets } from '../sources/monarch.js';
import { groupByAssignee } from '../sources/todoist.js';
import { mapMealPlan } from '../sources/mealie.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { members } from '../config/members.js';

let passed = 0;
const ok = (name, fn) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

console.log('weather');
ok('condKey maps Open-Meteo WMO codes → frontend WX keys', () => {
  assert.equal(condKey(0), 'sunny');
  assert.equal(condKey(1), 'sunny');
  assert.equal(condKey(2), 'partly');
  assert.equal(condKey(3), 'cloudy');
  assert.equal(condKey(45), 'cloudy'); // fog
  assert.equal(condKey(61), 'rain');
  assert.equal(condKey(95), 'rain'); // thunderstorm
  assert.equal(condKey(75), 'snow');
});
ok('mapCurrent → {wx,temp,hi,lo,place} rounded (hi/lo filled later from daily)', () => {
  const out = mapCurrent({ temperature_2m: 47.6, weather_code: 0 }, 'New York');
  assert.deepEqual(out, { wx: 'sunny', temp: 48, hi: null, lo: null, place: 'New York' });
});
ok('mapForecast maps parallel daily arrays → per-day entries with real date', () => {
  const out = mapForecast({
    time: ['2026-06-01', '2026-06-02'],
    weather_code: [3, 0],
    temperature_2m_max: [66.4, 70.2],
    temperature_2m_min: [50.1, 58.4]
  });
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { date: '2026-06-01', day: 'MON', wx: 'cloudy', hi: 66, lo: 50, today: true });
  assert.deepEqual(out[1], { date: '2026-06-02', day: 'TUE', wx: 'sunny', hi: 70, lo: 58, today: false });
});

console.log('ical');
ok('expand resolves single, all-day, and weekly-recurring events', () => {
  const ICS = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:1',
    'SUMMARY:Soccer',
    'DTSTART:20260601T160000Z',
    'DTEND:20260601T170000Z',
    'RRULE:FREQ=WEEKLY;COUNT=4',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:2',
    'SUMMARY:Dentist',
    'DTSTART:20260610T140000Z',
    'DTEND:20260610T150000Z',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:3',
    'SUMMARY:Holiday',
    'DTSTART;VALUE=DATE:20260615',
    'DTEND;VALUE=DATE:20260616',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\n');

  const parsed = ical.parseICS(ICS);
  const start = new Date('2026-06-01T00:00:00Z');
  const end = new Date('2026-06-30T23:59:59Z');
  const events = expand(parsed, start, end, '#2E8BC0').sort(
    (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
  );

  const soccer = events.filter((e) => e.title === 'Soccer').map((e) => e.date);
  assert.deepEqual(soccer, ['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22']);
  assert.ok(events.every((e) => e.title !== 'Soccer' || e.time === '16:00'));

  const dentist = events.find((e) => e.title === 'Dentist');
  assert.deepEqual({ date: dentist.date, time: dentist.time }, { date: '2026-06-10', time: '14:00' });

  const holiday = events.find((e) => e.title === 'Holiday');
  assert.equal(holiday.date, '2026-06-15');
  assert.equal(holiday.time, ''); // all-day → no time
  assert.ok(events.every((e) => e.color === '#2E8BC0'));
  assert.ok(events.every((e) => e.m === null)); // no memberId passed -> unattributed
});

ok('expand tags every event with the memberId it was called with, when given one', () => {
  const ICS = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:1',
    'SUMMARY:Standup',
    'DTSTART:20260601T160000Z',
    'DTEND:20260601T170000Z',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\n');
  const parsed = ical.parseICS(ICS);
  const events = expand(parsed, new Date('2026-06-01T00:00:00Z'), new Date('2026-06-02T00:00:00Z'), '#2E8BC0', 'dad');
  assert.equal(events.length, 1);
  assert.equal(events[0].m, 'dad');
});

console.log('monarch');
ok('mapBudget normalizes the sidecar snapshot (TitleCase keys) + attaches category icon/color', () => {
  const out = mapBudget({
    updated: '2026-06-30 12:00 UTC',
    demo: true,
    budgets: [
      { Category: 'Groceries', Budget: 800, Spent: 612, Left: 188 },
      { Category: 'Dining', Budget: 300, Spent: 274, Left: 26 }
    ]
  });
  assert.equal(out.demo, true);
  assert.equal(out.updated, '2026-06-30 12:00 UTC');
  assert.equal(out.budgets.length, 2);
  assert.deepEqual(out.budgets[0], {
    category: 'Groceries',
    budget: 800,
    spent: 612,
    left: 188,
    icon: 'local_grocery_store',
    catKey: 'fern'
  });
  // 'Dining' isn't in the curated map — falls back to the default style, not an error.
  assert.deepEqual(out.budgets[1].icon && { icon: out.budgets[1].icon, catKey: out.budgets[1].catKey }, {
    icon: 'category',
    catKey: 'sky'
  });
});

ok('mapBudget totals are a true net — overspending and unbudgeted spend both reduce it', () => {
  const out = mapBudget({
    budgets: [
      { Category: 'Groceries', Budget: 800, Spent: 612 }, // under budget
      { Category: 'Dining', Budget: 300, Spent: 350 }, // over budget by 50
      { Category: 'Uncategorized', Budget: 0, Spent: 75 } // unbudgeted spend
    ]
  });
  // 800 - 612 = 188, 300 - 350 = -50, 0 - 75 = -75 → 188 - 50 - 75 = 63
  assert.deepEqual(out.totals, { budget: 1100, spent: 1037, left: 63 });
});

ok('mergeRawBudgets sums per-category across snapshots, tolerating a category present in only some months', () => {
  const merged = mergeRawBudgets([
    {
      budgets: [
        { Category: 'Groceries', Budget: 400, Spent: 380 },
        { Category: 'Gifts', Budget: 100, Spent: 0 }
      ]
    },
    { budgets: [{ Category: 'Groceries', Budget: 420, Spent: 390 }] }, // Gifts absent this month — not an error
    { budgets: [] } // an empty/missing-budgets snapshot contributes nothing
  ]);
  assert.deepEqual(merged, [
    { Category: 'Groceries', Budget: 820, Spent: 770 },
    { Category: 'Gifts', Budget: 100, Spent: 0 }
  ]);
});

console.log('todoist');
ok('groupByAssignee buckets by responsible_uid, open-then-completed, drops unmapped', () => {
  const roster = [
    { id: 'dad', uid: '111' },
    { id: 'mom', uid: '222' },
    { id: 'kid1', uid: '333' },
    { id: 'kid2', uid: '' } // unmapped member → always empty
  ];
  const open = [
    { id: 'a', content: 'Trash', responsible_uid: '111', child_order: 2 },
    { id: 'b', content: 'Dishes', responsible_uid: '111', child_order: 1 },
    { id: 'c', content: 'Plants', responsible_uid: '222', child_order: 1 },
    { id: 'd', content: 'Unassigned', responsible_uid: null, child_order: 1 },
    { id: 'e', content: 'Stranger', responsible_uid: '999', child_order: 1 }
  ];
  const completed = [{ id: 'f', content: 'Vacuum', responsible_uid: '111', completed_at: '2026-06-30T09:00:00Z' }];
  const out = groupByAssignee(open, completed, roster);
  assert.deepEqual(
    out.map((m) => m.id),
    ['dad', 'mom', 'kid1', 'kid2']
  ); // roster order
  // dad's open tasks sorted by child_order (Dishes#1 before Trash#2), then the
  // completed one (done:true) appended.
  assert.deepEqual(out[0].tasks, [
    { id: 'b', title: 'Dishes', done: false },
    { id: 'a', title: 'Trash', done: false },
    { id: 'f', title: 'Vacuum', done: true }
  ]);
  assert.deepEqual(out[1].tasks, [{ id: 'c', title: 'Plants', done: false }]);
  assert.deepEqual(out[2].tasks, []); // kid1: none assigned
  assert.deepEqual(out[3].tasks, []); // kid2: no uid mapped
  // unassigned + stranger (uid 999, not in roster) are dropped
});

ok('groupByAssignee scales to a large roster (2 parents + 5 kids)', () => {
  // Guards against any fixed-size assumption creeping back into the pure
  // transform — the frontend grids are the layout half of this guarantee
  // (see app/src/lib/screens/*, sized with auto-fit/minmax, not a fixed count).
  const roster = [
    { id: 'parent1', uid: '1' },
    { id: 'parent2', uid: '2' },
    { id: 'kid1', uid: '3' },
    { id: 'kid2', uid: '4' },
    { id: 'kid3', uid: '5' },
    { id: 'kid4', uid: '6' },
    { id: 'kid5', uid: '7' }
  ];
  const open = roster.map((m, i) => ({
    id: `t${i}`,
    content: `Chore ${i}`,
    responsible_uid: m.uid,
    child_order: 1
  }));
  const out = groupByAssignee(open, [], roster);
  assert.equal(out.length, 7); // one bucket per roster member, none dropped
  assert.deepEqual(
    out.map((m) => m.id),
    roster.map((m) => m.id)
  ); // roster order preserved
  out.forEach((m, i) => assert.deepEqual(m.tasks, [{ id: `t${i}`, title: `Chore ${i}`, done: false }]));
});

// Verified against a live Mealie instance (2026-07-01) — the fixture below
// matches the real /mealplans payload shape.
console.log('mealie');
ok('mapMealPlan buckets entries by date into 4 slots, maps side→Snack col, skips unknowns', () => {
  const out = mapMealPlan([
    { date: '2026-06-22', entryType: 'breakfast', recipe: { id: 'r1', name: 'Oatmeal', slug: 'oatmeal' } },
    { date: '2026-06-22', entryType: 'dinner', recipe: { id: 'r2', name: 'Tacos', slug: 'tacos' } },
    { date: '2026-06-22', entryType: 'side', title: 'Fruit' }, // side → Snack (idx 3), no recipe → no img/slug
    { date: '2026-06-23', entryType: 'lunch', recipe: { id: 'r3', name: 'Soup', slug: 'soup' } },
    { date: '2026-06-23', entryType: 'brunch', recipe: { id: 'rX', name: 'Nope' } }, // unknown type → skipped
    { entryType: 'dinner', recipe: { id: 'rY', name: 'NoDate' } } // missing date → skipped
  ]);
  assert.deepEqual(Object.keys(out).sort(), ['2026-06-22', '2026-06-23']);
  assert.deepEqual(out['2026-06-22'], [
    { title: 'Oatmeal', img: '/api/mealie/img/r1', slug: 'oatmeal' }, // breakfast
    null, // lunch empty
    { title: 'Tacos', img: '/api/mealie/img/r2', slug: 'tacos' }, // dinner
    { title: 'Fruit', img: null, slug: null } // side → Snack, no recipe → no image/slug
  ]);
  assert.deepEqual(out['2026-06-23'], [null, { title: 'Soup', img: '/api/mealie/img/r3', slug: 'soup' }, null, null]);
});

// Roster config loading — arbitrary size, arbitrary ids, UID resolved from env
// per-id (not a fixed set of slots). Exercises a 7-member family on disk via a
// scratch config file, distinct from config/members.example.json.
console.log('members');
ok('members() loads an arbitrary-size roster from MEMBERS_CONFIG and resolves UIDs per id', () => {
  const dir = mkdtempSync(join(tmpdir(), 'openfamhub-members-'));
  const file = join(dir, 'members.json');
  const roster = [
    { id: 'parent1', name: 'Parent 1', color: '#111' },
    { id: 'parent2', name: 'Parent 2', color: '#222' },
    { id: 'kid1', name: 'Kid 1', color: '#333' },
    { id: 'kid2', name: 'Kid 2', color: '#444' },
    { id: 'kid3', name: 'Kid 3', color: '#555' },
    { id: 'kid4', name: 'Kid 4', color: '#666' },
    { id: 'kid5', name: 'Kid 5', color: '#777' }
  ];
  writeFileSync(file, JSON.stringify(roster));
  process.env.MEMBERS_CONFIG = file;
  process.env.TODOIST_UID_KID3 = '999';
  try {
    const out = members();
    assert.equal(out.length, 7);
    assert.deepEqual(
      out.map((m) => m.id),
      roster.map((m) => m.id)
    );
    assert.equal(out.find((m) => m.id === 'kid3').uid, '999'); // env-derived, id-based
    assert.equal(out.find((m) => m.id === 'kid1').uid, ''); // no env var set → empty, not a crash
  } finally {
    delete process.env.MEMBERS_CONFIG;
    delete process.env.TODOIST_UID_KID3;
    rmSync(dir, { recursive: true, force: true });
  }
});

console.log(`\n${passed} checks passed.`);
