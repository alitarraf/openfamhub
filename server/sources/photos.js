/* Screensaver photo source — local folder, not Google Photos. Google locked
 * the Photos API down in March 2025 (Library API can't read an existing
 * library anymore; the replacement Picker API needs manual re-auth every
 * ~60min) — not viable for an always-on kiosk. A local folder someone drops
 * files into (however they sync it) has no such failure mode.
 */
import { readdir } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PHOTOS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'photos');

const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/** Filenames only (no path) of every image in the photos folder, sorted. */
export async function listPhotos() {
  let entries;
  try {
    entries = await readdir(PHOTOS_DIR);
  } catch {
    return [];
  }
  return entries.filter((f) => EXTS.has(extname(f).toLowerCase())).sort();
}
