const CACHE_NAME = 'mw-project-content';
const TTL = 5 * 60 * 1000;
const CACHED_AT_HEADER = 'x-mw-cached-at';

const inflight = new Map();

const openCache = async () => {
    try {
        if (typeof caches === 'undefined') return null;
        return await caches.open(CACHE_NAME);
    } catch (e) {
        return null;
    }
};

// Fetch the URL directly from the browser. CORS failures and network errors
// both surface as TypeError('Failed to fetch'), so callers fall back to the
// same-origin proxy on that error.
const fetchDirect = async url => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Request returned status ${response.status}`);
    }
    return response.arrayBuffer();
};

// Fetch through the same-origin CORS proxy (/api/proxy?url=...), which the
// Cloudflare functions layer and the webpack dev server both implement.
// Used as a fallback when the upstream doesn't allow this origin.
const fetchViaProxy = async url => {
    const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
        throw new Error(`Proxy returned status ${response.status}`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
        // The proxy endpoint didn't actually handle the request (e.g. it fell
        // through to a SPA index.html). Don't treat that page as project data.
        throw new Error('Proxy returned an HTML page instead of project data');
    }
    return response.arrayBuffer();
};

// Reject HTML pages masquerading as project data (e.g. an error page served
// with a generic content-type, or a stale cached index.html).
const looksLikeHtml = buffer => {
    if (buffer.byteLength < 8) return false;
    const prefix = new TextDecoder().decode(new Uint8Array(buffer).subarray(0, 8));
    return prefix.startsWith('<!') || prefix.startsWith('<html') || prefix.startsWith('<HTM');
};

const fetchAndStore = async url => {
    const cache = await openCache();
    if (cache) {
        try {
            const hit = await cache.match(url);
            if (hit) {
                const at = Number(hit.headers.get(CACHED_AT_HEADER));
                if (at && Date.now() - at < TTL) {
                    const cached = await hit.arrayBuffer();
                    if (!looksLikeHtml(cached)) {
                        return cached;
                    }
                    // A stale HTML response was cached; drop it and refetch.
                    cache.delete(url).catch(() => null);
                }
            }
        } catch (e) {
            // fall through to network
        }
    }
    let buffer;
    try {
        buffer = await fetchDirect(url);
    } catch (e) {
        if (e instanceof TypeError) {
            // CORS blocked or network error — retry via the same-origin proxy
            buffer = await fetchViaProxy(url);
        } else {
            throw e;
        }
    }
    if (looksLikeHtml(buffer)) {
        // Last-resort guard: never hand an HTML page to the VM as a project.
        throw new Error('Fetched HTML instead of project data; refusing to load');
    }
    if (cache) {
        try {
            await cache.put(url, new Response(buffer, {headers: {[CACHED_AT_HEADER]: String(Date.now())}}));
        } catch (e) {
            // cache full or unavailable; the fetch still succeeded
        }
    }
    return buffer;
};

const sharedFetch = url => {
    let promise = inflight.get(url);
    if (!promise) {
        promise = fetchAndStore(url).finally(() => inflight.delete(url));
        inflight.set(url, promise);
    }
    return promise;
};

const cachedFetchBuffer = url => sharedFetch(url).then(buffer => buffer.slice(0));

const cachedFetchJson = url => sharedFetch(url)
    .then(buffer => JSON.parse(new TextDecoder().decode(buffer)));

const clearContentCache = () => {
    try {
        if (typeof caches !== 'undefined') {
            caches.delete(CACHE_NAME).catch(() => null);
        }
    } catch (e) {
        // ignore
    }
};

export {cachedFetchBuffer, cachedFetchJson, clearContentCache};
