# Networking (Tailscale)

Once the app is installed and configured, the next step is making it reachable — from
the wall itself, from phones on your LAN, and (safely) from phones when you're away. The
guiding rule for the whole page:

::: danger Never expose port 8080 to the public internet
The wall runs login-free by design (it's a trusted physical device). The companion PWA
(`/m`) has a PIN, but that's **defense-in-depth, not a firewall.** Reach everything over
your own LAN or a mesh VPN — [Tailscale](https://tailscale.com) is what this project
uses and what the rest of this page assumes. A forwarded port on your router is the one
setup to avoid.
:::

## Where OpenFamHub needs to be reachable

| From | Needs | How |
|---|---|---|
| The wall's own browser | `http://localhost:8080` | Always works — same box |
| Phones/tablets at home | The host on your LAN | LAN reachability (below) |
| Phones when away | The host over your tailnet | Tailscale (below) |

## LAN reachability

By default `docker-compose.yml` publishes port `8080` on **every** interface, so any
device on your LAN can reach `http://<host-ip>:8080`. For a home network you trust,
that's fine — you're done.

If you'd rather lock it down further — a guest/IoT VLAN shares the router, or you want
*only* your tailnet to ever reach the app — bind it to localhost only. In `.env`:

```bash
BIND_ADDR=127.0.0.1
```

then apply it:

```bash
docker compose up -d
```

Now the app answers only on the host itself. The kiosk's own browser
(`http://localhost:8080`) keeps working unchanged, and you reach it from anywhere else
over Tailscale (next).

::: warning Use `up -d`, not `restart`, after editing `.env`
`docker compose restart` reuses the old environment and won't pick up `BIND_ADDR` (or
any other new value). Always re-apply with `docker compose up -d`.
:::

## Set up Tailscale on the host

[Tailscale](https://tailscale.com) puts your devices on a private mesh network (a
"tailnet") with no ports opened to the internet. Install it on the machine running the
Docker stack:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Follow the login URL it prints to add the host to your tailnet. Do the same on each
phone (the Tailscale app from the App Store / Play Store). Every device on the tailnet
can now reach every other by name, encrypted, from anywhere — no port forwarding, no
dynamic DNS.

Enable **MagicDNS** in the [Tailscale admin console](https://login.tailscale.com/admin/dns)
so devices are reachable by a stable name like `wall.<your-tailnet>.ts.net` instead of a
raw tailnet IP.

## Serve the app over the tailnet

Rather than binding the app to the LAN, let Tailscale's own proxy forward tailnet
traffic to it. Run once on the host:

```bash
tailscale serve --bg --tcp 8080 tcp://127.0.0.1:8080
```

Tailscale forwards tailnet traffic in, while the app stays bound to `127.0.0.1` and
never touches the LAN-facing interface. Phones on the tailnet reach it at
`http://<host>.<tailnet>.ts.net:8080`.

### HTTPS (required for push notifications)

The TCP mode above forwards plain HTTP — fine for browsing. But browsers only allow
**service-worker push notifications from a secure context**, so if you want the
[chore-reminder / dinner-digest notifications](/guide/mobile#notifications), serve over
HTTPS instead:

```bash
tailscale serve --bg --https=443 http://127.0.0.1:8080
```

Tailscale terminates TLS with a free certificate for your machine's tailnet name, and
the PWA becomes `https://<host>.<tailnet>.ts.net/m`. Nothing in the app changes — the
same backend serves both. Push-notification key setup (VAPID) is covered in
[Self-hosting → Push notifications](/self-hosting#push-notifications-optional).

::: tip Keep exactly one URL
If you set up the TCP mode first, turn it off once HTTPS works
(`tailscale serve --tcp=8080 off`). Two working URLs for the same app is how a family
ends up with half its phones on the wrong one — one HTTPS address, one bookmark, no
ambiguity. Install/bookmark `https://<host>.<tailnet>.ts.net/m` on each phone.
:::

## The PIN is defense-in-depth

Each family member can have a 4-digit PIN for the companion PWA (set in `.env` — see
[First-time setup](/first-time-setup#_3-set-companion-pwa-pins-optional)). That protects
`/m` if a phone is unlocked and handed around — it is **not** a substitute for keeping
the app off the public internet. Network isolation (LAN/tailnet) is the real boundary;
the PIN sits on top of it.

## Troubleshooting: flaky DNS

If the logs show occasional `getaddrinfo ENOTFOUND` and calendar feeds drop, or a tapped
chore reverts and only sticks on a later try, the container's **DNS is flaky** — not the
app. Docker's embedded resolver forwards to the host's resolver, and a home router's DNS
forwarder (or a VPN resolver such as Tailscale MagicDNS falling back to one) can
intermittently `SERVFAIL` under load. Every outbound lookup — calendar feeds, the
Todoist close request behind a chore tap — rides that same resolver, so a blip drops a
feed and reverts a tap.

Point the container straight at reliable public resolvers. In `docker-compose.yml`, add
to the `app` service (and the `monarch-fetcher` sidecar if you run Budget):

```yaml
    dns:
      - 1.1.1.1
      - 8.8.8.8
```

Then recreate so it takes effect (a plain restart won't re-read `dns:`):

```bash
docker compose up -d
```

This is safe as long as every host the app talks to is publicly resolvable — the
adapters only reach public APIs (calendar, Todoist, weather) plus your Mealie instance,
which you can reference by IP if it isn't in public DNS.
