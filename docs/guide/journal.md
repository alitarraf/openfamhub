# Journal

A running family scrapbook — milestones, funny quotes, everyday moments — written from
the phone, displayed on the wall. No configuration or integration needed; it's a
first-party feature of the app, stored in the same local SQLite database as the points
economy.

::: info Entries are written on the phone, never on the wall
Same reason the wall never has an "add a chore" form: no keyboard on a kiosk. See
[Mobile (PWA) → Writing a journal entry](/guide/mobile#writing-a-journal-entry).
:::

## Feed

The default view — a reverse-chronological card per entry:

- A colored left edge in the **author's** color (who posted it).
- A photo, if one was attached.
- A tag badge (Milestone / Funny Quote / School / Health), if the entry has one —
  entries don't need a tag.
- Avatar chips for whoever the entry is **about** — separate from who posted it, so
  Mom can post an entry about something Dad or a kid did.
- Tap the ❤ to react. Anonymous, like every other tap on the wall — it's a plain
  counter, not tied to who tapped it.

## Timeline

Toggle to Timeline for the same entries grouped by month, with a date circle per entry
(same treatment as the calendar's day-of-month numerals) instead of a flat feed.

If any entry from a previous year shares today's month and day, an **On this day**
card appears above the timeline — the one thing the timeline view can do that the feed
can't, since it depends on the entries actually spanning more than one year.

## Editing and deleting

Self-service only — from the phone, whoever posted an entry can edit or delete it.
There's no wall-side or parent-override delete; see
[Mobile (PWA)](/guide/mobile#writing-a-journal-entry) for how.

## Weekly & monthly recaps

Every **Sunday evening** the app posts an entry of its own, tagged **Recap** and
authored by "family": chores done and stars earned per member that week, streaks,
any rewards redeemed, and the week's most-loved journal moment. On the **1st of each
month** a matching monthly recap covers the previous month.

Because recaps are ordinary journal entries, they stay browsable forever — scroll the
Timeline to see how any past week went, and old recaps can resurface in **On this
day**. The posting hour is configurable (`RECAP_HOUR`, default 19). Recaps can't be
edited or deleted from the PWA (they belong to the system author, and the journal is
strictly self-service).
