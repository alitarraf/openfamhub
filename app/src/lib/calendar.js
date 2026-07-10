// Date + calendar helpers and the (mock) event source. The event source is keyed
// by day-of-month so every month shows plausible content until the iCal adapter
// replaces it; member attribution drives per-person color + the Day view.
import { MEAL_SLOTS, MEAL_MENUS } from './data/mock.js';
import { liveEvents } from './events.svelte.js';
import { byId } from './roster.svelte.js';

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];
export const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const WEEKDAYS_MINI = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EVENTS_BY_DOM = {
  1: [{ m: 'dad', time: '9:00', title: 'Standup' }],
  2: [{ m: 'kid2', time: '4:00', title: 'Soccer' }],
  3: [{ m: 'mom', time: '10:30', title: 'Book club' }],
  6: [
    { m: 'kid1', time: '4:00', title: 'Piano' },
    { m: 'kid2', time: '7:00', title: 'Game night' }
  ],
  8: [
    { m: 'dad', time: '1:00', title: 'Team 1:1' },
    { m: 'mom', time: '3:00', title: 'Dentist' }
  ],
  10: [{ m: 'kid1', time: '10:00', title: 'Field trip' }],
  13: [{ m: 'mom', time: '7:00', title: 'Date night' }],
  15: [
    { m: 'dad', time: '6:00a', title: 'Flight to SFO' },
    { m: 'dad', time: '5:00', title: 'Deadline' }
  ],
  17: [{ m: 'mom', time: '11:00', title: 'Brunch' }],
  20: [{ m: 'kid2', time: '9:00', title: 'Swim meet' }],
  22: [
    { m: 'kid1', time: '4:00', title: 'Recital' },
    { m: 'dad', time: '2:00', title: 'Review' }
  ],
  24: [{ m: 'mom', time: '8:00', title: 'Movie night' }],
  27: [
    { m: 'mom', time: '12:00', title: 'Picnic' },
    { m: 'kid2', time: '3:00', title: 'BBQ' }
  ],
  29: [{ m: 'dad', time: '9:00', title: 'Conference' }],
  31: [{ m: 'kid1', time: '10:00', title: 'Yard cleanup' }]
};

export function eventsForDom(dom) {
  return (EVENTS_BY_DOM[dom] || []).map((e) => {
    const member = byId(e.m); // undefined if the roster no longer has this id
    return { ...e, color: member?.color, member };
  });
}

const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

// Events for a specific calendar date. Uses the live iCal store when a feed has
// hydrated; otherwise falls back to the mock keyed by day-of-month (so every
// month still shows plausible content with no feed). This is the single seam all
// views consume, keeping live vs. mock invisible to the components.
export function eventsForDate(date) {
  const live = liveEvents();
  if (live) return live.get(ymd(date)) || [];
  return eventsForDom(date.getDate());
}

export const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};
export const addMonths = (date, n) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
};
export const startOfWeek = (date) => addDays(date, -date.getDay());

// Month descriptor consumed by MonthGrid (month/twoweek/full variants).
export function buildMonth(anchor, today = new Date()) {
  const year = anchor.getFullYear();
  const monthIndex = anchor.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const isCurrent = today.getFullYear() === year && today.getMonth() === monthIndex;
  const events = {};
  const dots = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const evs = eventsForDate(new Date(year, monthIndex, d));
    if (evs.length) {
      events[d] = evs.map((e) => ({ color: e.color, title: e.title }));
      // Mock events carry a resolved `member`; live events only carry the id
      // (`m`) — resolve it here so MonthGrid can render a mini avatar per
      // event instead of a plain color dot. Stays undefined for events with
      // no attribution at all (shows as a plain dot, same as before).
      dots[d] = evs.map((e) => e.member ?? byId(e.m));
    }
  }
  return {
    label: MONTHS[monthIndex],
    year,
    monthIndex,
    firstDay,
    daysInMonth,
    today: isCurrent ? today.getDate() : -1,
    events,
    dots
  };
}

export function weekDates(anchor) {
  const s = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

export function fmtWeekRange(dates) {
  const a = dates[0];
  const b = dates[6];
  const m1 = MONTHS[a.getMonth()].slice(0, 3);
  if (a.getMonth() === b.getMonth()) return `${m1} ${a.getDate()} – ${b.getDate()}`;
  return `${m1} ${a.getDate()} – ${MONTHS[b.getMonth()].slice(0, 3)} ${b.getDate()}`;
}

export const fmtLongDate = (date) => `${WEEKDAY_NAMES[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;

// Meal plan for the week containing `anchor`. Menu rotates by week-start so
// paging weeks shows variety; deterministic per week. (Mock until Mealie.)
export function mealsForWeek(anchor) {
  const dates = weekDates(anchor);
  const weekNo = Math.floor(startOfWeek(anchor).getTime() / (7 * 24 * 60 * 60 * 1000));
  const menu = MEAL_MENUS[((weekNo % MEAL_MENUS.length) + MEAL_MENUS.length) % MEAL_MENUS.length];
  return {
    slots: MEAL_SLOTS,
    days: dates.map((date, i) => ({ date, meals: menu[i] }))
  };
}
