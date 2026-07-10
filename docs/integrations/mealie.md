# Mealie

Powers [Meals](/guide/meals). [Mealie](https://mealie.io) is a separate
self-hosted recipe manager / meal planner — it isn't part of this repo, and this app
never authors recipes, it only reads and links into Mealie's own data.

## Setup

```bash [.env]
MEALIE_URL=    # base URL of your Mealie instance
MEALIE_TOKEN=  # Mealie → Settings → API Tokens → create a long-lived token
```

If Mealie runs as a sibling container on the same Docker host, use
`http://host.docker.internal:<port>` — `localhost` won't resolve to a sibling
container from inside this app's own container.

## Companion-app shortcut

The [companion PWA](/guide/mobile) can show a **Meals ↗** tab that opens your
Mealie app directly, so phones don't need a second home-screen icon. It's a launcher, not
an embed — tapping it hands off to Mealie's own web app (with its own login).

```bash [.env]
MEALIE_APP_URL=  # HTTPS URL your phone reaches Mealie at; blank hides the tab
```

This is a **separate value from `MEALIE_URL`** and serves a different purpose:

| Variable | Used by | Reachable from |
| --- | --- | --- |
| `MEALIE_URL` | the server, to proxy recipe data/thumbnails | inside this app's container |
| `MEALIE_APP_URL` | the phone, as the Meals tab's link target | the phone's browser |

Because the phone opens it directly, `MEALIE_APP_URL` must be an address the phone can
reach — a plain LAN URL won't work off the home network. The usual setup is an HTTPS
[Tailscale](https://tailscale.com) URL: run `tailscale serve --https=443 http://localhost:<mealie-port>`
on the Mealie host and use the resulting `https://<host>.<tailnet>.ts.net/`. It's only ever
a URL (never a token), so it's safe to expose to the client via `/api/config`. Leave it
blank and the tab simply doesn't appear.

## Groceries

Groceries are Mealie's shopping list, not a separate list — a household is assumed to
have exactly one active shopping list. "Add to grocery list" (from a recipe) writes
directly into Mealie, so it shows up in Mealie's own app too.

## Recipe images

Thumbnails are proxied and cached to a local, gitignored directory
(`data/mealie-img/`) rather than fetched full-resolution on every request — keeps the
weekly meal grid fast even with dozens of thumbnails on modest hardware.
