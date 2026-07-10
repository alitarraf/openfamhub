/* Journal DB — same SQLite file as the economy (server/economy/db.js), same
 * named-volume rationale (POSIX locks don't survive the drvfs bind mount).
 * Journal photos are irreplaceable family memories, same "one genuinely
 * irreplaceable state" category as the points ledger — server/db/backup.js
 * covers both since they share the file.
 *
 * The journal tables themselves are created by the shared migration runner
 * (server/db/migrations.js), which economy/db.js runs on open.
 */
export { db } from '../economy/db.js';
