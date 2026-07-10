# Configuration reference

Every configuration knob in one place. There are only three places anything is
configured:

| Where | What lives there |
| --- | --- |
| **`.env`** | All secrets and settings (copy from `.env.example`) |
| **`config/members.json`** | The family roster (copy from `config/members.example.json`) |
| **`data/photos/`** | Screensaver images (just drop files in — no config) |

::: tip `.env.example` is the source of truth
The repo's [`.env.example`](https://github.com/alitarraf/openfamhub/blob/main/.env.example)
is the canonical, always-current list with inline comments. This page mirrors it with a
bit more context. If the two ever disagree, believe `.env.example`.
:::

## How the `<ID>` variables work

Several variables end in a member id — `TODOIST_UID_<ID>`, `MEMBER_PIN_<ID>`,
`CALENDAR_ICS_URL_<ID>`. The `<ID>` is a roster id from `config/members.json`,
**uppercased**. So member `"id": "kid1"` uses `TODOIST_UID_KID1`, `MEMBER_PIN_KID1`, and
`CALENDAR_ICS_URL_KID1`. Any member left blank simply falls back to demo data.

## Settings screen overrides `.env`

A handful of timing values are **fresh-install defaults only**. Once someone saves the
wall's [Settings screen](/guide/settings) (parent-PIN gated), the saved value goes to the
database and wins over the env var. These are marked **DB-overridable** below:
`SLEEP_*`, `SCREENSAVER_*`, `CELEBRATE_CHORES`, and the `PUSH_*` toggles.

---

## Core

| Variable | Default | What it does |
| --- | --- | --- |
| `TZ` | `America/New_York` | IANA timezone (e.g. `America/Los_Angeles`). Must be a real tzdata name — an invalid one silently falls back to UTC and breaks the "completed today" midnight cutoff. |
| `BIND_ADDR` | *(blank = all interfaces)* | Which host interfaces publish port 8080. Blank = whole LAN. Set `127.0.0.1` to restrict to this host and reach it over Tailscale instead. See [Networking](/networking). |

## Roster & access

The roster itself is `config/members.json` (see [First-time setup](/first-time-setup#_1-set-up-your-family-roster)) — not an env var.

| Variable | Default | What it does |
| --- | --- | --- |
| `MEMBER_PIN_<ID>` | *(blank)* | 4-digit PIN for that member's companion-PWA login. Blank = they can't log in on mobile. The wall itself stays login-free. |
| `BUDGET_UNLOCK_MEMBERS` | `dad,mom` | Comma-separated member ids allowed to PIN-unlock the Budget tab on the wall. Each needs a `MEMBER_PIN_<ID>`. |

## Todoist — tasks & chores

Full walkthrough: [Todoist integration](/integrations/todoist).

| Variable | Default | What it does |
| --- | --- | --- |
| `TODOIST_TOKEN` | *(blank)* | API token (Todoist → Settings → Integrations → Developer). Blank = demo tasks. |
| `TODOIST_TODO_PROJECT` | `todos` | Shared Todoist project name for to-dos. |
| `TODOIST_ROUTINE_PROJECT` | `chores` | Shared Todoist project name for routines/chores. |
| `TODOIST_UID_<ID>` | *(blank)* | That member's Todoist user id. Discover with `curl -s localhost:8080/api/todoist/collaborators`. Blank = demo data for that person. |

## Calendar

Full walkthrough: [Calendar integration](/integrations/calendar).

| Variable | Default | What it does |
| --- | --- | --- |
| `CALENDAR_ICS_URL_<ID>` | *(blank)* | A member's personal iCal feed(s). Events take their roster color and land in their Day-view column. Multiple URLs separated by `;`. |
| `CALENDAR_ICS_URL` | *(blank)* | Shared feed(s) nobody owns (e.g. a family calendar). Shows in the "Everyone" column. |

## Mealie — meals & recipes

Full walkthrough: [Mealie integration](/integrations/mealie).

| Variable | Default | What it does |
| --- | --- | --- |
| `MEALIE_URL` | *(blank)* | Base URL the **container** uses to reach Mealie, no trailing slash. Blank = demo meals. |
| `MEALIE_TOKEN` | *(blank)* | Mealie long-lived API token (Mealie → Settings → API Tokens). |
| `MEALIE_APP_URL` | *(blank)* | Browser-facing HTTPS Mealie URL for the PWA's Meals launcher (e.g. the `ts.net` URL). Blank = the Meals tab is hidden. |

## Budget — Monarch Money

Full walkthrough: [Budget integration](/integrations/budget).

| Variable | Default | What it does |
| --- | --- | --- |
| `MONARCH_EMAIL` | *(blank)* | Monarch login email. Blank = demo budget. |
| `MONARCH_PASSWORD` | *(blank)* | Monarch login password. |
| `MONARCH_TOTP_SECRET` | *(blank)* | If Monarch login uses MFA, the TOTP *secret* (not a 6-digit code) so the sidecar generates its own codes. |
| `FETCH_INTERVAL_MIN` | `30` | How often (minutes) the sidecar refreshes the budget snapshot. |

## Weather

Full walkthrough: [Weather integration](/integrations/weather). Uses Open-Meteo — no API key or signup.

| Variable | Default | What it does |
| --- | --- | --- |
| `WEATHER_LAT` | `40.7128` | Latitude. Blank lat/lon shows a setup placeholder. |
| `WEATHER_LON` | `-74.0060` | Longitude. |
| `WEATHER_UNITS` | `imperial` | `imperial` or `metric`. |
| `WEATHER_PLACE` | *(blank)* | Optional label shown on the card. |

## Sleep & screensaver

All **DB-overridable** via the [Settings screen](/guide/settings).

| Variable | Default | What it does |
| --- | --- | --- |
| `SLEEP_START_HOUR` | `22` | Hour (24h, local) the app-level blackout starts. Wraps past midnight. |
| `SLEEP_END_HOUR` | `7` | Hour the blackout ends. |
| `SCREENSAVER_IDLE_MIN` | `3` | Idle minutes before the photo slideshow starts. |
| `SCREENSAVER_CYCLE_SEC` | `20` | Seconds per photo. |

### Screensaver photos

**No env var** — drop image files (`.jpg`, `.jpeg`, `.png`, `.webp`) into **`data/photos/`**
on the host. The folder is bind-mounted into the container, so new files show up without a
rebuild. An empty folder falls back to a dark ambient clock face.

```bash
mkdir -p data/photos
cp ~/family-pics/*.jpg data/photos/
```

::: info Why not Google Photos?
Google locked down the Photos API in 2025 in a way that doesn't work for an always-on
kiosk, so photos are a plain host folder instead. Pointing the screensaver at a
self-hosted [Immich](https://immich.app/) instance is on the [roadmap](/reference/roadmap).
:::

## Celebrations

| Variable | Default | What it does |
| --- | --- | --- |
| `CELEBRATE_CHORES` | `1` | **DB-overridable.** `1`/`0` — confetti + chime when a kid (roster `"kid": true`) marks a chore done. See [Settings](/guide/settings). |

## Push notifications (companion PWA)

Requires the Tailscale **HTTPS** setup first — see [Networking](/networking#https-required-for-push-notifications) and [Self-hosting → Push](/self-hosting#push-notifications-optional).

| Variable | Default | What it does |
| --- | --- | --- |
| `VAPID_PUBLIC_KEY` | *(blank)* | VAPID key pair — generate once with `npx web-push generate-vapid-keys`. Blank = push quietly disabled. |
| `VAPID_PRIVATE_KEY` | *(blank)* | The private half of the pair. |
| `VAPID_SUBJECT` | `mailto:you@example.com` | Contact URI required by the push spec. |
| `PUSH_MEMBERS` | `dad,mom` | Comma-separated member ids who receive scheduled notifications. |
| `CHORE_REMINDER_HOUR` | `8` | Hour (24h, local) to send the "chores still open" reminder. |
| `DINNER_DIGEST_HOUR` | `17` | Hour to send tonight's-dinner digest. |
| `PUSH_CHORE_REMINDER` | `1` | **DB-overridable.** `1`/`0` kill-switch for the chore reminder. |
| `PUSH_DINNER_DIGEST` | `1` | **DB-overridable.** `1`/`0` kill-switch for the dinner digest. |

## Journal recap

| Variable | Default | What it does |
| --- | --- | --- |
| `RECAP_HOUR` | `19` | Hour (24h, local) the weekly/monthly recap auto-posts to the Journal (Sundays + the 1st). |

## Rewards catalog

**Not an env var** — edit `server/config/rewards.js` to define what chore points can buy.
See [Rewards](/guide/rewards).

## Presence sensor (optional, future hardware)

| Variable | Default | What it does |
| --- | --- | --- |
| `PRESENCE_TOKEN` | *(blank)* | If set, a PIR/mmWave sensor POSTing to `/api/presence` (to wake the screensaver) must send it as an `X-Presence-Token` header. Blank = no token required (fine on a trusted LAN). See the [roadmap](/reference/roadmap). |
