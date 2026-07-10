# Budget (Monarch Money)

Optional. [Monarch Money](https://www.monarchmoney.com) has no official public API, so
this integration is a separate Python sidecar (`fetcher/`) that logs in on a schedule
and writes a normalized snapshot to `data/monarch.json`, which the backend just reads —
your Monarch credentials never touch the main Node app. See the
[Budget screen guide](/guide/budget) for what this looks like once it's
connected.

```bash [.env]
MONARCH_EMAIL=
MONARCH_PASSWORD=
MONARCH_TOTP_SECRET=   # if your account uses MFA — the TOTP *secret*, not a 6-digit code
FETCH_INTERVAL_MIN=30  # how often the sidecar refreshes
```

Leave blank to render a demo budget table instead of live data.

## History (Last Month / Year to Date)

Each successful live sync now also lands in `data/monarch-history/<YYYY-MM>.json`,
alongside the current-month snapshot the sidecar has always written — one file per
calendar month, never overwritten once that month is over. This is what powers the
Budget screen's Last Month and Year to Date views; there's no separate configuration
for it, and no backfill of months before this was added, since Monarch itself doesn't
expose historical budget data.

::: warning Unofficial API
`monarchmoney` is a reverse-engineered client, not an official API — expect session
fragility and possible breakage if Monarch changes something server-side.
:::
