#!/bin/sh
# OpenFamHub — Monarch sidecar entrypoint.
# Runs the fetch once on startup (so the UI has data immediately), then schedules
# it on an interval via busybox crond.
set -eu

INTERVAL="${FETCH_INTERVAL_MIN:-30}"

echo "[entrypoint] initial fetch…"
python /app/fetch_monarch.py || echo "[entrypoint] initial fetch returned non-zero (continuing)"

# Build a crontab. busybox cron doesn't inherit the container env, so we re-export
# the creds into the job's environment explicitly.
CRON_FILE=/etc/crontabs/root
mkdir -p /etc/crontabs
cat > "$CRON_FILE" <<EOF
*/${INTERVAL} * * * * MONARCH_EMAIL='${MONARCH_EMAIL:-}' MONARCH_PASSWORD='${MONARCH_PASSWORD:-}' MONARCH_TOTP_SECRET='${MONARCH_TOTP_SECRET:-}' MONARCH_OUT='${MONARCH_OUT:-/data/monarch.json}' python /app/fetch_monarch.py >> /proc/1/fd/1 2>&1
EOF

echo "[entrypoint] starting crond (every ${INTERVAL} min)"
exec crond -f -l 8
