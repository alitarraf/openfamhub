# Rewards

The reward **catalog** — every reward that could exist ("Ice cream", "Movie night
pick", "New game") — comes from two layers that merge into one list:

- **Built-in defaults** — a static config file, `server/config/rewards.js`, that ships
  18 entries across four cost tiers. This is the fresh-install starting point.
- **Custom rewards** — anything a parent adds from the [companion phone app](/guide/mobile),
  stored in the database. These sit alongside the built-ins in the same catalog.

You don't have to touch the config file at all: for day-to-day use, add and manage
rewards from your phone (below). The file is still there for the built-in defaults and
for anyone who prefers editing rewards as code.

## Adding rewards from the phone {#adding}

Naming a reward means typing, and [typing never happens on the wall](/guide/overview#design-principles) —
so creating and editing rewards lives in the **Rewards** tab of the
[companion PWA](/guide/mobile) (parents only).

Tap **Add a reward** and you get a live-updating card preview plus four fields:

| Field | |
|---|---|
| **Name** | What the family sees. Up to 80 characters. |
| **Cost** | In points, set with the − / + stepper (or type a number). Points are flat — 1 per chore — so keep costs in the "a few days to a couple weeks of chores" range or the economy stops feeling achievable. |
| **Color** | One of the five tile colors (`sky` / `fern` / `iris` / `coral` / `gold`). |
| **Icon** | A [Material Symbols](https://fonts.google.com/icons) name. Type it and the preview icon updates as you go, or tap one from the curated grid of common picks below the field. |

The preview card at the top is exactly what lands on the wall, so you can see the
reward before you save it. Tap **Add reward** (or **Save changes** when editing) and it
appears in the catalog immediately — the wall picks it up live.

Custom rewards can be **edited** or **removed** from the same list later; built-in
rewards can only be hidden (see below), since their name, cost, and icon are authored
in the config file.

::: tip A redeemed reward is kept, not erased
If you remove a custom reward that a kid has *already redeemed* at some point, it's
hidden rather than deleted — that way past redemptions still show the right name in the
[weekly recap](/guide/journal). A reward that was never redeemed is deleted outright.
Its internal `id` is also frozen once created (editing the name never changes it), for
the same reason.
:::

## Hiding rewards from the wall {#hiding}

Any reward — built-in or custom — can be **hidden** so it doesn't clutter the catalog,
without losing it. Hiding is the one catalog action that needs no keyboard, so it's
reachable **both** from the phone's Rewards tab **and** on the wall via the Reward tab's
**Manage** button (tap the eye icon on a reward's card). Hiding a reward also removes it
from everyone who was working toward it. Tap the eye again to bring it back.

This is how you retire a built-in you don't use: you can't rename or delete it from the
UI (that's a config-file edit), but you can hide it and forget about it.

## Assigning and redeeming

*Assigning* a catalog reward to a specific person ("Mom is working toward a spa day")
happens on the wall, via the Reward tab's **Manage** button — tap a member's initial on
the reward's card. It's on-wall because it's a spontaneous, tap-only action (no typing),
not something worth reaching for a phone.

Tapping **Redeem** checks that person's balance, and if it covers the cost: deducts it,
logs the redemption, and drops the assignment (redeem it again later to save up for a
repeat). Redeem is disabled automatically when the balance is too low, and hidden
rewards never appear on the redeem grid.

## Editing the built-in defaults {#config-file}

The 18 shipped rewards live in `server/config/rewards.js`. Editing this file is optional
— it's for changing the built-in defaults themselves, or for anyone who'd rather manage
rewards as code than tap through the phone.

```js [server/config/rewards.js]
export const rewards = () => [
  // Small — same day, low-stakes
  { id: 'pick-dessert', name: "Pick tonight's dessert", icon: 'cake', catKey: 'coral', cost: 4 },
  { id: 'ice-cream', name: 'Ice cream', icon: 'icecream', catKey: 'coral', cost: 5 },
  // ...

  // Medium — about a week
  { id: 'late-bedtime', name: 'Late bedtime', icon: 'bedtime', catKey: 'gold', cost: 10 },
  { id: 'parent-one-on-one', name: 'One-on-one time with Mom or Dad', icon: 'favorite', catKey: 'coral', cost: 12 },
  // ...

  // Large — about two weeks
  { id: 'new-game', name: 'New game', icon: 'sports_esports', catKey: 'sky', cost: 25 },
  { id: 'day-trip', name: 'Day trip', icon: 'attractions', catKey: 'fern', cost: 40 },
  // ...

  // Big — occasional, aspirational
  { id: 'big-outing', name: 'A bigger outing — theme park, aquarium, etc.', icon: 'confirmation_number', catKey: 'fern', cost: 70 }
];
```

| Field | Notes |
|---|---|
| `id` | Stable key used by the points ledger. Renaming `name` is fine; **changing `id`** orphans that reward from its past redemption history. |
| `icon` | A [Material Symbols](https://fonts.google.com/icons) name (rounded style, already bundled). |
| `catKey` | One of `sky` / `fern` / `iris` / `coral` / `gold` — controls the icon tile color. |
| `cost` | In points. Points are flat (1 per chore), so costs are calibrated to that scale — keep new entries in the "a few days to a couple weeks of chores" range (or "occasional, aspirational" for the rare big one) or the economy stops feeling achievable. |

**On the default catalog's mix:** it leans toward experiences, privileges, and
one-on-one time (a friend over, picking the weekend activity, a day off chores) rather
than toys or purchases — reward-system research consistently finds that skew builds
the habit without nudging kids toward materialism the way an all-toys catalog can.
Feel free to prune or retheme it entirely; the tiering is a convention, not a
requirement enforced by the app.

After editing, `docker compose up -d` picks it up (no rebuild needed — the file is
read fresh per request). Custom rewards added from the phone are stored separately in
the database, so they survive config-file edits untouched.
