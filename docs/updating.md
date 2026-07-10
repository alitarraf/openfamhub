# Updating

```bash
git pull
docker compose up -d --build
```

The economy database (points, balances, redemption history) lives on a named Docker
volume (`openfamhub-economy`), not a bind mount, so it survives rebuilds and container
recreation. `config/members.json` and `.env` are both gitignored, so `git pull` never
touches your local configuration.

If the frontend doesn't seem to have picked up a change after rebuilding, hard-refresh
the browser tab (kiosk Chromium caches aggressively) — or `docker compose down && docker
compose up -d` to force a clean container recreation.
