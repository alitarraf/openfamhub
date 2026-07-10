/* Live calendar event store (additive over the mock source).
 *
 * Default state is `null` = no feed loaded → calendar.js falls back to the mock
 * day-of-month events, so with no creds the app renders byte-identically to before.
 * On a successful /api/calendar fetch this fills with real events keyed by
 * 'YYYY-MM-DD'; reads happen inside the views' $derived blocks, so the calendar
 * re-renders when hydration lands.
 *
 * (.svelte.js so the $state rune is reactive across modules.)
 */
import { getCalendar } from './api.js';

let live = $state(null); // Map<'YYYY-MM-DD', Array<{time,title,color,m}>> | null

const pad2 = (n) => String(n).padStart(2, '0');
// Local-date key (NOT toISOString — UTC shift misfiles evening events onto the
// wrong day). Must match calendar.js's ymd so the store's keys line up.
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Current live map, or null when no feed has hydrated. Read by calendar.js. */
export function liveEvents() {
  return live;
}

/**
 * Fetch events for [start, end] and MERGE them into the store for that window.
 *
 * Not a full replace: Home and Calendar screens stay mounted together and each
 * re-hydrates a different-width window on every heartbeat (Home ~4wk, Calendar
 * anchor±3/10/21 by view). A full replace let whichever fetch resolved last
 * clobber the other's window — events flickered between the two ranges as the
 * two async fetches raced (the "disappearing events" bug). Instead we clear
 * only the refreshed window's dates then insert, so each window stays fresh
 * (dropping events deleted upstream) without wiping dates another screen owns.
 *
 * Svelte 5 does NOT proxy Map mutations — we build a new Map and REASSIGN
 * `live`; mutating in place would update the data but never re-render.
 *
 * On any failure (no feed, API down) the store is left as-is so the mock
 * fallback / previously-hydrated data stays in effect.
 */
export async function hydrateCalendar(start, end) {
  try {
    const { events } = await getCalendar(start, end);
    const next = new Map(live ?? []);
    const lo = ymd(start);
    const hi = ymd(end);
    // Clear the refreshed window first; every fetched event's date falls inside
    // it, so each gets a fresh array below (no aliasing with the copied map).
    for (const key of next.keys()) {
      if (key >= lo && key <= hi) next.delete(key);
    }
    for (const e of events) {
      if (!next.has(e.date)) next.set(e.date, []);
      // `m` (member id) stays null until a feed→member mapping exists; the Day
      // view's per-person columns only show events that carry one.
      next.get(e.date).push({ time: e.time, title: e.title, color: e.color, m: e.m ?? null });
    }
    live = next;
  } catch (err) {
    console.warn('[api] calendar → mock fallback:', err.message);
  }
}
