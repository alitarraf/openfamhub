/* Web push — subscription store + sender. Requires VAPID keys in .env
 * (generate once with `npx web-push generate-vapid-keys`):
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT (mailto:you@...)
 *
 * Push only works from a secure context, so the PWA must be reached over
 * HTTPS — `tailscale serve` in HTTPS mode provides that with a free ts.net
 * certificate (see docs/deployment/self-hosting.md). Without VAPID keys
 * everything here degrades to a no-op, same fail-soft contract as every
 * other source.
 */
import webpush from 'web-push';
import { db } from '../economy/db.js';

const env = (k) => (process.env[k] || '').trim();
export const hasVapid = () => !!(env('VAPID_PUBLIC_KEY') && env('VAPID_PRIVATE_KEY'));
export const vapidPublicKey = () => env('VAPID_PUBLIC_KEY');

let configured = false;
function ensureConfigured() {
  if (configured || !hasVapid()) return hasVapid();
  webpush.setVapidDetails(
    env('VAPID_SUBJECT') || 'mailto:admin@example.com',
    env('VAPID_PUBLIC_KEY'),
    env('VAPID_PRIVATE_KEY')
  );
  configured = true;
  return true;
}

/** Upsert a browser subscription for a member (endpoint is the identity). */
export function saveSubscription(memberId, sub) {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) throw new Error('malformed subscription');
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, member_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth`
  ).run(sub.endpoint, memberId, sub.keys.p256dh, sub.keys.auth, new Date().toISOString());
}

export function deleteSubscription(endpoint) {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}

/** True if the member has at least one live subscription. */
export function hasSubscription(memberId) {
  return !!db.prepare('SELECT 1 FROM push_subscriptions WHERE member_id = ? LIMIT 1').get(memberId);
}

/**
 * Send { title, body, url? } to every subscription of every listed member.
 * Dead endpoints (404/410) are pruned; other failures are logged and
 * swallowed — notifications are best-effort by definition.
 * Returns how many sends succeeded.
 */
export async function sendToMembers(memberIds, payload) {
  if (!ensureConfigured() || !memberIds.length) return 0;
  const placeholders = memberIds.map(() => '?').join(',');
  const subs = db
    .prepare(`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE member_id IN (${placeholders})`)
    .all(...memberIds);
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        deleteSubscription(s.endpoint); // browser dropped the subscription
      } else {
        console.warn(`push: send failed (${err.statusCode || err.message})`);
      }
    }
  }
  return sent;
}
