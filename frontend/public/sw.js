// FloraIQ Service Worker v2.1
// Caches static assets + plant library for offline use

const CACHE_NAME = 'floraiq-v2.1';
const STATIC_CACHE = 'floraiq-static-v2.1';
const API_CACHE = 'floraiq-api-v2.1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
];

// ── Install: pre-cache static shell ───────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== API_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch strategy ─────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle same-origin + openstreetmap tiles
  const isOSM = url.hostname.endsWith('tile.openstreetmap.org');
  const isSameOrigin = url.origin === self.location.origin;
  if (!isSameOrigin && !isOSM) return;

  // API routes: Network first, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request, API_CACHE));
    return;
  }

  // Map tiles: Cache first (tiles never change for same URL)
  if (isOSM) {
    event.respondWith(cacheFirst(event.request, API_CACHE));
    return;
  }

  // Static assets: Cache first
  event.respondWith(cacheFirst(event.request, STATIC_CACHE));
});

async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request.clone());
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      // Only cache GET requests
      if (request.method === 'GET') {
        cache.put(request, networkResponse.clone());
      }
    }
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'You are offline', offline: true }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request.clone());
    if (networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// ── Background sync for SOS when offline ──────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sos-sync') {
    event.waitUntil(syncSOS());
  }
});

async function syncSOS() {
  const db = await getDB();
  const pending = await db.getAll('pending-sos');
  for (const item of pending) {
    try {
      await fetch('/api/survival/sos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
      await db.delete('pending-sos', item.id);
    } catch { }
  }
}

// Simple IndexedDB helper for background sync
function getDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('floraiq-sync', 1);
    req.onupgradeneeded = e => { e.target.result.createObjectStore('pending-sos', { keyPath: 'id', autoIncrement: true }); };
    req.onsuccess = e => {
      const db = e.target.result;
      resolve({
        getAll: store => new Promise((res, rej) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = rej; }),
        delete: (store, id) => new Promise((res, rej) => { const r = db.transaction(store, 'readwrite').objectStore(store).delete(id); r.onsuccess = res; r.onerror = rej; }),
      });
    };
    req.onerror = reject;
  });
}

// ── Push notifications ─────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'FloraIQ', {
      body: data.body || data.message,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
