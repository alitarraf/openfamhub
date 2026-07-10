#!/usr/bin/env bash
# Force the kiosk Chromium tab to hard-reload — run this ON the kiosk box
# (e.g. `ssh wyse kiosk/reload.sh`) after deploying a frontend-only change
# (rebuild app/dist + sync it over), instead of a full `sudo reboot`.
#
# Backend-only fixes (server/sources/*, routes) need neither this nor a
# reboot — `docker compose restart app` is enough, since the kiosk polls the
# API on its own refresh heartbeat.
#
# Talks to Chromium's DevTools Protocol (launched with
# --remote-debugging-port=9222, see kiosk/xinitrc) instead of simulating a
# keypress. An earlier xdotool-based version (`xdotool key ctrl+shift+r`)
# found the window and reported no error, but the keystroke silently never
# reached the page (a window-focus/WM quirk) — the kiosk kept running a
# stale bundle indefinitely with no indication anything was wrong. Driving
# Page.reload directly through CDP talks to the browser process itself,
# sidestepping the window manager entirely.
set -euo pipefail
python3 - <<'PYEOF'
import base64, json, os, socket, struct, sys, urllib.request

HOST, PORT = "localhost", 9222

with urllib.request.urlopen(f"http://{HOST}:{PORT}/json") as r:
    targets = json.loads(r.read())
target = next((t for t in targets if t.get("type") == "page"), None)
if not target:
    sys.exit("reload.sh: no Chromium page target on :9222 — is the kiosk running?")

path = target["webSocketDebuggerUrl"].split(f"{HOST}:{PORT}", 1)[1]
sock = socket.create_connection((HOST, PORT), timeout=10)
key = base64.b64encode(os.urandom(16)).decode()
sock.sendall(
    f"GET {path} HTTP/1.1\r\nHost: {HOST}:{PORT}\r\nUpgrade: websocket\r\n"
    f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n".encode()
)
resp = sock.recv(4096)
if b"101" not in resp.split(b"\r\n", 1)[0]:
    sys.exit(f"reload.sh: CDP handshake failed: {resp[:200]!r}")

payload = json.dumps({"id": 1, "method": "Page.reload", "params": {"ignoreCache": True}}).encode()
mask = os.urandom(4)
masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
if len(payload) < 126:
    header = struct.pack("!BB", 0x81, 0x80 | len(payload))
else:
    header = struct.pack("!BBH", 0x81, 0x80 | 126, len(payload))
sock.sendall(header + mask + masked)
print(f"reload.sh: sent Page.reload(ignoreCache=true) to {target['url']}")
PYEOF
