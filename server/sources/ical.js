/* Calendar source — iCal/ICS feeds, expanded to dated events over a range.
 *
 * Two kinds of config:
 *   CALENDAR_ICS_URL_<ID>  — a member's own feed(s). Every event maps to that
 *                            member (Day view's per-person column) and takes
 *                            their roster color, same as their avatar chip
 *                            everywhere else in the app.
 *   CALENDAR_ICS_URL       — shared/unattributed feed(s), nobody in
 *                            particular owns these. Gets a stable color from
 *                            CAL_PALETTE by position; lands in Day view's
 *                            "Everyone" column.
 * Both accept one or more URLs, ';' or ',' separated. Recurrence is handled
 * by node-ical's rrule (do NOT hand-roll RRULE — family calendars are full
 * of it and that's where parsers break).
 *
 * `expand` is a pure transform (parsed ICS -> events) so it's fixture-testable.
 */
import ical from 'node-ical';
import { members } from '../config/members.js';

const CAL_PALETTE = ['#2E8BC0', '#E0699A', '#2FA37C', '#E0A11B', '#8E6FD8', '#E0664B'];

const parseFeeds = (raw) =>
  (raw || '')
    .split(/[;,]/) // accept ',' or ';' — .env.example documents ';'
    .map((s) => s.trim())
    .filter(Boolean);

/** [{ member, urls }, ...] for every roster member with CALENDAR_ICS_URL_<ID> set. */
function memberFeeds() {
  return members()
    .map((m) => ({ member: m, urls: parseFeeds(process.env[`CALENDAR_ICS_URL_${m.id.toUpperCase()}`]) }))
    .filter((f) => f.urls.length);
}

const sharedFeeds = () => parseFeeds(process.env.CALENDAR_ICS_URL);

export const hasCalendar = () => memberFeeds().length > 0 || sharedFeeds().length > 0;

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d) => `${d.getHours()}:${pad(d.getMinutes())}`;

/**
 * Flatten one parsed ICS object into dated events within [start, end].
 *   { date:'YYYY-MM-DD', time:'H:MM'|'', title, color, m }
 * `m` is the owning member's id, or null for an unattributed/shared feed —
 * Day view groups by it, Week/Month ignore it and just use `color`.
 * Recurring events are expanded via rrule.between; EXDATEs are skipped.
 */
export function expand(parsed, start, end, color, memberId = null) {
  const out = [];
  for (const key in parsed) {
    const ev = parsed[key];
    if (!ev || ev.type !== 'VEVENT') continue;
    const allDay = ev.datetype === 'date';
    const title = ev.summary || '(untitled)';

    if (ev.rrule) {
      const ex = ev.exdate || {};
      for (const occ of ev.rrule.between(start, end, true)) {
        const dayKey = ymd(occ);
        if (ex[dayKey]) continue;
        out.push({ date: dayKey, time: allDay ? '' : hm(occ), title, color, m: memberId });
      }
    } else if (ev.start instanceof Date) {
      if (ev.start >= start && ev.start <= end) {
        out.push({ date: ymd(ev.start), time: allDay ? '' : hm(ev.start), title, color, m: memberId });
      }
    }
  }
  return out;
}

// Parsed-feed cache. The download + node-ical parse of a family ICS is the
// expensive part (iCloud feeds run hundreds of KB / several seconds), and for
// feeds with recurring events the first rrule.between() over a given window is
// also slow (a Google feed here spends ~3.7s on 72 rrules); node-ical caches
// that per parsed object, so a *retained* parse keeps rrule expansion warm too.
// The two always-mounted wall screens (Home + Calendar) each hit /api/calendar
// with a DIFFERENT window, so caching the ROUTE by [start,end] would rarely
// hit — we cache the parsed feed by URL instead, and both windows reuse it.
//
// TTL is LONGER than the 5-min refresh heartbeat (was shorter, which meant the
// cache expired between heartbeats and only ever deduped the two concurrent
// same-heartbeat requests): with a longer TTL the parsed object — and its warm
// rrule cache — is reused across several heartbeats, so most heartbeats skip
// both the download and the re-expansion. Paired with day-aligned windows in
// fetchEvents (Home's window carries time-of-day and would otherwise drift
// every heartbeat, missing the rrule cache). Trade-off: calendar data can be
// up to TTL stale on the wall.
const FEED_TTL_MS = 15 * 60 * 1000;
const feedCache = new Map(); // url -> { at, value }  (value = parsed obj | null)
const inflight = new Map(); // url -> Promise  (dedupes concurrent fetches)

/** Fetch + parse one feed, cached; null on failure (logged, never thrown) —
 * one dead feed (expired share link, provider hiccup) must not blank the whole
 * wall calendar. On a transient failure we serve the last good parse (stale)
 * rather than null, so a single hiccup doesn't wipe the calendar. Concurrent
 * requests for the same URL (the two screens on one heartbeat) share one
 * in-flight fetch. The URL is truncated in the log because ICS share URLs
 * embed their secret. */
async function fetchFeed(url) {
  const cached = feedCache.get(url);
  if (cached && Date.now() - cached.at < FEED_TTL_MS) return cached.value;
  if (inflight.has(url)) return inflight.get(url);

  const p = (async () => {
    try {
      // webcal:// is a subscribe convention, not a real scheme — node-ical only
      // speaks http(s). iCloud/Google share links come as webcal; normalize.
      const httpUrl = url.replace(/^webcal:\/\//i, 'https://');
      const parsed = await ical.async.fromURL(httpUrl);
      feedCache.set(url, { at: Date.now(), value: parsed });
      return parsed;
    } catch (err) {
      console.warn(`calendar: feed failed (${url.slice(0, 40)}…): ${err.message}`);
      // Serve last-known-good on a transient failure; only null if we never
      // parsed this feed successfully. Don't refresh `at`, so the next request
      // retries instead of caching the failure for a full TTL.
      return cached ? cached.value : null;
    } finally {
      inflight.delete(url);
    }
  })();
  inflight.set(url, p);
  return p;
}

/**
 * Fetch + expand every configured feed (member-owned and shared) for the
 * [start, end] window. Returns { events: [...] } sorted by date then time.
 * Failed feeds are skipped (partial results beat none); throws only when
 * nothing is configured or EVERY feed failed — the route 503s and the
 * client falls back to its mock, same as any other dead source.
 */
export async function fetchEvents(startRaw, endRaw) {
  if (!hasCalendar()) {
    throw new Error('no calendar feeds configured (CALENDAR_ICS_URL_<ID> or CALENDAR_ICS_URL)');
  }
  // Day-align the window: floor start to local 00:00, ceil end to local
  // 23:59:59.999. The wall's Home screen recomputes `new Date()` each heartbeat,
  // so its raw bounds carry the current time-of-day and drift every 5 min —
  // which busts node-ical's per-window rrule.between cache and re-pays the full
  // expansion each heartbeat. Snapping to whole days makes the window (and thus
  // the rrule cache key) identical across a day's heartbeats. Transparent to the
  // client: events are day-keyed and views render whole days regardless.
  const start = new Date(startRaw);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endRaw);
  end.setHours(23, 59, 59, 999);
  const all = [];
  let feeds = 0;
  let failed = 0;

  for (const { member, urls } of memberFeeds()) {
    for (const url of urls) {
      feeds++;
      const parsed = await fetchFeed(url);
      if (!parsed) {
        failed++;
        continue;
      }
      all.push(...expand(parsed, start, end, member.color, member.id));
    }
  }

  const shared = sharedFeeds();
  for (let i = 0; i < shared.length; i++) {
    feeds++;
    const parsed = await fetchFeed(shared[i]);
    if (!parsed) {
      failed++;
      continue;
    }
    all.push(...expand(parsed, start, end, CAL_PALETTE[i % CAL_PALETTE.length]));
  }

  if (failed === feeds) throw new Error(`all ${feeds} calendar feed(s) failed`);

  all.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  return { events: all };
}
