const CACHE_VERSION = 'site-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_URL = '/index.html';

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/nav.js',
    '/js/script.js',
    '/partials/nav.html',
    '/records.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    const currentCaches = new Set([STATIC_CACHE, RUNTIME_CACHE]);
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(cacheName => cacheName.startsWith('site-') && !currentCaches.has(cacheName))
                    .map(cacheName => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});

function isSameOrigin(request) {
    return new URL(request.url).origin === self.location.origin;
}

function isDataRequest(request) {
    return new URL(request.url).pathname.endsWith('.json');
}

function isStaticAsset(request) {
    return /\.(?:avif|css|gif|ico|jpe?g|js|pdf|png|svg|webp|woff2?)$/i.test(
        new URL(request.url).pathname
    );
}

async function networkFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw error;
    }
}

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(request, response.clone());
    }
    return response;
}

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET' || !isSameOrigin(request)) return;

    const url = new URL(request.url);
    if (request.mode === 'navigate') {
        event.respondWith(
            networkFirst(request, RUNTIME_CACHE)
                .catch(() => caches.match(OFFLINE_URL))
        );
        return;
    }

    if (isDataRequest(request)) {
        event.respondWith(networkFirst(request, RUNTIME_CACHE));
        return;
    }

    if (isStaticAsset(request)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // Leave non-asset requests to the browser without adding them to the cache.
    if (url.pathname === '/sw.js') return;
});