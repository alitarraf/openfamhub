// Minimal service worker — runtime caching only, no build-time precache list
// (Vite hashes asset filenames per build, so a static manifest would go stale
// immediately). Network-first for the HTML shell and API calls — freshness
// matters more than offline-perfection for a chore app; cache-first for
// hashed static assets, safe since their filename changes when content does.
const CACHE = 'openfamhub-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Web push (chore reminder / dinner digest — server/push/scheduler.js).
// Payload: { title, body, url? }.
self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    /* non-JSON push → generic notification below */
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'OpenFamHub', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/m' }
    })
  );
});

// Tap → focus an existing PWA window if one is open, else open one.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/m';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).pathname.startsWith('/m')) return w.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never cache API calls — always hit the network.
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })
    );
    return;
  }

  // HTML shell: network-first, cache fallback so the app still opens offline.
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((cache) => cache.put(request, res.clone()));
        return res;
      })
      .catch(() => caches.match(request))
  );
});
