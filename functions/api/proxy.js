// CORS proxy used to load external project files (e.g. /editor?project_url=...)
// when the upstream server doesn't send an Access-Control-Allow-Origin header
// matching this site (e.g. a server that only allows turbowarp.org).
// The browser never fetches the upstream directly — it calls this same-origin
// endpoint, which forwards the request from the Cloudflare edge.
//
// The client (cached-fetch.js) falls back to this endpoint when a direct
// fetch fails. The dev server implements the same route in webpack.config.js.

export const onRequest = async context => {
    const url = new URL(context.request.url);
    const target = url.searchParams.get('url');
    if (!target || !/^https?:\/\//i.test(target)) {
        return new Response('Bad request: missing or invalid url parameter', {status: 400});
    }

    let response;
    try {
        response = await fetch(target, {
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; BilupProjectProxy/1.0)'
            }
        });
    } catch (e) {
        return new Response('Upstream fetch failed', {status: 502});
    }

    if (!response.ok) {
        return new Response(`Upstream error: ${response.status}`, {status: 502});
    }

    const headers = new Headers();
    const contentType = response.headers.get('content-type');
    if (contentType) headers.set('content-type', contentType);
    const contentLength = response.headers.get('content-length');
    if (contentLength) headers.set('content-length', contentLength);
    // Cache at the edge so repeated loads of the same project are fast.
    headers.set('cache-control', 'public, max-age=300, s-maxage=300');

    return new Response(response.body, {status: 200, headers});
};
