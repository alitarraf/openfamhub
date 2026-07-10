# Calendar (iCal)

Powers the [Calendar](/guide/calendar) screen — any feed that publishes a
standard ICS URL works, including Google Calendar and iCloud.

## Per-person vs. shared feeds

Two kinds of config, same `<ID>` pattern as `TODOIST_UID_<ID>` / `MEMBER_PIN_<ID>`:

```bash [.env]
# A member's own calendar — every event maps to that person, and takes their
# roster color. Set one per person who has a personal calendar.
CALENDAR_ICS_URL_DAD=https://calendar.google.com/.../dad/basic.ics
CALENDAR_ICS_URL_MOM=

# Shared feed(s) nobody in particular owns (e.g. a family events calendar).
# Shows in Day view's "Everyone" column instead of a specific person's.
CALENDAR_ICS_URL=
```

Both accept one or more URLs, separated by `;`. If a person's own calendar already
includes shared/family events (one Google Calendar with everything on it, say), just
set `CALENDAR_ICS_URL_<their ID>` to that feed — no need to also duplicate it under
the shared `CALENDAR_ICS_URL`.

## Google Calendar

Use each calendar's **secret address in iCal format**: Google Calendar → Settings →
Settings for my calendars → *(your calendar)* → Integrate calendar.

## iCloud

Apple's CalDAV calendars can be shared as a public ICS link via
Calendar.app → *(calendar)* → Share Calendar → Public Calendar, which gives you a
`webcal://` URL — swap the scheme for `https://` and use that.

## Colors

A member feed always uses that person's own roster color (`config/members.json`) —
consistent with their avatar chip everywhere else in the app. A shared feed gets a
stable color from a fixed palette, in the order its URLs are listed, so calendar 1 is
always the same color across restarts.

Recurring events (RRULE, including `EXDATE` exceptions) are expanded server-side using
[`node-ical`](https://github.com/jens-maus/node-ical) — don't hand-roll RRULE parsing,
real family calendars exercise every edge case of the spec.

Nothing configured (neither kind) and the Calendar screen falls back to bundled demo
events, same as any other unconfigured source.
