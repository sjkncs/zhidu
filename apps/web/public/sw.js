// Zhidu Service Worker — Cache-First for static, Network-First for API
const CACHE_VERSION = 'zhidu-sw-v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// Development mode: skip all caching on localhost to avoid stale bundles
const IS_DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

// Static assets to pre-cache on install (production only)
const PRECACHE_URLS = IS_DEV ? [] : [
  '/offline',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
];

// Max entries in dynamic cache (LRU eviction)
const MAX_DYNAMIC_ENTRIES = 50;

// ─── Install ─────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // Activate immediately without waiting for old SW to release
  self.skipWaiting();
});

// ─── Activate ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      if (IS_DEV) {
        // Dev mode: clear ALL caches to prevent stale bundles
        return Promise.all(keys.map((key) => caches.delete(key)));
      }
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  // Take control of all open pages immediately
  self.clients.claim();
});

// ─── Fetch ───────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Development mode: pass everything through to network (no caching)
  if (IS_DEV) return;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (analytics, CDN, etc.)
  if (url.origin !== self.location.origin) return;

  // API routes → Network-First (fresh data, fallback to cache)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Next.js static assets (_next/static/*) → Cache-First (immutable, hash-versioned)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigation requests → Stale-While-Revalidate (fast, then update)
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Everything else (images, fonts, etc.) → Cache-First
  event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
});

// ─── Strategies ──────────────────────────────────────────

/** Network-First: try network, fallback to cache, fallback to offline page */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES);
    }
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // For API requests that fail offline, return a JSON error
    return new Response(
      JSON.stringify({ error: 'offline', message: '当前无网络连接' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/** Cache-First: try cache, fallback to network */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      if (cacheName === DYNAMIC_CACHE) {
        trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES);
      }
    }
    return networkResponse;
  } catch {
    // If it's a navigation request, show offline page
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline');
      if (offlinePage) return offlinePage;
    }
    return new Response('Offline', { status: 503 });
  }
}

/** Stale-While-Revalidate: return cache immediately, update in background */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// ─── Helpers ─────────────────────────────────────────────

/** Trim cache to max entries (delete oldest first) */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
  }
}

// ─── Message handling ────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});
