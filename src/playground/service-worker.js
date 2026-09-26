// Enhanced service worker for improved caching and performance
// Bump this whenever a deploy changes the asset graph. The activate handler
// deletes every cache whose name is not one of the two below, so a bump is what
// evicts a previously poisoned cache from returning visitors.
const CACHE_NAME = 'pinewarp-cache-v4';
const RUNTIME_CACHE = 'pinewarp-runtime-v2';

// Assets to cache immediately. Every entry must resolve in the deploy: a single
// 404 makes cache.addAll reject and nothing at all gets precached.
const PRECACHE_URLS = [
    '/images/192.png',
    '/manifest.webmanifest',
    '/favicon.ico'
];

// Install event - cache core assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Precaching core assets');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => self.skipWaiting())
            .catch(err => {
                console.log('Precache failed, continuing anyway:', err);
                self.skipWaiting();
            })
    );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => Promise.all(
            cacheNames
                .filter(cacheName => cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE)
                .map(cacheName => {
                    console.log('Deleting old cache:', cacheName);
                    return caches.delete(cacheName);
                })
        ))
            .then(() => self.clients.claim())
    );
});

// Cache first strategy - good for static assets
const cacheFirst = async request => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.status === 200) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.log('Cache first failed for:', request.url);
        throw error;
    }
};

// Network first strategy - good for dynamic content
const networkFirst = async request => {
    const cache = await caches.open(RUNTIME_CACHE);
    
    try {
        const response = await fetch(request);
        if (response.status === 200) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
        throw error;
    }
};

// Stale while revalidate - good for frequently updated content
const staleWhileRevalidate = async request => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);
    
    const fetchPromise = fetch(request).then(response => {
        if (response.status === 200) {
            cache.put(request, response.clone());
        }
        return response;
    })
        .catch(() => cached);

    return cached || fetchPromise;
};

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
    const {request} = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip Chrome extension requests
    if (url.protocol === 'chrome-extension:') return;

    // Handle different types of requests with appropriate strategies
    if (request.destination === 'document' || request.mode === 'navigate') {
        // Always prefer the network for HTML. A cache-first document pins the
        // visitor to the previous deploy's HTML, which references the previous
        // deploy's hashed chunks - so the old build keeps running forever.
        // Network-first means the next load picks up a new deploy immediately.
        event.respondWith(networkFirst(request));
    } else if (request.destination === 'script' || request.destination === 'style') {
        // Cache first for JS/CSS files
        event.respondWith(cacheFirst(request));
    } else if (request.destination === 'image') {
        // Cache first for images
        event.respondWith(cacheFirst(request));
    } else if (url.pathname.includes('/api/') || url.pathname.includes('/internalapi/')) {
        // Network first for API calls
        event.respondWith(networkFirst(request));
    } else if (url.pathname.endsWith('.sb3') || url.pathname.includes('projects')) {
        // Network first for project files, but cache for offline
        event.respondWith(networkFirst(request));
    } else {
        // Stale while revalidate for everything else
        event.respondWith(staleWhileRevalidate(request));
    }
});

const cleanupCache = async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const requests = await cache.keys();
    
    // Remove old entries (keep last 100)
    if (requests.length > 100) {
        const toDelete = requests.slice(0, requests.length - 100);
        await Promise.all(toDelete.map(request => cache.delete(request)));
    }
};

// Handle periodic cache cleanup
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'CLEANUP_CACHE') {
        cleanupCache();
    }
});

// Cleanup cache every hour
setInterval(cleanupCache, 60 * 60 * 1000);