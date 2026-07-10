# Rewards

The reward **catalog** — every reward that could exist ("Ice cream", "Movie night
pick", "New game") — is a static config file, `server/config/rewards.js`, edited by
hand. The bundled default ships 18 entries across four cost tiers:

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
read fresh per request).

## Assigning and redeeming

*Assigning* a catalog reward to a specific person ("Mom is working toward a spa day")
is the one deliberate exception to "authoring stays off-device" — it happens on-wall,
via the Reward tab's **Manage** button, because it's something a parent wants to do
spontaneously, not something worth a config-file edit every time.

Tapping **Redeem** checks that person's balance, and if it covers the cost: deducts it,
logs the redemption, and drops the assignment (redeem it again later to save up for a
repeat). Redeem is disabled automatically when the balance is too low.
