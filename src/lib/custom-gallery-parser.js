/**
 * 自定义扩展库内容解析器。
 *
 * 自定义扩展库既支持标准 JSON 元数据（{extensions: [...]} 或纯数组），
 * 也支持直接传入扩展网站的网页（HTML）。对于网页，会按以下顺序尝试提取：
 *   1. <script type="application/json"> 内嵌的扩展元数据
 *   2. 页面中指向 .js 扩展文件的链接（data-copy 属性、?extension= 等查询参数、
 *      <a href> 与 <script src>），并尝试从所在卡片补齐名称、描述与图标
 *
 * 对于扩展列表由前端 JS 动态渲染的站点（SPA，如 PenguinMod 扩展站、
 * Mistium 扩展站），页面 HTML 中没有扩展卡片，则进一步做"资源发现"：
 *   3. 抓取页面引用的脚本资源（script[src] / modulepreload），从中提取
 *      编译进 JS 的扩展元数据（name + code + banner 等字段）
 *   4. 抓取页面源码中出现的扩展元数据 JSON 路径（如
 *      generated-metadata/extensions-v0.json）
 * 最终通过探测 URL 有效性来确定扩展脚本与图标的真实地址。
 */

// 常见前端构建产物目录，出现在 <script src> 中时视为页面自身脚本而非扩展
const BUNDLE_PATHS = [
    '/static/',
    '/assets/',
    '/build/',
    '/dist/',
    '/vendor/',
    '/js/',
    '/scripts/',
    '/public/'
];

// a[href] 查询参数中常见"真实扩展 URL"的参数名
const JS_QUERY_KEYS = ['extension', 'ext', 'url', 'src', 'js', 'file'];

// 卡片容器：优先取明确的扩展卡片类名，再退化为常见容器
const CARD_SELECTORS = [
    '.extension',
    '.ext-card',
    '.extensions .card',
    '[class*="extension-card"]',
    '[class*="extension "]',
    '[class*=" ext-"]',
    'article',
    '.card'
];

const defaultIcon = 'https://extensions.bilup.org/images/unknown.svg';

// 资源发现时最多抓取多少个脚本/元数据资源
const MAX_RESOURCE_FETCH = 20;

// 用于探测 URL 模式时，最多对多少个扩展发起探测请求
const MAX_PATTERN_PROBE = 3;

/**
 * 判断字符串是否看起来像 JSON（对象或数组）。
 * @param {string} text 待判断文本
 * @returns {boolean} 是否像 JSON
 */
const looksLikeJSON = text => {
    const trimmed = text.trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[');
};

/**
 * 校验解析出的数据是否为可用的扩展列表。
 * @param {*} data 解析结果
 * @returns {boolean} 是否为合法扩展列表
 */
const isGalleryData = data => {
    if (!data || typeof data !== 'object') {
        return false;
    }
    const extensions = Array.isArray(data) ? data : data.extensions;
    return Array.isArray(extensions) && extensions.length > 0;
};

/**
 * 提取 JSON 扩展列表，或返回 null。
 * @param {*} data 解析后的数据
 * @returns {Array|null} 扩展数组或 null
 */
const getExtensionsFromData = data => {
    if (isGalleryData(data)) {
        return Array.isArray(data) ? data : data.extensions;
    }
    return null;
};

/**
 * 把扩展名（如 shangcloud、easy-block、myExtension）转成可读名称。
 * @param {string} filename 不含 .js 后缀的文件名
 * @returns {string} 可读名称
 */
const readableName = filename => {
    const words = String(filename)
        .replace(/\.js$/i, '')
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map(word => word.replace(/([a-z0-9])([A-Z])/g, '$1 $2'))
        .map(word => word.charAt(0).toUpperCase() + word.slice(1));
    return words.join(' ');
};

/**
 * 将相对/绝对路径解析为绝对 URL，解析失败返回 null。
 * @param {string} value 原始值
 * @param {string} baseURL 基础 URL
 * @returns {string|null} 绝对 URL 或 null
 */
const resolveURL = (value, baseURL) => {
    if (!value) {
        return null;
    }
    try {
        return new URL(value, baseURL).href;
    } catch (e) {
        return null;
    }
};

/**
 * 从一个 URL 字符串中提取 .js 扩展地址。
 * 支持三种形态：
 *   - 本身以 .js 结尾（含 pathname）
 *   - 查询参数（如 ?extension=...）的值为 .js 地址
 * @param {string} href 原始链接
 * @param {string} baseURL 基础 URL
 * @returns {string|null} 扩展 .js 绝对 URL 或 null
 */
const extractJSURL = (href, baseURL) => {
    if (!href) {
        return null;
    }
    const trimmed = href.trim();
    if (!trimmed) {
        return null;
    }
    try {
        const parsed = new URL(trimmed, baseURL);
        if (parsed.pathname.endsWith('.js')) {
            return parsed.href;
        }
        for (const key of JS_QUERY_KEYS) {
            const value = parsed.searchParams.get(key);
            if (value && value.trim().endsWith('.js')) {
                return resolveURL(value, baseURL);
            }
        }
    } catch (e) {
        // 不是合法 URL，忽略
    }
    return null;
};

/**
 * 判断 <script src> 是否指向页面自身的构建产物。
 * @param {string} url 脚本绝对 URL
 * @returns {boolean} 是否为 bundle 脚本
 */
const isBundleScript = url => {
    try {
        const pathname = new URL(url).pathname.toLowerCase();
        if (BUNDLE_PATHS.some(path => pathname.startsWith(path))) {
            return true;
        }
        const base = pathname.split('/').pop();
        return /^(main|app|index|bundle|vendor|runtime|chunk)/i.test(base);
    } catch (e) {
        return false;
    }
};

/**
 * 从卡片元素中提取名称、描述与图标，增强扩展项元数据。
 * @param {Element} card 卡片容器元素
 * @param {string} baseURL 基础 URL
 * @returns {{name: string|null, description: string|null, iconURL: string|null}}
 */
const extractCardInfo = (card, baseURL) => {
    let name = null;
    let description = null;
    let iconURL = null;

    const titleEl = card.querySelector('h1, h2, h3, [class*="title"], [class*="name"]');
    if (titleEl) {
        name = titleEl.textContent.replace(/\s+/g, ' ').trim() || null;
    }

    const descEl = card.querySelector('p, [class*="desc"]');
    if (descEl) {
        description = descEl.textContent.replace(/\s+/g, ' ').trim() || null;
    }

    const imgEl = card.querySelector('img');
    if (imgEl) {
        iconURL = resolveURL(imgEl.getAttribute('src'), baseURL);
    }

    return {name, description, iconURL};
};

/**
 * 从 HTML 页面中提取扩展列表。
 * @param {string} html 页面文本
 * @param {string} baseURL 基础 URL
 * @returns {Array} 扩展项数组（可能为空）
 */
const extractExtensionsFromHTML = (html, baseURL) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // 1. <script type="application/json"> 内嵌的扩展元数据优先
    const jsonScripts = doc.querySelectorAll('script[type="application/json"]');
    for (const script of jsonScripts) {
        try {
            const data = JSON.parse(script.textContent);
            const extensions = getExtensionsFromData(data);
            if (extensions) {
                return extensions;
            }
        } catch (e) {
            // 单个脚本解析失败不影响后续提取
        }
    }

    // 2. 收集页面中所有指向 .js 扩展的链接
    // 用 Map 去重：URL -> 来源元素
    const jsCandidates = new Map();
    const addCandidate = (url, element) => {
        if (!url) {
            return;
        }
        if (!jsCandidates.has(url)) {
            jsCandidates.set(url, element);
        }
    };

    // 2.1 a[href]：data-copy 属性 / 直接 .js / 查询参数携带 .js
    for (const anchor of doc.querySelectorAll('a[href], [data-copy]')) {
        const href = anchor.getAttribute('href') || anchor.getAttribute('data-copy');
        addCandidate(extractJSURL(href, baseURL), anchor);
    }

    // 2.2 script[src]：直接指向 .js 且不是页面构建产物
    for (const script of doc.querySelectorAll('script[src]')) {
        const url = extractJSURL(script.getAttribute('src'), baseURL);
        if (url && !isBundleScript(url)) {
            addCandidate(url, script);
        }
    }

    if (jsCandidates.size === 0) {
        return [];
    }

    // 3. 尝试从卡片中补齐名称/描述/图标
    const extensions = [];
    for (const [url, element] of jsCandidates.entries()) {
        const base = url.split('/').pop().replace(/\.js$/i, '');
        const item = {
            name: readableName(base),
            slug: base,
            extensionURL: url,
            iconURL: null,
            description: null
        };
        if (element && typeof element.closest === 'function') {
            for (const selector of CARD_SELECTORS) {
                let card = null;
                try {
                    card = element.closest(selector);
                } catch (e) {
                    card = null;
                }
                if (card) {
                    const info = extractCardInfo(card, baseURL);
                    if (info.name) {
                        item.name = info.name;
                    }
                    if (info.description) {
                        item.description = info.description;
                    }
                    if (info.iconURL) {
                        item.iconURL = info.iconURL;
                    }
                    break;
                }
            }
        }
        if (!item.iconURL) {
            item.iconURL = defaultIcon;
        }
        extensions.push(item);
    }

    return extensions;
};

/**
 * 从 JavaScript 源码中提取编译进脚本的扩展元数据。
 * 适用于扩展列表直接内嵌在 JS 中的站点（如 PenguinMod 扩展站的
 * nodes/*.js 里就带有一个 name/description/code/banner 的扩展数组）。
 * @param {string} jsText JS 源码文本
 * @returns {Array} 扩展项数组（可能为空）
 */
const extractExtensionsFromJS = jsText => {
    const extensions = [];
    const seen = new Set();
    const objPattern = /\{([^{}]*?)\}/g;
    let match;
    while ((match = objPattern.exec(jsText)) !== null) {
        const body = match[1];
        const codeMatch = body.match(/(?:code|url|file|src|extensionURL)\s*:\s*"([^"]+\.js)"/);
        if (!codeMatch) {
            continue;
        }
        const code = codeMatch[1];
        if (seen.has(code)) {
            continue;
        }
        seen.add(code);

        const nameMatch = body.match(/name\s*:\s*"([^"]*)"/);
        const descMatch = body.match(/description\s*:\s*"([^"]*)"/);
        const bannerMatch = body.match(/(?:banner|image|icon|thumbnail)\s*:\s*"([^"]*)"/);

        const item = {
            name: nameMatch ? nameMatch[1] : readableName(code.split('/').pop()),
            description: descMatch ? descMatch[1] : null,
            slug: code.split('/').pop().replace(/\.js$/i, ''),
            code,
            iconURL: null
        };
        if (bannerMatch) {
            item.banner = bannerMatch[1];
        }
        extensions.push(item);
    }
    return extensions;
};

/**
 * 带超时的 fetch。
 * @param {string} url 请求地址
 * @param {Function} fetchFn fetch 实现
 * @param {number} timeoutMs 超时毫秒数
 * @returns {Promise<Response>}
 */
const fetchWithTimeout = (url, fetchFn, timeoutMs) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetchFn(url, {signal: controller.signal}).finally(() => clearTimeout(timer));
};

const isOK = async (url, fetchFn, timeoutMs) => {
    try {
        const res = await fetchWithTimeout(url, fetchFn, Math.min(timeoutMs, 5000));
        return res.ok;
    } catch (e) {
        return false;
    }
};

/**
 * 抓取一组资源并返回成功读取到的文本。
 * @param {string[]} urls 资源 URL 列表
 * @param {Function} fetchFn fetch 实现
 * @param {number} timeoutMs 超时毫秒数
 * @returns {Promise<string[]>} 成功读取的文本列表
 */
const fetchTextResources = async (urls, fetchFn, timeoutMs) => {
    const texts = await Promise.all(urls.slice(0, MAX_RESOURCE_FETCH).map(async url => {
        try {
            const res = await fetchWithTimeout(url, fetchFn, timeoutMs);
            if (!res.ok) {
                return null;
            }
            return await res.text();
        } catch (e) {
            return null;
        }
    }));
    return texts.filter(text => typeof text === 'string' && text.length > 0);
};

/**
 * 从 HTML 中收集可能包含扩展数据的脚本与元数据资源。
 * @param {string} html 页面文本
 * @param {string} baseURL 基础 URL
 * @returns {{jsURLs: string[], jsonURLs: string[]}}
 */
const collectPageResources = (html, baseURL) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const jsURLs = [];
    const jsonURLs = [];
    const seen = new Set();
    const add = (raw, list) => {
        const url = resolveURL(raw, baseURL);
        if (url && !seen.has(url)) {
            seen.add(url);
            list.push(url);
        }
    };

    for (const script of doc.querySelectorAll('script[src]')) {
        add(script.getAttribute('src'), jsURLs);
    }
    for (const link of doc.querySelectorAll('link[rel="modulepreload"]')) {
        add(link.getAttribute('href'), jsURLs);
    }
    for (const link of doc.querySelectorAll('link[rel="preload"][as="script"]')) {
        add(link.getAttribute('href'), jsURLs);
    }
    // 页面源码中直接出现的 .json 路径（如 fetch('./generated-metadata/extensions-v0.json')）
    const jsonPattern = /['"](\/?[^'"\s]*\.json)['"]/gi;
    let jsonMatch;
    while ((jsonMatch = jsonPattern.exec(html)) !== null) {
        add(jsonMatch[1], jsonURLs);
    }
    // SvelteKit 等框架把页面数据编译进 nodes/*.js，优先抓取
    jsURLs.sort((a, b) => jsPriority(a) - jsPriority(b));
    return {jsURLs, jsonURLs};
};

/**
 * 脚本资源发现时的抓取优先级。
 * @param {string} url 脚本 URL
 * @returns {number} 越小越优先
 */
const jsPriority = url => {
    const lower = url.toLowerCase();
    if (lower.includes('/nodes/')) return 0;
    if (lower.includes('/pages/')) return 1;
    if (lower.includes('site-data') || lower.endsWith('data.js')) return 2;
    return 3;
};

/**
 * 判断一个 .json 路径是否可能是扩展元数据。
 * @param {string} url JSON 地址
 * @returns {boolean} 是否可能是元数据
 */
const isLikelyMetadataURL = url => (
    /metadata|extension|gallery|generated-metadata|versions/i.test(url)
);

/**
 * 探测多个扩展确定"扩展脚本/图标"的真实路径模式，避免对每个扩展逐一请求。
 * 典型场景：站点把扩展数据编译进 JS，其中 code 只是相对路径
 * （如 "Author/Extension.js"），真实地址可能是 {base}/code 或 {base}/extensions/code。
 * @param {Array} items 待探测的扩展项
 * @param {string} baseURL 基础 URL
 * @param {Function} fetchFn fetch 实现
 * @param {number} timeoutMs 超时毫秒数
 * @returns {Promise<{urlPattern: string|null, iconPattern: string|null}>}
 */
const detectPatterns = async (items, baseURL, fetchFn, timeoutMs) => {
    let urlPattern = null;
    let iconPattern = null;
    const probeItems = items.slice(0, MAX_PATTERN_PROBE);
    for (const item of probeItems) {
        if (urlPattern && iconPattern) {
            break;
        }
        if (!urlPattern && item.code) {
            const direct = resolveURL(item.code, baseURL);
            if (direct && await isOK(direct, fetchFn, timeoutMs)) {
                urlPattern = 'direct';
            } else {
                const prefixed = resolveURL(`extensions/${item.code}`, baseURL);
                if (prefixed && await isOK(prefixed, fetchFn, timeoutMs)) {
                    urlPattern = 'extensions-prefix';
                }
            }
        }
        if (!iconPattern && item.banner) {
            const direct = resolveURL(item.banner, baseURL);
            if (direct && await isOK(direct, fetchFn, timeoutMs)) {
                iconPattern = 'direct';
            } else {
                const prefixed = resolveURL(`images/${item.banner}`, baseURL);
                if (prefixed && await isOK(prefixed, fetchFn, timeoutMs)) {
                    iconPattern = 'images-prefix';
                }
            }
        }
    }
    return {urlPattern, iconPattern};
};

/**
 * 按探测到的路径模式补全所有扩展的真实脚本与图标地址。
 * @param {Array} items 扩展项列表
 * @param {string} baseURL 基础 URL
 * @param {string|null} urlPattern 脚本路径模式
 * @param {string|null} iconPattern 图标路径模式
 */
const applyPatterns = (items, baseURL, urlPattern, iconPattern) => {
    for (const item of items) {
        if (item.code) {
            if (urlPattern === 'extensions-prefix') {
                item.extensionURL = resolveURL(`extensions/${item.code}`, baseURL);
            } else if (urlPattern === 'direct') {
                item.extensionURL = resolveURL(item.code, baseURL);
            } else {
                item.extensionURL = resolveURL(item.code, baseURL);
            }
            delete item.code;
        }
        if (item.banner) {
            if (iconPattern === 'images-prefix') {
                item.iconURL = resolveURL(`images/${item.banner}`, baseURL);
            } else {
                item.iconURL = resolveURL(item.banner, baseURL);
            }
            delete item.banner;
        }
        if (!item.iconURL) {
            item.iconURL = defaultIcon;
        }
    }
};

/**
 * 从页面引用的资源中发现扩展数据（用于扩展列表由 JS 动态渲染的 SPA）。
 * @param {string} html 页面文本
 * @param {string} baseURL 基础 URL
 * @param {Function} fetchFn fetch 实现
 * @param {number} timeoutMs 超时毫秒数
 * @returns {Promise<Array>} 扩展项数组；找不到时抛错
 */
const discoverFromPageResources = async (html, baseURL, fetchFn, timeoutMs) => {
    const {jsURLs, jsonURLs} = collectPageResources(html, baseURL);
    const metadataURLs = jsonURLs.filter(isLikelyMetadataURL);

    const [jsTexts, metadataTexts] = await Promise.all([
        fetchTextResources(jsURLs, fetchFn, timeoutMs),
        fetchTextResources(metadataURLs, fetchFn, timeoutMs)
    ]);

    const items = [];
    const seen = new Set();
    const addItem = item => {
        const key = item.extensionURL || item.code;
        if (!key || seen.has(key)) {
            return;
        }
        seen.add(key);
        items.push(item);
    };

    for (const text of metadataTexts) {
        try {
            parseCustomGallery(text, baseURL).forEach(addItem);
        } catch (e) {
            // 该 JSON 不是扩展元数据，忽略
        }
    }
    for (const text of jsTexts) {
        extractExtensionsFromJS(text).forEach(addItem);
    }

    const {urlPattern, iconPattern} = await detectPatterns(items, baseURL, fetchFn, timeoutMs);
    applyPatterns(items, baseURL, urlPattern, iconPattern);

    if (items.length === 0) {
        throw new Error('Could not find any extensions in the page or its resources.');
    }
    return items;
};

/**
 * 解析自定义扩展库响应内容（JSON 元数据或 HTML 网页）。
 * @param {string} text 响应文本
 * @param {string} baseURL 基础 URL，用于解析相对路径
 * @returns {Array} 扩展项数组；无法解析时抛错
 */
const parseCustomGallery = (text, baseURL) => {
    if (looksLikeJSON(text)) {
        try {
            const data = JSON.parse(text);
            const extensions = getExtensionsFromData(data);
            if (extensions) {
                return extensions;
            }
        } catch (e) {
            // 不是合法 JSON，继续按 HTML 处理
        }
    }

    if (!text || !/<!doctype html|<html[\s>]/i.test(text)) {
        throw new Error('The gallery does not contain valid JSON metadata or an HTML page.');
    }

    const extensions = extractExtensionsFromHTML(text, baseURL);
    if (extensions.length === 0) {
        throw new Error('Could not find any extension links in the page.');
    }
    return extensions;
};

/**
 * 加载并解析一个自定义扩展库（JSON 元数据或 HTML 网页）。
 * HTML 页面没有扩展卡片时，会自动从页面引用的脚本/元数据资源中发现扩展，
 * 因此适用于扩展列表由前端 JS 动态渲染的站点（如 PenguinMod、Mistium）。
 * @param {string} url 扩展库地址
 * @param {object} [options] 可选配置
 * @param {Function} [options.fetchFn] fetch 实现，默认 window.fetch
 * @param {number} [options.timeout] 单次请求超时毫秒数，默认 10000
 * @returns {Promise<Array>} 扩展项数组
 */
const loadCustomGallery = async (url, {fetchFn = fetch, timeout = 10000} = {}) => {
    const res = await fetchWithTimeout(url, fetchFn, timeout);
    if (!res.ok) {
        throw new Error(`HTTP status ${res.status}`);
    }
    const text = await res.text();
    const baseURL = res.url || url;

    // 明确的 JSON 元数据：同步解析，失败即报错
    if (looksLikeJSON(text)) {
        return parseCustomGallery(text, baseURL);
    }

    if (!text || !/<!doctype html|<html[\s>]/i.test(text)) {
        throw new Error('The gallery does not contain valid JSON metadata or an HTML page.');
    }

    // HTML：先尝试静态卡片提取
    try {
        return parseCustomGallery(text, baseURL);
    } catch (e) {
        // 无卡片 → 尝试从页面资源中发现扩展数据（SPA）
    }

    return discoverFromPageResources(text, baseURL, fetchFn, timeout);
};

export {
    parseCustomGallery,
    loadCustomGallery,
    extractExtensionsFromJS,
    getExtensionsFromData,
    looksLikeJSON
};
