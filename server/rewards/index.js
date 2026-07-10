/* The reward catalog, resolved from two layers: the file-authored base
 * (server/config/rewards.js) plus the parent-editable rows a family adds from
 * the companion PWA. Mirrors the settings module's spirit — the file is the
 * fresh-install default, the DB layers on top — but rewards are a
 * variable-length list of rich objects, so they get their own tables
 * (custom_rewards + reward_overrides, migration v5) rather than the key/value
 * settings store.
 *
 * Every write is validated here; the routes never persist arbitrary shapes.
 * Two rules fall straight out of the ledger design (ledger.reward_id is a bare
 * TEXT column, no FK): an id is generated once on create and never mutated on
 * edit (changing it orphans past redemptions), and a reward that has ever been
 * redeemed is hidden rather than hard-deleted (so the recap can still resolve
 * its name). See server/db/migrations.js for the schema.
 */
import { db } from '../economy/db.js';
import { rewards as baseRewards } from '../config/rewards.js';
import { clearAssignmentsForReward, hasRedemptions } from '../economy/index.js';

// The finite category set — each maps to an [iconColor, iconBgTint] pair on the
// client (app/src/lib/data/mock.js). The server only validates membership.
export const CAT_KEYS = ['sky', 'fern', 'iris', 'coral', 'gold'];

// Material Symbols ligature names are lowercase words joined by underscores.
const ICON_RE = /^[a-z][a-z0-9_]*$/;
const MAX_NAME = 80;
const MAX_ICON = 48;
const MAX_COST = 100000;

const nowIso = () => new Date().toISOString();

const rowToReward = (r) => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  catKey: r.cat_key,
  cost: r.cost,
  hidden: !!r.hidden,
  source: 'custom'
});

/**
 * The full catalog: base rewards (each carrying its override hide flag) followed
 * by custom rewards. Hidden entries are dropped unless `includeHidden` — the
 * redeem/assign surfaces want the visible set; the Manage views ask for all so
 * they can offer an unhide.
 */
export function getRewards({ includeHidden = false } = {}) {
  const overrides = Object.fromEntries(
    db
      .prepare('SELECT id, hidden FROM reward_overrides')
      .all()
      .map((o) => [o.id, !!o.hidden])
  );
  const base = baseRewards().map((r) => ({ ...r, hidden: overrides[r.id] || false, source: 'builtin' }));
  const custom = db.prepare('SELECT * FROM custom_rewards ORDER BY created_at').all().map(rowToReward);
  const all = [...base, ...custom];
  return includeHidden ? all : all.filter((r) => !r.hidden);
}

/** One reward by id, hidden included by default (redeem/recap resolve by id). */
export function getReward(id, { includeHidden = true } = {}) {
  return getRewards({ includeHidden }).find((r) => r.id === id) || null;
}

const isCustom = (id) => !!db.prepare('SELECT 1 FROM custom_rewards WHERE id = ?').get(id);
const isBuiltin = (id) => baseRewards().some((r) => r.id === id);

/** Validate + normalize a create/edit payload. Throws on any bad field. */
function cleanFields(fields) {
  const f = fields || {};
  const name = typeof f.name === 'string' ? f.name.trim() : '';
  if (!name) throw new Error('name is required');
  if (name.length > MAX_NAME) throw new Error(`name must be ${MAX_NAME} characters or fewer`);

  const icon = typeof f.icon === 'string' ? f.icon.trim() : '';
  if (!ICON_RE.test(icon) || icon.length > MAX_ICON) {
    throw new Error('icon must be a Material Symbols name (lowercase letters, digits, underscores)');
  }

  const catKey = typeof f.catKey === 'string' ? f.catKey.trim() : '';
  if (!CAT_KEYS.includes(catKey)) throw new Error(`catKey must be one of: ${CAT_KEYS.join(', ')}`);

  const cost = Number(f.cost);
  if (!Number.isInteger(cost) || cost < 0 || cost > MAX_COST) {
    throw new Error(`cost must be an integer in [0, ${MAX_COST}]`);
  }
  return { name, icon, catKey, cost };
}

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'reward';

/** A stable, unique id derived from the name. Never collides with a base or
 *  existing custom id; suffixes -2, -3, … on conflict. Generated once, frozen. */
function genId(name) {
  const taken = new Set(getRewards({ includeHidden: true }).map((r) => r.id));
  const base = slugify(name);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Create a custom reward. Returns the created reward. */
export function createReward(fields) {
  const { name, icon, catKey, cost } = cleanFields(fields);
  const id = genId(name);
  const now = nowIso();
  db.prepare(
    `INSERT INTO custom_rewards (id, name, icon, cat_key, cost, hidden, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(id, name, icon, catKey, cost, now, now);
  return getReward(id);
}

/** Edit a custom reward's fields (id stays frozen). Built-ins are file-only. */
export function updateReward(id, fields) {
  if (!isCustom(id)) {
    throw new Error(isBuiltin(id) ? 'built-in rewards can only be hidden, not edited' : `unknown reward "${id}"`);
  }
  const { name, icon, catKey, cost } = cleanFields(fields);
  db.prepare(`UPDATE custom_rewards SET name = ?, icon = ?, cat_key = ?, cost = ?, updated_at = ? WHERE id = ?`).run(
    name,
    icon,
    catKey,
    cost,
    nowIso(),
    id
  );
  return getReward(id);
}

/** Hide or show a reward — works for both built-ins (override row) and customs.
 *  Hiding also drops it from everyone's "working toward" list. */
export function setRewardHidden(id, hidden) {
  const on = hidden ? 1 : 0;
  if (isCustom(id)) {
    db.prepare('UPDATE custom_rewards SET hidden = ?, updated_at = ? WHERE id = ?').run(on, nowIso(), id);
  } else if (isBuiltin(id)) {
    db.prepare(
      `INSERT INTO reward_overrides (id, hidden, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET hidden = excluded.hidden, updated_at = excluded.updated_at`
    ).run(id, on, nowIso());
  } else {
    throw new Error(`unknown reward "${id}"`);
  }
  if (on) clearAssignmentsForReward(id);
  return getReward(id, { includeHidden: true });
}

/**
 * Remove a custom reward. Hard-deletes it if it has never been redeemed;
 * otherwise hides it, so past redemptions stay name-resolvable in the recap.
 * Either way it's cleared from everyone's "working toward" list. Built-ins
 * can't be removed here (only hidden). Returns how it went.
 */
export function removeCustomReward(id) {
  if (!isCustom(id)) {
    throw new Error(isBuiltin(id) ? 'built-in rewards cannot be deleted, only hidden' : `unknown reward "${id}"`);
  }
  clearAssignmentsForReward(id);
  if (hasRedemptions(id)) {
    db.prepare('UPDATE custom_rewards SET hidden = 1, updated_at = ? WHERE id = ?').run(nowIso(), id);
    return { removed: 'hidden' };
  }
  db.prepare('DELETE FROM custom_rewards WHERE id = ?').run(id);
  return { removed: 'deleted' };
}
