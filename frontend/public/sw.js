// Autoscar CRM service worker
// Strategy:
//  - Navigation requests: network-first, fallback to cached shell (for offline)
//  - /api/ and /socket.io/ requests: network-only (never cache dynamic data)
//  - Static assets: stale-while-revalidate

const CACHE_NAME = 'autoscar-crm-v1';
const SHELL_CACHE = 'autoscar-shell-v1';
const OFFLINE_URL = '/offline.html';

const SHELL_URLS = [
  '/',
  '/offline.html',
  '/favicon-autoscar.png',
  '/logo-autoscar.png',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![CACHE_NAME, SHELL_CACHE].includes(k))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Never intercept API / socket traffic
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    return;
  }

  // Navigation: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match(request).then((r) => r ?? caches.match(OFFLINE_URL))),
    );
    return;
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => cached ?? new Response('', { status: 408, statusText: 'Offline' }));
      return cached || fetchPromise;
    }),
  );
});
