/* global HTMLRewriter */

const API_BASE = 'https://api.bilup.org/api';
const AVATARS = 'https://avatars.accounts.bilup.org';
const FETCH_TIMEOUT_MS = 3000;

class AttrSetter {
    constructor (name, value) {
        this.name = name;
        this.value = value;
    }
    element (el) {
        el.setAttribute(this.name, this.value);
    }
}

class TextReplacer {
    constructor (value) {
        this.value = value;
        this.first = true;
    }
    text (chunk) {
        chunk.replace(this.first ? this.value : '');
        this.first = false;
    }
}

const fetchJson = async path => {
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            headers: {accept: 'application/json'}
        });
        if (res.ok) return await res.json();
    } catch (e) {
        return null;
    }
    return null;
};

const flatten = text => (text || '').replace(/\s+/g, ' ').trim()
    .slice(0, 200);

const projectMeta = async id => {
    const data = await fetchJson(`/projects/${encodeURIComponent(id)}`);
    if (!data || !data.project || data.project.shared !== true) return null;
    const project = data.project;
    return {
        title: `${project.title} by ${project.owner} - Bilup`,
        description: flatten(project.instructions || project.description) ||
            `Play ${project.title} on Bilup.`,
        image: project.thumbUrl || null,
        card: project.thumbUrl ? 'summary_large_image' : 'summary'
    };
};

const userMeta = async name => {
    const data = await fetchJson(`/users/${encodeURIComponent(name)}`);
    if (!data || data.exists !== true) return null;
    const username = data.username || name;
    return {
        title: `${username} - Bilup`,
        description: flatten(data.bio) ||
            `${username} has shared ${(data.projects || []).length} projects on Bilup.`,
        image: `${AVATARS}/${encodeURIComponent(username.toLowerCase())}`,
        card: 'summary'
    };
};

export const onRequest = async context => {
    const {request, next} = context;
    const url = new URL(request.url);

    // The bare /project path (no id) is the "direct project link" entry
    // (e.g. /project?project_url=...). It has no community route, so let the
    // site's SPA fallback serve the community bundle (index.html), which
    // bounces it to the editor with a one-shot fullscreen flag.
    // Note: we must NOT use context.env.ASSETS.fetch('/index.html') here —
    // Cloudflare Pages 308-redirects /index.html to /, which would bounce the
    // visitor to the homepage instead of the community app.
    if (url.pathname === '/project' || url.pathname === '/project/') {
        return next();
    }

    const projectMatch = url.pathname.match(/^\/project\/([^/]+)\/?$/);
    const userMatch = url.pathname.match(/^\/users\/([^/]+)(\/followers)?\/?$/);
    if (!projectMatch && !userMatch) return next();

    const response = await next();
    if (!(response.headers.get('content-type') || '').includes('text/html')) return response;

    const meta = projectMatch ?
        await projectMeta(decodeURIComponent(projectMatch[1])) :
        await userMeta(decodeURIComponent(userMatch[1]));
    if (!meta) return response;

    let rewriter = new HTMLRewriter()
        .on('title', new TextReplacer(meta.title))
        .on('meta[name="description"]', new AttrSetter('content', meta.description))
        .on('meta[property="og:title"]', new AttrSetter('content', meta.title))
        .on('meta[property="og:description"]', new AttrSetter('content', meta.description))
        .on('meta[property="og:url"]', new AttrSetter('content', url.href))
        .on('meta[name="twitter:card"]', new AttrSetter('content', meta.card));

    if (meta.image) {
        rewriter = rewriter.on('meta[property="og:image"]', new AttrSetter('content', meta.image));
    }

    return rewriter.transform(response);
};
