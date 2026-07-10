# Budget

Requires the optional [Monarch Money integration](/integrations/budget) — with
nothing configured, this screen shows a demo budget so the layout is still browsable.

## Locked by default

Unlike the rest of the wall, Budget isn't login-free — finances stay visible on the
kitchen wall, but opening the tab asks for a parent's PIN first (same PIN as the
[Companion PWA](/guide/mobile)). It re-locks after about 15 minutes. Which members can
unlock it is configured via `BUDGET_UNLOCK_MEMBERS` in `.env` (defaults to `dad,mom`) —
see [self-hosting](/self-hosting).

## The hero number

The big number is **safe to spend**: total budgeted minus total spent, across every
category — a *true net*, not a sum of only the categories still in the black. A
category that's over budget, or spending with no budget set at all, both pull the
number down instead of being hidden from it. If the household's genuinely over for the
period, the number goes negative and turns red ("over budget") rather than floor at
zero.

Below it, an **updated `_` ago** caption shows the sidecar's last successful sync. Past
24 hours old (This Month only — see below), it switches to a warning treatment: Monarch
has no official API, so the sidecar's login can silently start failing, and a
stale-but-confident-looking number is worse than an obviously-stale one.

## Category rows

Sorted **biggest spend first**. Each row shows the category's spent-vs-budget bar and
either "`$_` left" or "`$_` over."

## This Month / Last Month / Year to Date

The segmented control at top switches between three periods:

| Period | Source |
|---|---|
| **This Month** | The sidecar's current live snapshot — always available once Monarch is configured |
| **Last Month** | The sidecar's history directory — only exists once it's run across a month boundary |
| **Year to Date** | Every captured month of the current year, summed per category, plus the live current month |

If a period genuinely hasn't been captured yet, the screen says so plainly ("Not
tracked yet") rather than showing demo numbers under a real-sounding label — a
fabricated "Last Month" would be worse than an honest blank one.

::: info History starts accumulating once Monarch is connected
The sidecar mirrors each live sync into `data/monarch-history/<YYYY-MM>.json`
alongside the current-month snapshot it always wrote. **Last Month** shows up the
first time the sidecar has run in a completed calendar month — there's no
backfill, since Monarch doesn't expose historical budget data.
:::
