/* Journal entry tags — static config, same idiom as config/rewards.js.
 * `id` is the stored value (journal_entries.tag) — keep it stable. `catKey`
 * points at the existing 5-color palette (app/src/lib/data/mock.js `cat`)
 * that reward icons already use, so tags read as "part of this app" rather
 * than a new palette.
 *
 * An entry can also have no tag at all (plain "everyday" note) — that's
 * `tag: null`, not a 5th entry here; the frontend just renders it untagged.
 */
export const journalTags = () => [
  { id: 'milestone', label: 'Milestone', icon: 'military_tech', catKey: 'gold' },
  { id: 'quote', label: 'Funny Quote', icon: 'chat_bubble', catKey: 'iris' },
  { id: 'school', label: 'School', icon: 'backpack', catKey: 'sky' },
  { id: 'health', label: 'Health', icon: 'favorite', catKey: 'coral' },
  // Auto-posted weekly/monthly summaries (server/journal/recap.js) — listed
  // here so the badge renders; nothing stops a human using it too.
  { id: 'recap', label: 'Recap', icon: 'insights', catKey: 'fern' }
];
