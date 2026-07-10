#!/usr/bin/env python3
"""OpenFamHub — Monarch Money fetcher.

Logs into Monarch Money, pulls the current month's budget, and writes a compact
JSON snapshot to /data/monarch.json for the Budget screen to render.

Also mirrors each *live* (non-demo) run into /data/monarch-history/<YYYY-MM>.json.
That file keeps getting overwritten with the latest snapshot all month, same as
the current-month file — but once the calendar rolls to a new month, this
script starts writing a new dated file instead, and the old one just stops
being touched. It naturally becomes "last month" / historical data with no
separate backfill step, and it's what powers the Budget screen's Last Month /
Year to Date views (server/sources/monarch.js reads this directory).

Demo snapshots are NOT mirrored into history — showing repeated identical
demo numbers across "months" would look like fabricated history, and demo
mode by definition means there's no real Monarch account to have history
for yet.

Design notes:
- Monarch has no official API; the `monarchmoney` library is reverse-engineered and
  can be fragile. So this script fails *soft*: on any error it keeps the last good
  file if present, otherwise writes a clearly-labelled DEMO snapshot so the UI still
  renders something instead of an error.
- Credentials come from the environment (see .env). No creds -> DEMO snapshot.
"""

import asyncio
import json
import os
import sys
from datetime import datetime, timezone

OUT_PATH = os.environ.get("MONARCH_OUT", "/data/monarch.json")
HISTORY_DIR = os.environ.get("MONARCH_HISTORY_DIR", "/data/monarch-history")


def log(msg: str) -> None:
    print(f"[fetch_monarch {datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def _atomic_write_json(path, payload) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as fh:
        json.dump(payload, fh, indent=2)
    os.replace(tmp, path)  # atomic so a reader never sees a half-written file


def write_snapshot(budgets, *, demo=False) -> None:
    payload = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "demo": demo,
        "budgets": budgets,
    }
    _atomic_write_json(OUT_PATH, payload)
    log(f"wrote {OUT_PATH} ({'DEMO' if demo else 'live'}, {len(budgets)} rows)")

    if not demo:
        # datetime.now() (naive, local) respects the container's TZ env var,
        # same as every other local-date computation in this app — a month
        # key computed from UTC could file today's snapshot under the wrong
        # month near a month boundary.
        month_key = datetime.now().strftime("%Y-%m")
        history_path = os.path.join(HISTORY_DIR, f"{month_key}.json")
        _atomic_write_json(history_path, payload)
        log(f"wrote {history_path} (history)")


DEMO_BUDGETS = [
    {"Category": "Groceries", "Budget": 800, "Spent": 612, "Left": 188},
    {"Category": "Dining",    "Budget": 300, "Spent": 274, "Left": 26},
    {"Category": "Utilities", "Budget": 250, "Spent": 198, "Left": 52},
    {"Category": "Gas",       "Budget": 200, "Spent": 143, "Left": 57},
    {"Category": "Kids",      "Budget": 400, "Spent": 355, "Left": 45},
]


def write_demo_if_needed(reason: str) -> None:
    """Write DEMO data only if no prior snapshot exists, so we don't clobber live data."""
    if os.path.exists(OUT_PATH):
        log(f"{reason}; keeping existing snapshot")
        return
    log(f"{reason}; writing DEMO snapshot")
    write_snapshot(DEMO_BUDGETS, demo=True)


async def fetch_live() -> bool:
    """Return True on a successful live write, False to fall back to demo."""
    email = os.environ.get("MONARCH_EMAIL", "").strip()
    password = os.environ.get("MONARCH_PASSWORD", "").strip()
    totp_secret = os.environ.get("MONARCH_TOTP_SECRET", "").strip()

    if not (email and password):
        write_demo_if_needed("no MONARCH_EMAIL/PASSWORD")
        return False

    try:
        from monarchmoney import MonarchMoney
    except ImportError as e:
        write_demo_if_needed(f"monarchmoney import failed ({e})")
        return False

    mm = MonarchMoney()
    try:
        if totp_secret:
            await mm.login(email, password, mfa_secret_key=totp_secret)
        else:
            await mm.login(email, password)
    except Exception as e:  # noqa: BLE001 - library raises varied exceptions
        write_demo_if_needed(f"login failed ({type(e).__name__}: {e})")
        return False

    try:
        data = await mm.get_budgets()
        budgets = transform_budgets(data)
        if not budgets:
            write_demo_if_needed("Monarch returned no budget rows")
            return False
        write_snapshot(budgets, demo=False)
        return True
    except Exception as e:  # noqa: BLE001
        write_demo_if_needed(f"get_budgets failed ({type(e).__name__}: {e})")
        return False


def transform_budgets(data) -> list:
    """Flatten Monarch's budget payload into table rows.

    Monarch's schema shifts between library versions, so we walk defensively and
    skip anything that doesn't look like a category with amounts. Adjust the field
    names here once we can see a real payload (logged in fetch step).
    """
    rows = []
    try:
        categories = (
            data.get("budgetData", {}).get("monthlyAmountsByCategory")
            or data.get("categoryGroups")
            or []
        )
        for cat in categories:
            name = cat.get("name") or cat.get("category", {}).get("name")
            amounts = (cat.get("monthlyAmounts") or [{}])[-1]
            budget = amounts.get("plannedAmount") or amounts.get("budgetedAmount")
            spent = amounts.get("actualAmount") or amounts.get("spentAmount")
            if name is None or budget is None:
                continue
            spent = spent or 0
            rows.append({
                "Category": name,
                "Budget": round(budget),
                "Spent": round(spent),
                "Left": round(budget - spent),
            })
    except Exception as e:  # noqa: BLE001
        log(f"transform error: {e}")
    return rows


def main() -> int:
    ok = asyncio.run(fetch_live())
    return 0 if ok or os.path.exists(OUT_PATH) else 1


if __name__ == "__main__":
    sys.exit(main())
