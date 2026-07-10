/* Reward catalog — one shared list, visible to everyone; redeeming picks who
 * it's for (see TasksRewardScreen). Static config so authoring stays
 * off-device, matching config/members.js — edit this file + `docker compose
 * up -d` to add/change rewards.
 *
 * `id` is the ledger's redemption key — keep it stable. Renaming `name` is
 * fine; changing `id` orphans past redemptions from this entry.
 *
 * Costs are calibrated for 1 point per chore (see server/economy/index.js) —
 * a handful of chores a day means these numbers should stay small, roughly
 * "a few days" to "a couple weeks" of chores. Tune freely.
 */
export const rewards = () => [
  // Small — same day, low-stakes
  { id: 'pick-dessert', name: "Pick tonight's dessert", icon: 'cake', catKey: 'coral', cost: 4 },
  { id: 'pick-music', name: 'Pick the car/dinner music', icon: 'music_note', catKey: 'iris', cost: 3 },
  { id: 'ice-cream', name: 'Ice cream', icon: 'icecream', catKey: 'coral', cost: 5 },
  { id: 'skip-a-chore', name: 'Skip one chore today', icon: 'event_busy', catKey: 'sky', cost: 6 },
  { id: 'extra-screen-time', name: '30 extra minutes of screen time', icon: 'tablet', catKey: 'sky', cost: 6 },
  { id: 'movie-night-pick', name: 'Movie night pick', icon: 'movie', catKey: 'iris', cost: 8 },

  // Medium — about a week
  { id: 'late-bedtime', name: 'Late bedtime', icon: 'bedtime', catKey: 'gold', cost: 10 },
  { id: 'cook-together', name: 'Help cook or bake something you pick', icon: 'restaurant', catKey: 'fern', cost: 12 },
  { id: 'parent-one-on-one', name: 'One-on-one time with Mom or Dad', icon: 'favorite', catKey: 'coral', cost: 12 },
  {
    id: 'choose-family-activity',
    name: 'Pick what the family does this weekend',
    icon: 'groups',
    catKey: 'fern',
    cost: 15
  },
  { id: 'friend-playdate', name: 'Have a friend over', icon: 'home', catKey: 'gold', cost: 15 },
  { id: 'no-chores-weekend', name: 'A whole weekend off chores', icon: 'weekend', catKey: 'sky', cost: 18 },

  // Large — about two weeks
  { id: 'new-game', name: 'New game', icon: 'sports_esports', catKey: 'sky', cost: 25 },
  { id: 'friend-outing', name: 'Take a friend along on an outing', icon: 'group_add', catKey: 'iris', cost: 30 },
  {
    id: 'special-purchase',
    name: 'A small special purchase (book, art supplies, etc.)',
    icon: 'shopping_bag',
    catKey: 'gold',
    cost: 30
  },
  {
    id: 'role-reversal-day',
    name: 'Be in charge for a day — pick meals, activities, bedtime',
    icon: 'stars',
    catKey: 'coral',
    cost: 35
  },
  { id: 'day-trip', name: 'Day trip', icon: 'attractions', catKey: 'fern', cost: 40 },

  // Big — occasional, aspirational
  {
    id: 'big-outing',
    name: 'A bigger outing — theme park, aquarium, etc.',
    icon: 'confirmation_number',
    catKey: 'fern',
    cost: 70
  }
];
