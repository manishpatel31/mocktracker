// ══════════════════════════════════════════════════════════════
//  MockTracker Pro — Service Worker
//  Bump CACHE_VERSION on every deploy to force cache refresh.
// ══════════════════════════════════════════════════════════════

const CACHE_VERSION = 'v26';          // ← change this every time you deploy
const CACHE_NAME    = `mocktracker-${CACHE_VERSION}`;

const PRECACHE = [
    './',
    './index.html',
    './manifest.json',
];

// ── Install: cache shell assets ──────────────────────────────
self.addEventListener('install', event => {
    // Don't call self.skipWaiting() here — we want the update banner
    // to show first so users can choose when to reload.
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).catch(() => {})
    );
});

// ── Activate: delete OLD caches ──────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// ── Fetch: Network-first (always get latest HTML) ────────────
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Only handle same-origin requests
    if (url.origin !== location.origin) return;

    // For navigation (HTML page loads) — network first, then cache fallback
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache the fresh page
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request).then(r => r || caches.match('./index.html')))
        );
        return;
    }

    // For other assets — stale-while-revalidate
    event.respondWith(
        caches.match(event.request).then(cached => {
            const networkFetch = fetch(event.request).then(response => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                }
                return response;
            }).catch(() => null);
            return cached || networkFetch;
        })
    );
});

// ── Message: skip waiting on user request ────────────────────
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
