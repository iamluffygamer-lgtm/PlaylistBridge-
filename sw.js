/**
 * PlaylistBridge — sw.js (v1.0)
 * Service Worker: PWA caching, offline shell, background stability.
 * ─────────────────────────────────────────────────────────────────
 * Strategy:
 *   • App shell (HTML, CSS, JS, icons) → Cache First
 *   • Netlify functions (API calls)    → Network First, fallback gracefully
 *   • External (Firebase, YouTube)     → Network Only (never cache)
 */

const CACHE_NAME    = 'pb-shell-v1';
const RUNTIME_CACHE = 'pb-runtime-v1';

/* Files to pre-cache on install — the app shell */
const SHELL_FILES = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/ui.js',
    '/player.js',
    '/share-system.js',
    '/sharecard.js',
    '/os.js',
    '/site.webmanifest',
    '/favicon.ico',
    '/favicon-32x32.png',
    '/favicon-16x16.png',
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png',
    '/apple-touch-icon.png',
];

/* Origins to never cache */
const BYPASS_ORIGINS = [
    'firebaseapp.com',
    'googleapis.com',
    'gstatic.com',
    'youtube.com',
    'youtu.be',
    'itunes.apple.com',
    'music.apple.com',
];

function shouldBypass(url) {
    return BYPASS_ORIGINS.some(o => url.hostname.includes(o));
}

function isNetlifyFunction(url) {
    return url.pathname.startsWith('/.netlify/functions/');
}

/* ── INSTALL: pre-cache shell ── */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(SHELL_FILES))
            .then(() => self.skipWaiting())
    );
});

/* ── ACTIVATE: clean up old caches ── */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE)
                    .map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

/* ── FETCH: routing logic ── */
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. Never intercept non-GET or bypassed origins
    if (event.request.method !== 'GET') return;
    if (shouldBypass(url)) return;

    // 2. Netlify functions → Network First (fresh data), no cache
    if (isNetlifyFunction(url)) {
        event.respondWith(
            fetch(event.request).catch(() =>
                new Response(JSON.stringify({ error: 'offline' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' },
                })
            )
        );
        return;
    }

    // 3. App shell → Cache First, fall back to network
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;

            return fetch(event.request).then(response => {
                // Only cache successful same-origin responses
                if (
                    response.ok &&
                    url.origin === self.location.origin &&
                    response.type === 'basic'
                ) {
                    const clone = response.clone();
                    caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // If offline and requesting HTML → serve cached index
                if (event.request.headers.get('accept')?.includes('text/html')) {
                    return caches.match('/index.html');
                }
                return new Response('Offline', { status: 503 });
            });
        })
    );
});

/* ── BACKGROUND SYNC: retry failed API calls ── */
self.addEventListener('sync', (event) => {
    if (event.tag === 'pb-retry') {
        // Placeholder for future retry logic
    }
});

/* ── MESSAGE: communicate with os.js ── */
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data?.type === 'CACHE_URLS') {
        const urls = event.data.urls || [];
        caches.open(RUNTIME_CACHE).then(cache => cache.addAll(urls));
    }
});
