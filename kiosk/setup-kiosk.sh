#!/usr/bin/env bash
# OpenFamHub — kiosk provisioning for a low-power thin client + touchscreen.
# Run ON THE TARGET (Debian 12 headless) as the kiosk user, after Docker is
# installed and `docker compose up -d` is running this repo. NOT for a dev box.
#
# ⚠️ The package list and autologin wiring below don't depend on hardware
# specifics and should work as-is; the portrait rotation + touch transform in
# kiosk/xinitrc DO need confirming on your specific hardware (see the
# comments in that file) before trusting this end-to-end.
#
#   sudo bash kiosk/setup-kiosk.sh
set -euo pipefail

KIOSK_USER="${KIOSK_USER:-$(logname 2>/dev/null || echo kiosk)}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Installing X11 + Openbox + Chromium (minimal, no desktop environment)"
apt-get update
apt-get install -y --no-install-recommends \
  xserver-xorg xinit openbox chromium unclutter curl x11-xserver-utils xinput python3

echo "==> Installing ~/.xinitrc for $KIOSK_USER"
install -m 0644 -o "$KIOSK_USER" -g "$KIOSK_USER" "$REPO_DIR/kiosk/xinitrc" "/home/$KIOSK_USER/.xinitrc"

echo "==> Auto-start X on tty1 login (append to .bash_profile)"
PROFILE="/home/$KIOSK_USER/.bash_profile"
if ! grep -q "startx" "$PROFILE" 2>/dev/null; then
  cat >> "$PROFILE" <<'EOF'

# OpenFamHub: start the kiosk on tty1 login
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec startx
fi
EOF
  chown "$KIOSK_USER:$KIOSK_USER" "$PROFILE"
fi

echo "==> Enabling console autologin on tty1 for $KIOSK_USER"
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $KIOSK_USER --noclear %I \$TERM
EOF
systemctl daemon-reload

cat <<EOF

Done. Notes:
  - Scheduled + manual sleep is handled IN-APP now (SleepOverlay.svelte, a DOM
    blackout, default 22:00-07:00) — no cron job needed. We deliberately do NOT
    use 'xset dpms force off' anywhere because it drops the Dell P2418HT's
    USB-touch interface and it won't wake back up on tap.
  - CONFIRM ON HARDWARE before trusting this: kiosk/xinitrc's portrait rotation
    (OUTPUT/ROTATE) and touch coordinate transform (TOUCH_DEVICE) are unverified
    placeholders — see the comments in that file for how to find the real values.
  - Reboot to verify: console autologins on tty1 -> startx -> Openbox -> Chromium kiosk.
EOF
