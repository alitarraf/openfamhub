/* Local-date helpers shared across routes, the economy, and backups.
 *
 * Always computed from local wall-clock fields, never by slicing an ISO/UTC
 * string — the whole point is that "today" flips at local midnight (server
 * TZ), which is what the economy's award idempotency key and the journal's
 * "on this day" both depend on.
 */

/** 'YYYY-MM-DD' in server-local time. */
export const localDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** 'MM-DD' in server-local time — drives the Journal timeline's "on this day". */
export const monthDayStr = () => localDateStr().slice(5);

/** The last `n` local dates ['YYYY-MM-DD', ...], oldest first, ending today. */
export function lastNDates(n) {
  const out = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    out.unshift(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
    d.setDate(d.getDate() - 1); // local-time arithmetic, same TZ-safety rule as above
  }
  return out;
}
