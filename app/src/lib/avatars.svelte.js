// Per-member avatar URLs, sourced from Todoist once at app start (App.svelte).
// Read-only for chips: AvatarChip resolves its photo via avatarUrl(id) inside a
// $derived, so every chip re-renders when hydration lands. Empty map = everyone
// shows a monogram (no creds / a member without a photo / Todoist down — all
// cosmetic, never blocks the wall). Same cross-module $state pattern as events.
import { getAvatars } from './api.js';

let urls = $state({});

/** Resolve a member id to its avatar URL, or '' if none (→ monogram fallback). */
export const avatarUrl = (id) => (id ? urls[id] : undefined) ?? '';

/** Fetch the avatar map once; overwrites the store (reactive for all chips). */
export async function hydrateAvatars() {
  urls = await getAvatars();
}
