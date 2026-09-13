import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import VM from 'scratch-vm';
import { defineMessages, injectIntl, intlShape } from 'react-intl';
import log from '../lib/utils/log';

import extensionLibraryContent, {
    galleryError,
    galleryLoading,
    galleryMore
} from '../lib/libraries/extensions/index.jsx';
import {loadCustomGallery} from '../lib/custom-gallery-parser';
import extensionTags from '../lib/libraries/tw-extension-tags';
import {getVanillaPalette} from '../lib/mw-vanilla-palette';
import {manuallyTrustExtension, markExtensionAsCustom} from './tw-security-manager.jsx';

import LibraryComponent from '../components/tw-extension-library/extension-library.jsx';
import extensionIcon from '../components/action-menu/icon--sprite.svg';

const messages = defineMessages({
    extensionTitle: {
        defaultMessage: 'Choose an Extension',
        description: 'Heading for the extension library',
        id: 'gui.extensionLibrary.chooseAnExtension'
    },
    customGalleryPrompt: {
        defaultMessage: 'Enter custom extension gallery URL:',
        description: 'Prompt for entering custom extension gallery URL',
        id: 'tw.customExtensionGallery.prompt'
    }
});

const toLibraryItem = extension => {
    if (typeof extension === 'object') {
        return ({
            rawURL: extension.iconURL || extensionIcon,
            ...extension
        });
    }
    return extension;
};

const translateGalleryItem = (extension, locale) => ({
    ...extension,
    name: extension.nameTranslations[locale] || extension.name,
    description: extension.descriptionTranslations[locale] || extension.description
});

let cachedGallery = null;
let cachedSourceStatuses = {};
let cachedCustomSources = []; // [{id, name, url}]
let galleryUpdateListeners = [];
let customSourceCounter = 0;

const addGalleryUpdateListener = listener => {
    galleryUpdateListeners.push(listener);
    return () => {
        const index = galleryUpdateListeners.indexOf(listener);
        if (index > -1) {
            galleryUpdateListeners.splice(index, 1);
        }
    };
};

// 广播快照给所有已挂载的扩展库弹窗；每次生成新引用，
// 确保 PureComponent 的浅比较能识别到变化并重新渲染
const notifyListeners = () => {
    const snapshot = {
        gallery: cachedGallery ? [...cachedGallery] : cachedGallery,
        sourceStatuses: {...cachedSourceStatuses},
        customSources: [...cachedCustomSources]
    };
    galleryUpdateListeners.forEach(listener => listener(snapshot));
};

const updateGallery = newGallery => {
    cachedGallery = newGallery;
    notifyListeners();
};

// 安全地解析相对/绝对 URL，解析失败时原样返回
const safeResolveURL = (value, base) => {
    if (!value) {
        return null;
    }
    try {
        return new URL(value, base).href;
    } catch (error) {
        return value;
    }
};

// 把自定义库返回的元数据规范化为扩展库内部格式
// 兼容 {extensions: [...]} 与数组两种形态；图标/JS/文档相对路径按库 URL 解析
// 字段缺失时做降级，保证扩展一定能被 isExtension 保留并正常展示
const normalizeCustomExtension = (extension, source, index) => {
    const baseURL = new URL(source.url);
    const js = extension.extensionURL || extension.extensionUrl || extension.js || extension.url;
    const image = extension.iconURL || extension.icon || extension.image || extension.banner;
    const id = extension.id || extension.slug || extension.name || `extension-${index + 1}`;
    return {
        name: extension.name || extension.id || extension.slug || `Extension ${index + 1}`,
        nameTranslations: extension.nameTranslations || {},
        description: extension.description || extension.desc || '',
        descriptionTranslations: extension.descriptionTranslations || {},
        extensionId: id,
        extensionURL: safeResolveURL(js, baseURL) ||
            safeResolveURL(extension.slug ? `${extension.slug}.js` : null, baseURL),
        iconURL: image ? safeResolveURL(image, baseURL) : 'https://extensions.bilup.org/images/unknown.svg',
        tags: [source.id],
        source: source.id,
        credits: extension.credits || [],
        docsURI: extension.docs ? safeResolveURL(extension.docs, baseURL) : null,
        incompatibleWithScratch: true,
        featured: true
    };
};

// 独立加载一个自定义扩展库：解析元数据 → 合并进 gallery → 更新状态灯。
// 不依赖整体 fetchLibrary 重拉，因此不受内置源网络时序影响，能立即显示扩展。
const fetchCustomSource = async id => {
    const source = cachedCustomSources.find(cs => cs.id === id);
    if (!source) {
        return;
    }
    try {
        const rawExtensions = await loadCustomGallery(source.url);
        const extensions = rawExtensions.map((extension, index) =>
            normalizeCustomExtension(extension, source, index));
        // 该库开启"非沙盒运行"时，手动信任其扩展 URL，使其绕过沙盒
        // （官方域名扩展无论是否开启都会自动非沙盒，由 isTrustedExtensionUrl 处理）
        if (source.unsandboxed) {
            extensions.forEach(extension => {
                if (extension.extensionURL) {
                    manuallyTrustExtension(extension.extensionURL);
                }
            });
        }
        // 先移除该源旧扩展，再加入新扩展，避免重复
        cachedGallery = [...(cachedGallery || []).filter(item => item.source !== id), ...extensions];
        cachedSourceStatuses[id] = 'loaded';
    } catch (error) {
        console.warn(`Failed to load custom gallery "${source.name}":`, error);
        cachedSourceStatuses[id] = 'error';
    }
    notifyListeners();
};

// 注册一个自定义扩展库；相同 URL 复用已有 id，避免重复添加
// 1) 立即广播快照（新引用），侧边栏标签马上出现（黄灯 loading）
// 2) 独立加载该库，完成后广播（绿灯 + 扩展卡片 / 红灯 + 失败提示）
const addCustomSource = source => {
    const existing = cachedCustomSources.find(cs => cs.url === source.url);
    const id = existing ? existing.id : `custom_${++customSourceCounter}`;
    if (existing) {
        existing.name = source.name;
        existing.unsandboxed = source.unsandboxed === true;
    } else {
        cachedCustomSources.push({
            id,
            name: source.name,
            url: source.url,
            unsandboxed: source.unsandboxed === true
        });
    }
    cachedSourceStatuses[id] = 'loading';
    notifyListeners();
    fetchCustomSource(id).catch(error => log.error(error));
    return id;
};

// 删除一个自定义扩展库：移除注册、清掉状态与对应扩展，
// 立即广播（标签消失），再重拉一次所有源收尾
const removeCustomSource = id => {
    const index = cachedCustomSources.findIndex(cs => cs.id === id);
    if (index === -1) {
        return;
    }
    cachedCustomSources.splice(index, 1);
    delete cachedSourceStatuses[id];
    if (cachedGallery) {
        cachedGallery = cachedGallery.filter(item => item.source !== id);
    }
    notifyListeners();
    fetchLibrary().catch(error => log.error(error));
};

/**
 * Fetch with timeout to prevent hanging requests from blocking all extension sources
 */
const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return response;
    } finally {
        clearTimeout(timer);
    }
};

// 拉取并解析某个源的元数据：HTTP 非 200、网络错误或超时都会抛错，
// 由 fetchAndAdd 统一进入"云端失败 → 本地缓存回退"流程。
const fetchMetadataJSON = async url => {
    const res = await fetchWithTimeout(url, {}, 10000);
    if (!res.ok) {
        throw new Error(`HTTP status ${res.status}`);
    }
    return res.json();
};

const isDesktop = () => (
    typeof window !== 'undefined' &&
    typeof window.EditorPreload !== 'undefined'
);

// 每个网络源最后一次成功拉取得到的原始元数据，持久化到 localStorage，
// 作为本地缓存：云端失败时兜底展示，离线时也能看到上次的扩展列表。
// 桌面端还会优先尝试打包进应用的本地协议缓存（dist-* 里的元数据）。
const GALLERY_CACHE_PREFIX = 'tw:extension-gallery-cache:';

const readCachedMetadata = sourceName => {
    try {
        const raw = localStorage.getItem(`${GALLERY_CACHE_PREFIX}${sourceName}`);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
};

const writeCachedMetadata = (sourceName, data) => {
    try {
        localStorage.setItem(`${GALLERY_CACHE_PREFIX}${sourceName}`, JSON.stringify(data));
    } catch (error) {
        // localStorage 不可用（隐私模式 / 配额已满）时静默忽略
    }
};

const emptyBanner = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAACXBIWXMAAAsTAAALEwEAmpwYAAADGWlDQ1BQaG90b3Nob3AgSUNDIHByb2ZpbGUAAHjaY2BgnuDo4uTKJMDAUFBUUuQe5BgZERmlwH6egY2BmYGBgYGBITG5uMAxIMCHgYGBIS8/L5UBA3y7xsDIwMDAcFnX0cXJlYE0wJpcUFTCwMBwgIGBwSgltTiZgYHhCwMDQ3p5SUEJAwNjDAMDg0hSdkEJAwNjAQMDg0h2SJAzAwNjCwMDE09JakUJAwMDg3N+QWVRZnpGiYKhpaWlgmNKflKqQnBlcUlqbrGCZ15yflFBflFiSWoKAwMD1A4GBgYGXpf8EgX3xMw8BUNTVQYqg4jIKAX08EGIIUByaVEZhMXIwMDAIMCgxeDHUMmwiuEBozRjFOM8xqdMhkwNTJeYNZgbme+y2LDMY2VmzWa9yubEtoldhX0mhwBHJycrZzMXM1cbNzf3RB4pnqW8xryH+IL5nvFXCwgJrBZ0E3wk1CisKHxYJF2UV3SrWJw4p/hWiRRJYcmjUhXSutJPZObIhsoJyp2V71HwUeRVvKA0RTlKRUnltepWtUZ1Pw1Zjbea+7QmaqfqWOsK6b7SO6I/36DGMMrI0ljS+LfJPdPDZivM+y0qLBOtfKwtbFRtRexY7L7aP3e47XjB6ZjzXpetruvdVrov9VjkudBrgfdCn8W+y/xW+a8P2Bq4N+hY8PmQW6HPwr5EMEUKRilFG8e4xUbF5cW3JMxO3Jx0Nvl5KlOaXLpNRlRmVdas7D059/KY8tULfAqLi2YXHy55WyZR7lJRWDmv6mz131q9uvj6SQ3HGn83G7Skt85ru94h2Ond1d59uJehz76/bsK+if8nO05pnXpiOu+M4JmzZj2aozW3ZN6+BVwLwxYtXvxxqcOyCcsfrjRe1br65lrddU3rb2402NSx+cFWq21Tt3/Y6btr1R6Oven7jh9QP9h56PURv6Obj4ufqD355LT3mS3nZM+3X/h0Ke7yqasW15bdEL3ZeuvrnfS7N+/7PDjwyPTx6qeKz2a+EHzZ9Zr5Td3bn+9LP3z6VPD53de8b+9+5P/88Lv4z7d/Vf//AwAqvx2K829RWwAAACBjSFJNAAB6JQAAgIMAAPn/AACA6QAAdTAAAOpgAAA6mAAAF2+SX8VGAAAAEUlEQVR42mL4zwAAAAD//wMAAgEBAJlUum0AAAAASUVORK5CYII=";

// 各网络源的加载配置：cloudURL 是云端元数据地址；
// localURL 是桌面端打包的本地协议地址（协议层云端优先、失败自动回退
// 本地缓存，见 desktop 仓库的 protocols.js），仅桌面端存在，供云端
// 失败时兜底使用。
const SOURCES = [
    {
        name: 'tw',
        cloudURL: 'https://extensions.turbowarp.org/generated-metadata/extensions-v0.json',
        localURL: 'tw-extensions://./generated-metadata/extensions-v0.json',
        map: data => data.extensions.map(extension => ({
            name: extension.name,
            nameTranslations: extension.nameTranslations || {},
            description: extension.description,
            descriptionTranslations: extension.descriptionTranslations || {},
            extensionId: extension.id,
            extensionURL: `https://extensions.turbowarp.org/${extension.slug}.js`,
            iconURL: `https://extensions.turbowarp.org/${extension.image || 'images/unknown.svg'}`,
            source: 'tw',
            tags: ['tw'],
            credits: [
                ...(extension.by || []),
                ...(extension.original || [])
            ].map(credit => {
                if (credit.link) {
                    return (
                        <a
                            href={credit.link}
                            target="_blank"
                            rel="noreferrer"
                            key={credit.name}
                        >
                            {credit.name}
                        </a>
                    );
                }
                return credit.name;
            }),
            docsURI: extension.docs ? `https://extensions.turbowarp.org/${extension.slug}` : null,
            samples: extension.samples ? extension.samples.map(sample => ({
                href: `${process.env.ROOT}editor?project_url=https://extensions.turbowarp.org/samples/${encodeURIComponent(sample)}.sb3`,
                text: sample
            })) : null,
            incompatibleWithScratch: true,
            featured: true
        }))
    },
    {
        name: 'mistium',
        cloudURL: 'https://extensions.mistium.com/generated-metadata/extensions-v0.json',
        localURL: 'mw-extensions://./generated-metadata/extensions-v0.json',
        map: data => data.extensions
            .filter(ext => ext.featured)
            .map(extension => ({
                name: extension.name,
                nameTranslations: extension.nameTranslations || {},
                description: extension.description,
                descriptionTranslations: extension.descriptionTranslations || {},
                extensionId: extension.id,
                extensionURL: `https://extensions.mistium.com/featured/${extension.name}.js`,
                iconURL: extension.image ? `https://extensions.mistium.com/${extension.image}` : emptyBanner,
                source: 'mistium',
                tags: ['mistium'],
                credits: [
                    ...(extension.by || []),
                    ...(extension.original || [])
                ].map(credit => {
                    if (credit.link) {
                        return (
                            <a
                                href={credit.link}
                                target="_blank"
                                rel="noreferrer"
                                key={credit.name}
                            >
                                {credit.name}
                            </a>
                        );
                    }
                    return credit.name;
                }),
                docsURI: null,
                samples: extension.samples ? extension.samples.map(sample => ({
                    href: `${process.env.ROOT}editor?project_url=https://extensions-mistium.pages.dev/samples/${encodeURIComponent(sample)}.sb3`,
                    text: sample
                })) : null,
                incompatibleWithScratch: true,
                featured: true
            }))
    },
    {
        name: 'sharkpool',
        cloudURL: 'https://sharkpools-extensions.vercel.app/Gallery%20Files/Extension-Keys.json',
        localURL: 'sp-extensions://./Gallery%20Files/Extension-Keys.json',
        map: data => {
            const rawExtensions = data.extensions;
            let normalizedExtensions = [];

            if (Array.isArray(rawExtensions)) {
                normalizedExtensions = rawExtensions;
            } else if (rawExtensions && typeof rawExtensions === 'object') {
                normalizedExtensions = Object.entries(rawExtensions).map(
                    ([key, value]) => ({
                        id: value.id ?? key,
                        name: value.name ?? key,
                        ...value
                    })
                );
            } else {
                console.warn('[SharkPools] Invalid extensions format:', rawExtensions);
                return [];
            }

            console.log('[SharkPools] Normalized extensions:', normalizedExtensions);

            return normalizedExtensions
                .filter(ext => !ext.isDeprecated)
                .map(extension => ({
                    name: extension.name,
                    nameTranslations: extension.nameTranslations || {},
                    description: extension.description || extension.desc,
                    descriptionTranslations: extension.descriptionTranslations || {},
                    extensionId: extension.id,
                    extensionURL: `https://sharkpools-extensions.vercel.app/extension-code/${extension.url}`,
                    iconURL: extension.banner ? `https://sharkpools-extensions.vercel.app/extension-thumbs/${extension.banner}` : emptyBanner,
                    source: 'sharkpool',
                    tags: ['sharkpool'],
                    credits: [
                        ...(extension.by || []),
                        ...(extension.original || (extension.creator ? [{ name: extension.creator }] : []))
                    ].map(credit => {
                        if (credit.link) {
                            return (
                                <a
                                    href={credit.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    key={credit.name}
                                >
                                    {credit.name}
                                </a>
                            );
                        }
                        return credit.name;
                    }),
                    docsURI: null,
                    samples: null,
                    incompatibleWithScratch: true,
                    featured: true
                }));
        }
    },
    {
        name: 'bilup',
        cloudURL: 'https://extensions.bilup.org/generated-metadata/extensions-v0.json',
        localURL: 'bl-extensions://./generated-metadata/extensions-v0.json',
        map: data => data.extensions.map(extension => ({
            name: extension.name,
            nameTranslations: extension.nameTranslations || {},
            description: extension.description,
            descriptionTranslations: extension.descriptionTranslations || {},
            extensionId: extension.id,
            extensionURL: `https://extensions.bilup.org/${extension.slug}.js`,
            iconURL: `https://extensions.bilup.org/${extension.image || 'images/unknown.svg'}`,
            source: 'bilup',
            tags: ['bilup'],
            credits: [
                ...(extension.by || []),
                ...(extension.original || [])
            ].map(credit => {
                if (credit.link) {
                    return (
                        <a
                            href={credit.link}
                            target="_blank"
                            rel="noreferrer"
                            key={credit.name}
                        >
                            {credit.name}
                        </a>
                    );
                }
                return credit.name;
            }),
            docsURI: extension.docs ? `https://extensions.bilup.org/${extension.slug}` : null,
            samples: extension.samples ? extension.samples.map(sample => ({
                href: `${process.env.ROOT}editor?project_url=https://extensions.bilup.org/samples/${encodeURIComponent(sample)}.sb3`,
                text: sample
            })) : null,
            incompatibleWithScratch: true,
            featured: true
        }))
    },
    {
        name: 'ae',
        cloudURL: 'https://editors.astras.top/extensions/generated-metadata/extensions-v0.json',
        localURL: 'ae-extensions://./generated-metadata/extensions-v0.json',
        map: data => data.extensions
            .filter(extension => extension.id !== 'shangcloud')
            .map(extension => ({
                name: extension.name,
                nameTranslations: extension.nameTranslations || {},
                description: extension.description,
                descriptionTranslations: extension.descriptionTranslations || {},
                extensionId: extension.id,
                extensionURL: `https://editors.astras.top/extensions/${extension.slug}.js`,
                iconURL: `https://editors.astras.top/extensions/${extension.image || 'images/unknown.svg'}`,
                source: 'ae',
                tags: ['ae'],
                credits: [
                    ...(extension.by || []),
                    ...(extension.original || [])
                ].map(credit => {
                    if (credit.link) {
                        return (
                            <a
                                href={credit.link}
                                target="_blank"
                                rel="noreferrer"
                                key={credit.name}
                            >
                                {credit.name}
                            </a>
                        );
                    }
                    return credit.name;
                }),
                docsURI: extension.docs ? `https://editors.astras.top/extensions/${extension.slug}` : null,
                samples: extension.samples ? extension.samples.map(sample => ({
                    href: `${process.env.ROOT}editor?project_url=https://editors.astras.top/extensions/s/${encodeURIComponent(sample)}.sb3`,
                    text: sample
                })) : null,
                incompatibleWithScratch: true,
                featured: true
            }))
    }
];

const fetchLibrary = async () => {
    const allExtensions = [];
    const sourceStatuses = {};

    const report = () => {
        // 只管理网络源；自定义库由 fetchCustomSource 独立加载，
        // 这里保留已加载的自定义扩展，避免整体重拉覆盖/清空它们
        const customExtensions = (cachedGallery || [])
            .filter(item => item.source && item.source.indexOf('custom_') === 0);
        cachedGallery = [...allExtensions, ...customExtensions];
        cachedSourceStatuses = {...cachedSourceStatuses, ...sourceStatuses};
        notifyListeners();
    };

    const loadLocalFallback = async source => {
        if (isDesktop() && source.localURL) {
            try {
                const data = await fetchMetadataJSON(source.localURL);
                const extensions = source.map(data);
                if (extensions.length) {
                    writeCachedMetadata(source.name, data);
                    return extensions;
                }
            } catch (error) {
                console.warn(`Failed to load ${source.name} from local cache:`, error);
            }
        }
        const cachedData = readCachedMetadata(source.name);
        if (cachedData) {
            try {
                const extensions = source.map(cachedData);
                if (extensions.length) {
                    return extensions;
                }
            } catch (error) {
                console.warn(`Failed to parse cached ${source.name} metadata:`, error);
            }
        }
        return null;
    };

    const fetchAndAdd = async source => {
        sourceStatuses[source.name] = 'loading';
        report();
        try {
            const data = await fetchMetadataJSON(source.cloudURL);
            const extensions = source.map(data);
            writeCachedMetadata(source.name, data);
            allExtensions.push(...extensions);
            sourceStatuses[source.name] = 'loaded';
        } catch (error) {
            console.warn(`Failed to load ${source.name} extensions:`, error);
            // 云端加载失败 → 回退本地缓存：
            // 1) 桌面端先走本地协议（应用打包了各扩展库的元数据，协议层
            //    云端优先、失败自动读本地缓存，见 desktop 的 protocols.js）
            // 2) 其次是上次成功拉取留下的 localStorage 缓存
            const fallback = await loadLocalFallback(source);
            if (fallback && fallback.length) {
                allExtensions.push(...fallback);
                sourceStatuses[source.name] = 'loaded';
            } else {
                sourceStatuses[source.name] = 'error';
            }
        }
        report();
    };

    // 并行加载所有扩展源，但每个源加载完成后立即更新
    await Promise.all(SOURCES.map(fetchAndAdd));

    return allExtensions;
};

class ExtensionLibrary extends React.PureComponent {
    constructor(props) {
        super(props);
        bindAll(this, [
            'handleItemSelect',
            'getSourceStatus'
        ]);
        this.state = {
            gallery: cachedGallery,
            galleryError: null,
            galleryTimedOut: false,
            sourceStatuses: cachedSourceStatuses,
            customSources: cachedCustomSources
        };
    }
    
    componentDidMount() {
        // 接收模块级快照广播：添加自定义库 / fetchLibrary 进度都会触发
        this.unsubscribeGalleryUpdate = addGalleryUpdateListener(payload => {
            this.setState({
                gallery: payload.gallery,
                sourceStatuses: payload.sourceStatuses,
                customSources: payload.customSources
            });
        });
        
        // Keep the "loaded" indicator in sync while this modal is open:
        // loading or removing an extension changes isExtensionLoaded() results,
        // so re-render whenever the VM emits a relevant event. This component is
        // a PureComponent, so a no-op setState would be skipped by its shallow
        // shouldComponentUpdate; forceUpdate bypasses that check.
        this.handleExtensionChange = () => this.forceUpdate();
        const vm = this.props.vm;
        if (vm && typeof vm.on === 'function') {
            vm.on('EXTENSION_ADDED', this.handleExtensionChange);
            vm.on('EXTENSION_REMOVED', this.handleExtensionChange);
        }
        
        // 首次打开时拉取网络源；已注册的自定义库独立加载（互不阻塞）
        if (!this.state.gallery) {
            const timeout = setTimeout(() => {
                this.setState({
                    galleryTimedOut: true
                });
            }, 750);

            fetchLibrary()
                .then(() => clearTimeout(timeout))
                .catch(error => {
                    log.error(error);
                    this.setState({
                        galleryError: error
                    });
                    clearTimeout(timeout);
                });

            cachedCustomSources.forEach(source => {
                if (!cachedSourceStatuses[source.id]) {
                    fetchCustomSource(source.id).catch(error => log.error(error));
                }
            });
        }
    }
    
    componentWillUnmount() {
        if (this.unsubscribeGalleryUpdate) {
            this.unsubscribeGalleryUpdate();
        }
        const vm = this.props.vm;
        if (vm && typeof vm.off === 'function') {
            vm.off('EXTENSION_ADDED', this.handleExtensionChange);
            vm.off('EXTENSION_REMOVED', this.handleExtensionChange);
        }
    }
    getSourceStatus(tag) {
        // 内置本地数据始终可用（桌面端本地加载成功 → 蓝色）
        if (tag === 'scratch' || tag === 'rotur') {
            return 'local';
        }
        // 无状态时返回 'idle' 作为占位
        return this.state.sourceStatuses[tag] || 'idle';
    }

    handleItemSelect(item) {
        if (item.href) {
            window.open(item.href, '_blank', 'noopener,noreferrer');
            return;
        }

        const extensionId = item.extensionId;

        if (extensionId === 'custom_extension') {
            this.props.onOpenCustomExtensionModal();
            return;
        }

        if (extensionId === 'custom_extension_gallery') {
            if (this.props.onOpenCustomGalleryModal) {
                this.props.onOpenCustomGalleryModal();
            }
            return;
        }

        if (extensionId === 'procedures_enable_return') {
            if (this.props.onEnableProcedureReturns) {
                this.props.onEnableProcedureReturns();
            }

            // Switch to blocks tab after enabling returns
            if (typeof this.props.onActivateBlocksTab === 'function') {
                this.props.onActivateBlocksTab();
            }

            // Switch to My Blocks category after enabling returns (correct ID is "more")
            if (typeof this.props.onCategorySelected === 'function') {
                this.props.onCategorySelected('more');
            }
            return;
        }

        const url = item.extensionURL ? item.extensionURL : extensionId;
        if (!item.disabled) {
            // 自定义拓展库开启"非沙盒运行"时，加载扩展前确保其 URL 被信任；
            // 项目重载会清空信任集合，这里按库设置重新信任
            const customSource = cachedCustomSources.find(cs => cs.id === item.source);
            if (customSource && url) {
                // Mark extension from custom library as custom so the security manager
                // will always show a sandbox permission modal.
                markExtensionAsCustom(url);
                if (customSource.unsandboxed) {
                    manuallyTrustExtension(url);
                }
            }
            if (this.props.vm.extensionManager.isExtensionLoaded(extensionId)) {
                if (typeof this.props.onCategorySelected === 'function') {
                    this.props.onCategorySelected(extensionId);
                }
            } else {
                this.props.vm.extensionManager.loadExtensionURL(url)
                    .then(() => {
                        // 实时刷新"已加载"对钩
                        this.forceUpdate();
                        if (typeof this.props.onCategorySelected === 'function') {
                            this.props.onCategorySelected(extensionId);
                        }
                    })
                    .catch(err => {
                        this.forceUpdate();
                        log.error(err);
                        // eslint-disable-next-line no-alert
                        alert(err);
                    });
            }
        }
    }
    render () {
        const vanilla = getVanillaPalette();
        let library = null;
        if (vanilla || this.state.gallery || this.state.galleryError || this.state.galleryTimedOut) {
            library = extensionLibraryContent
                .filter(extension => !vanilla || (extension.tags.includes('scratch') && !extension.extensionURL))
                .map(toLibraryItem);
            if (!vanilla) {
                library.push('---');
                if (this.state.gallery) {
                    library.push(toLibraryItem(galleryMore));
                    const locale = this.props.intl.locale;
                    library.push(
                        ...this.state.gallery
                            .filter(i => i.extensionId !== 'faceSensing')
                            .map(i => translateGalleryItem(i, locale))
                            .map(toLibraryItem)
                    );
                } else if (this.state.galleryError) {
                    library.push(toLibraryItem(galleryError));
                } else {
                    library.push(toLibraryItem(galleryLoading));
                }
            }
        }

        const vm = this.props.vm;
        const isLoaded = item => {
            if (!vm || !vm.extensionManager || !item || !item.extensionId) {
                return false;
            }
            return vm.extensionManager.isExtensionLoaded(item.extensionId);
        };

        // 已注册的自定义扩展库像内置源一样出现在左侧栏与分组中
        const customTags = this.state.customSources.map(source => ({
            tag: source.id,
            intlLabel: source.name
        }));
        const tags = [...extensionTags, ...customTags];
        const sources = [
            ['scratch', 'Scratch'],
            ['tw', 'TurboWarp'],
            ['mistium', 'Mistium'],
            ['rotur', 'Bilup Accounts'],
            ['sharkpool', 'SharkPool'],
            ['ae', 'AstraEditor'],
            ['bilup', 'Bilup'],
            ...this.state.customSources.map(source => [source.id, source.name])
        ];
        // 可删除（自定义）的标签 id 集合，用于侧边栏渲染删除按钮
        const removableTags = this.state.customSources.map(source => source.id);

        return (
            <LibraryComponent
                data={library}
                filterable
                persistableKey="extensionId"
                id="extensionLibrary"
                tags={tags}
                sources={sources}
                title={this.props.intl.formatMessage(messages.extensionTitle)}
                visible={this.props.visible}
                onItemSelected={this.handleItemSelect}
                onRequestClose={this.props.onRequestClose}
                isLoaded={isLoaded}
                getSourceStatus={this.getSourceStatus}
                removableTags={removableTags}
                onRemoveCustomSource={removeCustomSource}
            />
        );
    }
}

ExtensionLibrary.propTypes = {
    intl: intlShape.isRequired,
    onActivateBlocksTab: PropTypes.func,
    onCategorySelected: PropTypes.func,
    onEnableProcedureReturns: PropTypes.func,
    onOpenCustomExtensionModal: PropTypes.func,
    onOpenCustomGalleryModal: PropTypes.func,
    onRequestClose: PropTypes.func,
    visible: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired // eslint-disable-line react/no-unused-prop-types
};

export default injectIntl(ExtensionLibrary);

export {
    addCustomSource,
    removeCustomSource,
    updateGallery
};
