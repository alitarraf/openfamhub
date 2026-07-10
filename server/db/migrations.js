/* Schema migrations — tiny PRAGMA user_version runner, no framework.
 *
 * Each migration runs once, in order, inside a transaction; user_version
 * records how far a database has gotten. Migration 1 is the pre-runner
 * baseline (economy + journal tables), written with IF NOT EXISTS so the
 * already-deployed Wyse database (which has these tables at user_version 0)
 * adopts the runner cleanly instead of erroring on CREATE TABLE.
 *
 * Adding a migration: append { version: N, name, sql } (or `up(db)` for
 * anything data-shaped that SQL alone can't express). Never edit or reorder
 * shipped entries — deployed DBs have already recorded their version.
 */

export const MIGRATIONS = [
  {
    version: 1,
    name: 'baseline — economy (balances/ledger/assignments) + journal tables',
    sql: `
      CREATE TABLE IF NOT EXISTS balances (
        member_id TEXT PRIMARY KEY,
        points INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id TEXT NOT NULL,
        delta INTEGER NOT NULL,
        reason TEXT NOT NULL,     -- 'award' | 'revert' | 'redeem'
        task_id TEXT,             -- Todoist task id (award/revert only)
        local_date TEXT,          -- 'YYYY-MM-DD' (award/revert only) — recurring
                                  -- Todoist tasks reuse the same task_id every
                                  -- day, so (task_id, local_date) is a single
                                  -- completion's real identity, not task_id alone.
        reward_id TEXT,           -- rewards config id (redeem only)
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ledger_task ON ledger(task_id, local_date);

      -- Which catalog rewards (server/config/rewards.js) each member currently has
      -- assigned ("working toward"). Assignment is on-wall (Manage screen); the
      -- catalog itself (what rewards exist at all) stays config-file authored.
      CREATE TABLE IF NOT EXISTS assignments (
        member_id TEXT NOT NULL,
        reward_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (member_id, reward_id)
      );

      CREATE TABLE IF NOT EXISTS journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author_id TEXT NOT NULL,   -- who posted it (PWA session)
        text TEXT NOT NULL,
        tag TEXT,                  -- 'milestone' | 'quote' | 'school' | 'health' | NULL
        photo_path TEXT,           -- filename in data/journal-photos, or NULL
        hearts INTEGER NOT NULL DEFAULT 0,
        local_date TEXT NOT NULL,  -- 'YYYY-MM-DD', server TZ — drives "on this day"
                                   -- and the timeline's date grouping (same
                                   -- local-date idea as economy/index.js's ledger,
                                   -- computed the same TZ-safe way, never derived
                                   -- by slicing an ISO/UTC string)
        created_at TEXT NOT NULL   -- ISO instant, for feed ordering
      );

      CREATE INDEX IF NOT EXISTS idx_journal_local_date ON journal_entries(local_date);

      -- Who an entry is about/involves — separate from author_id (who posted it).
      -- Many-to-many: an entry can involve any number of members.
      CREATE TABLE IF NOT EXISTS journal_entry_members (
        entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL,
        PRIMARY KEY (entry_id, member_id)
      );
    `
  },
  {
    version: 2,
    name: 'settings key-value store (on-device settings screen)',
    sql: `
      -- Wall-editable settings (sleep schedule, screensaver timings, ...).
      -- A DB row overrides the .env value; .env stays the fresh-install default.
      -- Whitelist + validation live in server/settings/index.js, not here.
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `
  },
  {
    version: 3,
    name: 'web-push subscriptions',
    sql: `
      -- One row per browser push subscription (a member can have several —
      -- phone + tablet). Endpoint is the push service's unique URL; dead
      -- endpoints (404/410 on send) are pruned by server/push/index.js.
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_push_member ON push_subscriptions(member_id);
    `
  },
  {
    version: 4,
    name: 'babysitter mode (lock flag + emergency-info blob)',
    sql: `
      -- Single-row store (id is pinned to 1) for Babysitter mode: a global
      -- lock flag the wall reads on boot (reload-proof) plus a JSON blob of the
      -- emergency info a sitter sees. Shape/validation live in
      -- server/babysitter/index.js, not here. Parent NAMES are NOT stored — they
      -- come live from the roster at read time; only their phone numbers, the
      -- emergency contacts, and the notes are persisted.
      CREATE TABLE IF NOT EXISTS babysitter (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        active INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT
      );
    `
  },
  {
    version: 5,
    name: 'user-editable reward catalog (custom rewards + built-in hide overrides)',
    sql: `
      -- Rewards a parent adds from the companion PWA, layered on top of the
      -- file-authored base catalog (server/config/rewards.js). Shape and
      -- validation live in server/rewards/index.js, not here. 'id' is the
      -- ledger's stable redemption key (a bare TEXT column there, no FK) —
      -- generated once on create and frozen on edit. 'hidden' exists because
      -- removing a reward that already has redemption history would orphan
      -- those ledger rows (they'd render as raw ids in the recap), so a used
      -- reward is hidden rather than deleted.
      CREATE TABLE IF NOT EXISTS custom_rewards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        cat_key TEXT NOT NULL,
        cost INTEGER NOT NULL,
        hidden INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Per-built-in overrides, keyed by the base catalog's id. MVP stores only
      -- a hide flag, so a family can turn off a bundled reward from the UI
      -- without editing the file; name/cost of built-ins stay file-authored.
      -- Room to grow (field overrides) later.
      CREATE TABLE IF NOT EXISTS reward_overrides (
        id TEXT PRIMARY KEY,
        hidden INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
    `
  }
];

/** Bring `db` up to the latest version. Idempotent; safe to call on every boot. */
export function migrate(db) {
  const current = db.pragma('user_version', { simple: true });
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    db.transaction(() => {
      if (m.sql) db.exec(m.sql);
      if (m.up) m.up(db);
      db.pragma(`user_version = ${m.version}`);
    })();
    console.log(`db: migrated to v${m.version} (${m.name})`);
  }
}
