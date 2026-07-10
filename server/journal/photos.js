/* Journal photo storage — resized/recompressed into ./data (bind mount, same
 * volume the screensaver photos and Monarch snapshot already use — this is
 * bulk file blobs, not SQLite, so the drvfs POSIX-lock hazard that pushed
 * the economy DB onto a named volume doesn't apply here).
 *
 * Uploads land in memory (not disk) first so jimp can resize/recompress
 * before anything is written — a raw phone photo (often 3-10MB) becomes a
 * ~1600px-long-edge JPEG, typically well under 500KB, before it ever touches
 * disk. Using jimp (pure JS, no native binary) rather than sharp — sharp's
 * prebuilt libvips requires SSE4.1/4.2/AVX, which a 2011-era AMD APU thin
 * client (this project's actual target hardware) doesn't have, so sharp
 * SIGILLs on every call there. jimp's EXIF auto-rotation happens
 * automatically on `Jimp.read()`, so sideways phone photos still land
 * upright with no extra step.
 *
 * Always re-encoded to .jpg regardless of upload format (png/webp in, jpg
 * out) — simpler than tracking per-format output paths, and family photo
 * content has no transparency to lose.
 */
import { Jimp } from 'jimp';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const JOURNAL_PHOTOS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'journal-photos');
mkdirSync(JOURNAL_PHOTOS_DIR, { recursive: true });

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 8 * 1024 * 1024; // 8MB — the pre-compression upload cap
const MAX_EDGE = 1600; // longest side, px — plenty for a wall card or PWA view
const JPEG_QUALITY = 82;

/** Express middleware for a single optional `photo` field on the create route.
 * Buffered in memory (not written to disk yet) — saveJournalPhoto() below
 * does the actual resize + disk write once the route has validated the rest
 * of the form. */
export const uploadJournalPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_MIMES.has(file.mimetype))
}).single('photo');

/** Resize + recompress a photo buffer, write it to JOURNAL_PHOTOS_DIR, and
 * return its filename (for journal_entries.photo_path). */
export async function saveJournalPhoto(buffer) {
  const filename = `${randomUUID()}.jpg`;
  const image = await Jimp.read(buffer); // EXIF orientation is auto-applied here
  if (image.bitmap.width > MAX_EDGE || image.bitmap.height > MAX_EDGE) {
    image.scaleToFit({ w: MAX_EDGE, h: MAX_EDGE }); // no withoutEnlargement equivalent — guard manually
  }
  await image.write(join(JOURNAL_PHOTOS_DIR, filename), { quality: JPEG_QUALITY });
  return filename;
}
