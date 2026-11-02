// Service worker van Crumbly. Drie taken:
//  1. installeerbaar maken (fetch-handler),
//  2. de app-schil bewaren zodat Crumbly ook zonder netwerk opstart
//     (de gegevens zelf staan lokaal op het toestel),
//  3. meldingen tonen (wekkers voor bakstappen en voedingen).
// Verzoeken naar andere domeinen (Supabase) gaan ongemoeid naar het netwerk.
const CACHE = 'crumbly-shell-v1';
const SHELL = '/';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(SHELL, copy));
          return res;
        })
        .catch(() => caches.match(SHELL).then((hit) => hit || Response.error())),
    );
    return;
  }

  // Bundels met een vingerafdruk in de naam en vaste bestanden: eerst uit de cache.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    }),
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = typeof data.title === 'string' ? data.title : 'Crumbly';
  const body = typeof data.body === 'string' ? data.body : '';
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/';
  const tag = typeof data.tag === 'string' ? data.tag : 'crumbly';
  event.waitUntil(
    self.registration.showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag, data: { url } }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});
