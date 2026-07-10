# Changelog

## Unreleased

Initial open-source release.

- Calendar (iCal), Tasks & Chores + points economy + Rewards (Todoist), Meals +
  Recipes + Grocery (Mealie), Weather (Open-Meteo), optional Budget (Monarch Money
  sidecar), companion mobile PWA.
- Family roster is fully config-driven (`config/members.json`) — any number of
  members, wired end-to-end from `GET /api/members` through to the wall UI's layouts,
  which wrap/scroll instead of assuming a fixed family size.
- Data-source adapters (tasks/calendar/meals/budget/weather/photos) sit behind a
  provider registry, so swapping one out is a config change and a new file.
- Full OpenAPI 3.1 spec for the entire `/api/*` surface, served as interactive docs.
- **Budget:** This Month / Last Month / Year to Date, backed by the Monarch sidecar
  now keeping a real history directory instead of one current-month file; a true-net
  "safe to spend" hero number; category rows sorted by spend.
- **Journal:** a first-party family feed/timeline (photos, tags, multi-member
  tagging, "on this day") written from the phone via a new PWA composer — the app's
  first screen with actual free-text typing.
- **Rewards:** default catalog expanded from 5 to 18 entries across four cost tiers
  (small/medium/large/big), skewed toward experiences and privileges over toys — see
  [Rewards](/guide/rewards).
- **Calendar:** Home's two-week hero and Calendar's own Month view are now
  tappable — tapping a day jumps to Day view for that date, and tapping "Next two
  weeks" opens Month view. Event dots are now per-event avatar chips (falling back
  to a monogram or plain dot) instead of plain color dots — see
  [Calendar](/guide/calendar).
- **Chores:** a kid marking a chore done gets a little celebration — a confetti
  burst from their avatar, an avatar pop, a +1 star tick, and a chime. Opt in per
  member with `"kid": true` in the roster; a Settings toggle turns it off. Built
  with plain canvas + Web Audio (no new dependencies, no sound files) — see
  [Settings](/guide/settings).
- **Meals shortcut in the companion PWA:** an optional **Meals ↗** tab that opens
  your Mealie app in one tap, so phones don't need a second home-screen icon. It's a
  launcher (a real link that hands off to Mealie's own app), not an embed. Set
  `MEALIE_APP_URL` to the HTTPS URL your phone reaches Mealie at — blank hides the
  tab — see [Mealie](/integrations/mealie#companion-app-shortcut).
- **Calendar reliability & performance:** fixed events flickering between date
  ranges — the Home and Calendar screens each hydrate a different-width window into
  one shared store, and a full store replace let the two heartbeat fetches race;
  each fetch now merges only its own window. Parsed feeds are cached per URL (with
  in-flight de-duplication and stale-on-error fallback) and the request window is
  day-aligned, so most refreshes reuse a warm parse instead of re-downloading and
  re-expanding recurring events every cycle. `webcal://` subscribe URLs (iCloud,
  Google) are normalized to `https://`, and outbound DNS prefers IPv4 so
  IPv6-only-record setups don't stall feed fetches.
- **Budget is now locked by default:** unlike the rest of the wall, opening Budget
  asks for a parent's PIN first (`BUDGET_UNLOCK_MEMBERS`, default `dad,mom`), and
  re-locks after 15 minutes — see [Budget](/guide/budget#locked-by-default).
  `docker-compose.yml`'s port 8080 publish is now configurable via `BIND_ADDR`, so
  self-hosters can restrict it to localhost and pair it with `tailscale serve` for
  tailnet-only access instead of the whole LAN — see
  [self-hosting](/self-hosting#network-access).
- Added a [Roadmap](/reference/roadmap) page (voice assistant, live updates, hardening).
- **Live updates (SSE):** writes made anywhere — the wall, a phone — now show up on
  every connected display in under a second (`GET /api/live`); the 5-minute poll
  heartbeat stays as the fallback.
- **On-device Settings screen:** sleep schedule + screensaver timings editable from
  the wall, behind the parent PIN gate; saved values persist in the database and
  override the `.env` defaults — see [Settings](/guide/settings).
- **Weekly & monthly recaps in the Journal:** every Sunday evening (and the 1st of
  the month) an entry tagged *Recap* is auto-posted — chores done, stars earned,
  streaks, redemptions, and the week's most-loved journal moment — so past weeks
  stay browsable in the Timeline — see [Journal](/guide/journal#weekly-monthly-recaps).
- **Push notifications (companion PWA):** optional chore reminder + "what's for
  dinner" digest to the parents' phones; needs VAPID keys and HTTPS — see
  [Self-hosting](/self-hosting#push-notifications-optional).
- **Presence endpoint (scaffold):** `POST /api/presence` for a future PIR/mmWave
  wall sensor — wakes the screensaver over the live stream.
- **Babysitter mode:** a one-tap wall lockdown for when a sitter is watching the
  kids — the wall shows a full-screen emergency card (parent phone numbers,
  emergency contacts, notes) and seals off every other screen until a parent's PIN
  returns to the dashboard. The lock is a server-side flag the wall reads on boot,
  so a kiosk reload can't escape it; the emergency info is edited from the parents'
  phones — see [Babysitter mode](/guide/babysitter).
- **Chore taps survive network blips:** completing a chore now retries the
  underlying Todoist write through a transient DNS/network hiccup instead of
  silently reverting; if it still can't save, the row flags itself briefly rather
  than becoming a mystery no-op. Added a [self-hosting troubleshooting
  note](/self-hosting#troubleshooting) for the flaky-container-DNS
  case that caused it (feeds dropping with `ENOTFOUND`, chores bouncing back).
- **Hardening:** schema migrations (`PRAGMA user_version`), nightly SQLite backups
  onto `./data/backups/`, calendar feeds now degrade per-feed instead of blanking
  the whole calendar, CI (lint + format + tests + build + bundle budget), test
  suites for the points economy and PIN auth, eslint + prettier across the repo.
