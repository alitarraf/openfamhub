/* Live-update bus — one SSE stream (GET /api/live) instead of WebSockets:
 * one-directional is all the wall needs, it's plain HTTP (proxies and
 * `tailscale serve` pass it untouched), and reconnect/backoff comes free
 * with the browser's EventSource. Write routes publish a kind ('tasks',
 * 'economy', 'journal', 'meals', 'presence', ...) and every connected
 * client re-hydrates — the 5-minute poll heartbeat stays as the fallback
 * when the stream is down, so this is an accelerator, not a dependency.
 */
const clients = new Set();
const PING_MS = 25 * 1000; // keep intermediaries from idling the socket out

/** Express handler for the SSE endpoint. */
export function sseHandler(req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  res.write(': connected\n\n');
  clients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), PING_MS);
  req.on('close', () => {
    clearInterval(ping);
    clients.delete(res);
  });
}

/** Broadcast { kind, ...extra } to every connected client. Never throws —
 * a hung client must not fail the write route that triggered the publish. */
export function publish(kind, extra = {}) {
  const msg = `data: ${JSON.stringify({ kind, ...extra })}\n\n`;
  for (const res of clients) {
    try {
      res.write(msg);
    } catch {
      clients.delete(res);
    }
  }
}

/** Connected-client count (health/debug). */
export const liveClients = () => clients.size;
