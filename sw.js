/*
    Tesla Tower Service Worker
    - Caches core assets for offline play
    - Avoids third-party scripts
*/

// Bump this when changing caching behavior or core assets
const CACHE_VERSION = 'tesla-tower-v2';
const CORE_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './game.js',
    './manifest.json',
    './icon.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(CORE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys
                .filter((k) => k !== CACHE_VERSION)
                .map((k) => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    const isNavigation = req.mode === 'navigate'
        || (req.headers.get('accept') || '').includes('text/html');

    // Network-first for HTML navigations to avoid stale UI + new JS mismatches.
    if (isNavigation) {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (res && res.status === 200 && res.type === 'basic') {
                        const copy = res.clone();
                        caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy));
                    }
                    return res;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    // Stale-while-revalidate for other same-origin GET assets.
    event.respondWith(
        caches.match(req).then((cached) => {
            const fetchPromise = fetch(req)
                .then((res) => {
                    if (res && res.status === 200 && res.type === 'basic') {
                        const copy = res.clone();
                        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
                    }
                    return res;
                })
                .catch(() => undefined);

            return cached || fetchPromise;
        })
    );
});
