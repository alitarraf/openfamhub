# Self-hosting reference

The whole stack is two Docker Compose services:

| Service | What it does |
|---|---|
| `app` | The Node backend (`server/`) + the built Svelte SPA, on port `8080` |
| `monarch-fetcher` | Optional Python sidecar for the [Budget](/integrations/budget) card |

```bash
docker compose up -d --build
```

The economy database (points, balances, redemption history) — the one genuinely
stateful, irreplaceable piece — lives on a **named Docker volume**
(`openfamhub-economy`), not a bind mount, so it survives container recreation.

`config/members.json` and `.env` are both gitignored and bind-mounted in, so your
configuration and secrets never end up in an image layer.

## Network access

Reaching the app from other devices — locking it to your LAN or tailnet, serving it over
Tailscale, HTTPS, and the DNS-flakiness fix — all lives on its own page:

➡️ **[Networking (Tailscale)](/networking)**

The short version: **never expose port `8080` to the public internet.** Reach it over
your LAN or a mesh VPN.

## Push notifications (optional)

Requires the Tailscale **HTTPS** setup from [Networking](/networking#https-required-for-push-notifications)
first (browsers only allow push from a secure context). Then, one time:

1. Generate a VAPID key pair (any machine with Node):
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Paste both keys into `.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) along with a
   contact `VAPID_SUBJECT=mailto:you@example.com`, then `docker compose up -d`.
3. On each parent's phone, open the PWA, log in, and tap the **bell** icon.

Who gets the scheduled notifications and when is controlled by `PUSH_MEMBERS`
(default `dad,mom`), `CHORE_REMINDER_HOUR` (default 8) and `DINNER_DIGEST_HOUR`
(default 17) — see `.env.example`. With no VAPID keys set, push is quietly disabled and
the bell never appears.

## Rebuilding after a frontend change

```bash
cd app && npm run build   # writes app/dist/, served by the app service
docker compose up -d      # picks up the new build
```

## Putting it on an actual wall

See [Kiosk setup](/kiosk) for turning a thin client + touchscreen into an always-on wall
display running this in Chromium kiosk mode, and [Hardware](/hardware) for the physical
build.
