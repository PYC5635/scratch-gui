import {getItem as getStorageItem} from './utils/safe-storage.js';

const STORAGE_KEY = 'bl:frosted-glass';

const DEFAULT_SETTINGS = {
    enabled: false,
    blurRadius: 12,
    opacity: 0.25
};

// Style tag ID 前缀
const STYLE_ID_PREFIX = 'bl-frosted-glass-';

// MutationObserver 防抖间隔 (ms) — 避免频繁 DOM 变化(如 xterm 终端渲染)导致性能问题
const OBSERVER_DEBOUNCE_MS = 200;

// 缓存上一次应用时的参数，避免重复更新 style 标签
let _lastApplied = null;

// 缓存主题 RGB 值，避免频繁调用 getComputedStyle()
let _cachedRGB = null;

// Target elements
// CSS Module 类名格式: [name]_[local]_[hash:base64:5] (webpack config 配置)
// 因此必须使用属性选择器 [class*="..."] 来匹配 CSS Module 转换后的类名
const TARGETS = [
    // 窗口 — 编辑器内部弹出的窗口背景（如设置弹窗、扩展管理器等）
    // 覆盖三类窗口形态:
    //   1. windowed-modal 浮动窗口 → .addon-window(.addon-window-header + .addon-window-content > .modal-window-content)
    //   2. react-modal (常规模态框) → [class*="modal-content"].ReactModal__Content (CSS Module)
    //   3. AddonWindow / 命令式 createWindow / 复用窗口 → 内容直接挂在 .addon-window-content 下
    {
        id: 'window',
        labelId: 'bl.frostedGlass.target.window',
        defaultMessage: 'Window',
        css: (blur, alpha, r, g, b) => {
            // 玻璃面板色 / 卡片级淡玻璃底 / 底部发丝线
            const glass = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            const cardGlass = `rgba(${r}, ${g}, ${b}, ${(alpha * 0.4).toFixed(3)})`;
            const hairline = 'inset 0 -1px 0 rgba(255, 255, 255, 0.15)';
            // 窗口内容可能挂在三类容器之下（透明化规则需覆盖全部祖先）：
            //   1. [class*="modal-content"] — React Modal / windowed-modal-content 内容容器
            //   2. .modal-window-content — WindowedModal 内容容器
            //   3. .addon-window-content — AddonWindow(React)、命令式 createWindow、
            //      以及 windowed-modal 复用已有窗口分支 (contentContainer = window.contentElement)
            const inside = '[class*="modal-content"], .modal-window-content, .addon-window-content';
            return `
/* 所有 addon 窗口系统创建的外层容器 — backdrop-filter 必须放在最外层固定定位元素上，
           才能正确模糊编辑器背景。如果放在内部子元素上，子元素与编辑器之间隔了窗口元素，
           backdrop-filter 无法正确穿透。
           使用 :not([class*="addon-window-"]) 排除子元素 (addon-window-header/btn/content 等)，
           确保只匹配到窗口容器本身。
           不限定 modal-window 类名，以覆盖所有插件窗口类型 (如 mw-alert-window 等)。 */
            [class*="addon-window"]:not([class*="addon-window-"]) {
                background-color: transparent !important;
                backdrop-filter: blur(${blur}px) saturate(150%) !important;
                -webkit-backdrop-filter: blur(${blur}px) saturate(150%) !important;
            }
            /* addon 窗口标题栏 — 也有不透明背景（window-manager.js 内联 var(--ui-primary)），
               需透明化让毛玻璃透过。
               ⚠ 特异性必须是 (0,2,0)：window-theme 的 macOS / Windows 10 样式会声明
               [.addon-window-header { background: var(--ui-secondary|--ui-tertiary) !important; }]，
               而这些主题样式由 mw-style-settings.js / 插件 userstyles 追加到 <body> 末尾
               （见 lib/mw-style-settings.js、addons/conditional-style.js，后者注释明确说明
               "放在 <body> 末尾以获得比 <head> 更高的优先级"），本模块却注入在 <head>。
               若这里用单类选择器，两者特异性同为 (0,1,0)，只能由文档顺序决定胜负 —— 主题永远赢，
               于是 macOS / Windows 10 下标题栏残留不透明底色（表现为"毛玻璃只有 MistWarp 样式生效"）。
               双属性选择器把特异性提到 (0,2,0)，使结果与样式表注入顺序无关。
               同时清掉主题额外叠加的 backdrop-filter（macOS: blur(20px)），
               让窗口模糊强度只由本模块的 blurRadius 决定，三种窗口样式观感一致。 */
            [class*="addon-window"][class*="addon-window-header"] {
                background-color: transparent !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
            }
        /* React Modal 内容容器 — 直接渲染在 overlay 上、没有 addon-window 外层，
           backdrop-filter 与半透明背景都放在它自身 */
            [class*="modal-content"].ReactModal__Content {
                background-color: ${glass} !important;
                backdrop-filter: blur(${blur}px) saturate(150%) !important;
                -webkit-backdrop-filter: blur(${blur}px) saturate(150%) !important;
                box-shadow: ${hairline} !important;
            }
        /* 半透明玻璃面板统一放在 .addon-window-content（窗口系统的公共内容区）上。
           窗口系统所有形态的内容都挂在它下面：WindowedModal、AddonWindow(React)、
           命令式 createWindow、以及 windowed-modal 复用已有窗口时内容直挂该元素。
           若放在 .modal-window-content 上，复用分支等没有该容器的窗口会残留
           var(--ui-modal-background) 纯色底。
           同上：必须是 (0,2,0)，否则会被 window-theme 的
           [.addon-window-content { background: var(--ui-modal-background) !important; }]
           （注入在 <body> 末尾、同特异性）覆盖成纯色，内容区毛玻璃同样失效。 */
        [class*="addon-window"][class*="addon-window-content"] {
            background-color: ${glass} !important;
            box-shadow: ${hairline} !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
        }
        /* WindowedModal 内容容器 — 退为透明，玻璃面板已由 .addon-window-content 承担 */
        .modal-window-content {
            background-color: transparent !important;
        }
/* 让窗口内部所有"区域级"容器透明，露出玻璃面板 */
        /* 使用基于模式的广泛选择器替代具体类名列表。内部(inside)祖先覆盖三类内容挂载点:
           - [class*="modal-content"]: React Modal / windowed-modal-content 内容容器
           - .modal-window-content: WindowedModal 内容容器
           - .addon-window-content: AddonWindow(React)/createWindow/复用分支内容区
           覆盖的布局容器:
           - [class*="body"]: 几乎所有模态框内容主体 (settings/connection/browser/telemetry/record/...)
           - [class*="header"]: 模态框标题栏；[class*="footer"]: 底部操作区
           - [class*="layout"] / [class*="sidebar"]: modal-sidebar 布局与侧边栏
           - [class*="content"]: modal-sidebar 右侧内容列 (modal-sidebar_content_*)、以及
             settings 等内容根 (settings-modal_modalContent_* 驼峰不匹配 [class*="modal-content"]，
             但命中此 [class*="content"])。addon-window-content / modal-window-content
             自身是"祖先"不会被自身后代规则命中，安全。
           - [class*="main"] / [class*="page"] / [class*="section"] / [class*="intro"]:
             媒体录制窗 (media-recorder_page/intro/section) 等整页/区块容器
           - [class*="bottom-area"]: connection-modal 底部；[class*="top-area"]: 顶部工具条
           - [class*="search-row"]: library 搜索栏
           - [class*="root"]: 插件窗口内容根元素 (help-modal, share-window) */
        ${inside} [class*="body"],
            ${inside} [class*="header"],
            ${inside} [class*="footer"],
            ${inside} [class*="layout"],
            ${inside} [class*="sidebar"],
            ${inside} [class*="content"],
            ${inside} [class*="main"],
            ${inside} [class*="page"],
            ${inside} [class*="root"],
            ${inside} [class*="bottom-area"],
            ${inside} [class*="top-area"],
            ${inside} [class*="search-row"],
            ${inside} [class*="section"],
            ${inside} [class*="intro"] {
            background-color: transparent !important;
        }
        /* 卡片级内容单元 (card/panel/tile) 不做纯色也不全透明，
           铺一层淡玻璃底维持层次感；深色下 alpha 已整体提升，淡底同样更暗保证可读 */
        ${inside} [class*="card"],
            ${inside} [class*="panel"],
            ${inside} [class*="tile"] {
            background-color: ${cardGlass} !important;
        }
        /* custom-procedures 的 .container 使用单独的 background 属性，用 background 简写覆盖 */
        ${inside} [class*="custom-procedures_container"] {
            background: transparent !important;
        }
        /* ---- 纯色 → 毛玻璃（与背景同款）第二波：功能窗口/行块/独立浮层 ----
           规则分级：
           T = 区域根/工具条：直接透明，融入 .addon-window-content 玻璃面板
           G = 内容块/卡片/行：改铺淡玻璃底 rgba(主题,α*0.4)，保持单元可辨
           S = 无 addon-window 祖先的独立浮层：需自承载 backdrop-filter */

        /* [T] 计算器窗口 — 整面实底 → 融入窗口玻璃 */
        .sa-calculator .calc-container,
        .sa-calculator .calc-display-container,
        .sa-calculator .calc-buttons {
            background: transparent !important;
            background-color: transparent !important;
        }
        /* [T] dev-inspector 窗口 — 内容根/侧栏/工具条 → 透明 */
        .dev-inspector-container,
        .dev-inspector-sidebar,
        .dev-inspector-pathbar,
        .dev-inspector-toolbar {
            background: transparent !important;
            background-color: transparent !important;
        }
        /* [T] 项目分析窗口顶部条 → 透明 */
        .sa-analyze-header {
            background: transparent !important;
            background-color: transparent !important;
        }

        /* [G] 素材库卡片 / 协作窗口用户·请求行 / Git 窗口行卡 / 登录特性卡 /
           遥测单选行块（CSS Module 前缀精确匹配，不误伤同名其它组件） */
        ${inside} [class*="library-item_library-item"],
        ${inside} [class*="collaboration-modal_userItem"],
        ${inside} [class*="collaboration-modal_requestItem"],
        ${inside} [class*="git-modal_remoteItem"],
        ${inside} [class*="git-modal_remoteRow"],
        ${inside} [class*="git-modal_conflictRow"],
        ${inside} [class*="rotur-login-modal_feature"],
        ${inside} [class*="rotur-login-modal_feature-coming"],
        ${inside} [class*="telemetry-modal_radio-buttons"] label {
            background-color: ${cardGlass} !important;
        }
        /* [G] 设置窗口里的大块行/编辑区（菜单栏编排行、主题快照、自定义主题编辑器、
           字体行、样式/对齐选择卡、分段/切换轨道）— 玻璃化而非实底 */
        ${inside} [class*="settings-modal_menu-bar-row"],
        ${inside} [class*="settings-modal_ct-snapshot"],
        ${inside} [class*="settings-modal_custom-themes-editor"],
        ${inside} [class*="settings-modal_font-row"],
        ${inside} [class*="settings-modal_style-option"],
        ${inside} [class*="settings-modal_align-option"],
        ${inside} [class*="settings-modal_ct-tabs"],
        ${inside} [class*="settings-modal_ct-mode-switch"] {
            background-color: ${cardGlass} !important;
        }
        /* [G] 项目分析窗口统计卡/图表/评分区/扩展列表（global 类） */
        .sa-analyze-section,
        .sa-analyze-stat,
        .sa-analyze-chart-container,
        .sa-analyze-score-details,
        .sa-analyze-extension-item {
            background: ${cardGlass} !important;
            background-color: ${cardGlass} !important;
        }

        /* [S] 命令面板 spotlight：无 addon-window 祖先，整层自承载玻璃 */
        .sa-mcp-container {
            background-color: ${glass} !important;
            backdrop-filter: blur(${blur}px) saturate(150%) !important;
            -webkit-backdrop-filter: blur(${blur}px) saturate(150%) !important;
        }
        .sa-mcp-preview-container,
        .sa-mcp-status-bar {
            background-color: transparent !important;
        }`;
        }
    },
    // 弹窗通知 — CSS Module 类名: alert_alert_xxxxx
    // 注意: alert.css 中 .alert.warn 使用 background 简写(#FFF0DF)，需用 background 简写+!important 强制覆盖
    {
        id: 'alert',
        labelId: 'bl.frostedGlass.target.alert',
        defaultMessage: 'Alert',
        css: (blur, alpha, r, g, b) => `
[class*="alert_alert_"] {
    background: rgba(${r}, ${g}, ${b}, ${alpha}) !important;
    background-color: rgba(${r}, ${g}, ${b}, ${alpha}) !important;
    backdrop-filter: blur(${blur}px) saturate(150%) !important;
    -webkit-backdrop-filter: blur(${blur}px) saturate(150%) !important;
    box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.15) !important;
}`
    },
    // 右下角通知弹窗 — notification-system.jsx 使用 className="mw-glass-notification" + inline style
    // inline style 的 background: var(--ui-modal-background, #ffffff) 需用 !important 覆盖
    {
        id: 'notification',
        labelId: 'bl.frostedGlass.target.notification',
        defaultMessage: 'Notification',
        css: (blur, alpha, r, g, b) => `
.mw-glass-notification {
    background: rgba(${r}, ${g}, ${b}, ${alpha}) !important;
    background-color: rgba(${r}, ${g}, ${b}, ${alpha}) !important;
    backdrop-filter: blur(${blur}px) saturate(150%) !important;
    -webkit-backdrop-filter: blur(${blur}px) saturate(150%) !important;
    box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.15) !important;
}`
    },
    // Toast 通知 — CSS Module 类名: toast_notification_toast_xxxxx
    // toast-notification.css 中 .toast.success/.error/.info/.warning 使用 background-color 设置颜色，
    // 需用 background-color + !important 强制覆盖
    {
        id: 'toast',
        labelId: 'bl.frostedGlass.target.toast',
        defaultMessage: 'Toast',
        css: (blur, alpha, r, g, b) => `
[class*="toast-notification_toast"] {
    background-color: rgba(${r}, ${g}, ${b}, ${alpha}) !important;
    backdrop-filter: blur(${blur}px) saturate(150%) !important;
    -webkit-backdrop-filter: blur(${blur}px) saturate(150%) !important;
    box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.15) !important;
}`
    },
    // 顶部菜单栏下拉菜单 — CSS Module 类名: menu-bar_menu-bar-menu_xxxxx
    // 内部 .menu 来自 menu.css，CSS Module 类名: menu_menu_xxxxx
    // 毛玻璃背景直接加在 <ul> 上，同时增强菜单项 hover 背景的可见性
    // 因为毛玻璃背景降低了 <ul> 的不透明度，原始的 .menu-item:hover
    // background-color: rgba(255,255,255,0.15) 对比度太低几乎看不见
    {
        id: 'menu-bar-menu',
        labelId: 'bl.frostedGlass.target.menuBarMenu',
        defaultMessage: 'Menu Bar Dropdown',
        css: (blur, alpha, r, g, b) => {
            // 暗色模式(r=0,0,0)下 hover 用白色，亮色模式(r=255,255,255)下 hover 用黑色
            const isDark = r === 0 && g === 0 && b === 0;
            const hoverR = isDark ? 255 : 0;
            const hoverG = isDark ? 255 : 0;
            const hoverB = isDark ? 255 : 0;
            // 使用更高的不透明度(0.25)确保 hover 效果在毛玻璃背景下可见
            const hoverA = 0.25;
            return `
[class*="menu-bar-menu"] [class*="menu_menu"] {
    background: rgba(${r}, ${g}, ${b}, ${alpha});
    background-color: rgba(${r}, ${g}, ${b}, ${alpha});
}
[class*="menu-bar-menu"] [class*="menu_menu"] [class*="menu-item"]:hover,
[class*="menu-bar-menu"] [class*="menu_menu"] [class*="menu-item"].active,
[class*="menu-bar-menu"] [class*="menu_menu"] [class*="menu-item"].expanded {
    background-color: rgba(${hoverR}, ${hoverG}, ${hoverB}, ${hoverA});
}`;
        }
    },
    // 画板浮层面板 — 三类同源浮层：
    //   1. scratch-paint 的 react-popover：颜色选择器、字体 / 模式下拉、角色方向选择器
    //      （portal 到 <body> 下，类名是全局的 .Popover / .Popover-body / .Popover-tipShape）
    //   2. Onion Skin 洋葱皮设置面板（插件 onion-skinning）→ .sa-onion-settings
    //   3. Resize 大小 / 位置面板（插件 resize-selected-item）→ .sa-resize-settings
    // 后两类都是"浮在画布上方、底部带一个小箭头"的面板，视觉语言与 popover 一致，
    // 所以合并到同一个 target 里，箭头跟着面板一起玻璃化
    // （只做面板不做箭头会出现"玻璃面板 + 实心箭头"的断层）。
    {
        id: 'popover',
        labelId: 'bl.frostedGlass.target.popover',
        defaultMessage: 'Popover / Panels',
        css: (blur, alpha, r, g, b) => {
            const glass = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            const glassBlur = `blur(${blur}px) saturate(150%)`;
            return `
/* react-popover 浮层主体。主题层 lib/themes/global-styles.css 用
   [.Popover-body { background: var(--popover-background) !important }]
   铺了不透明底色（特异性 (0,1,0)），却同时写着"some of these are duplicated over
   there too; !important makes sure these win"，所以这里必须用 body 前缀把特异性提到
   (0,1,1) 才能稳胜，光靠 !important 拼不过同特异性的后置声明。
   body 前缀同时也天然限定了作用域：react-popover 是 portal 到 <body> 下的。
   不覆盖 box-shadow，保留浮层原有的投影 —— 它贴在画布 / 检查器上时靠投影分层次。 */
body .Popover-body {
    background-color: ${glass} !important;
    backdrop-filter: ${glassBlur} !important;
    -webkit-backdrop-filter: ${glassBlur} !important;
}
/* 浮层箭头（主题层同样以 (0,1,0) + !important 设成实心底色） */
body .Popover-tipShape {
    fill: ${glass} !important;
}

/* 画板插件的设置面板 —— 两者都是 .sa-xxx-settings + .sa-xxx-settings-polygon 结构，
   实色底来自各自 style.css 的 background: var(--ui-modal-background)（无 !important，
   但仍按上面的规矩统一用 !important 覆盖，避免以后被主题层加权重后失效）。
   面板内部的行 / 输入框保持原样：resize 面板的输入框自带一层实底（表单可读性），
   onion 面板的加减按钮本来就只有描边没有底色，玻璃底能直接透出来。 */
.sa-onion-settings,
.sa-resize-settings {
    background-color: ${glass} !important;
    backdrop-filter: ${glassBlur} !important;
    -webkit-backdrop-filter: ${glassBlur} !important;
}
/* 面板下方指向按钮的小箭头 */
.sa-onion-settings-polygon,
.sa-resize-settings-polygon {
    fill: ${glass} !important;
}`;
        }
    }
];

const safeGetItem = key => {
    try {
        return getStorageItem(key);
    } catch (err) {
        return null;
    }
};

const getFrostedGlassSettings = () => {
    try {
        const stored = safeGetItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (err) {
        // ignore
    }
    return null;
};

const setFrostedGlassSettings = settings => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
        // ignore
    }
};

const targetStyleId = targetId => `${STYLE_ID_PREFIX}${targetId}`;

const applyFrostedGlassForTarget = (targetId, blurRadius, opacity, r, g, b) => {
    const target = TARGETS.find(t => t.id === targetId);
    if (!target) return;
    const css = target.css(blurRadius, opacity, r, g, b);
    const existing = document.getElementById(targetStyleId(targetId));
    if (existing) {
        // 避免无意义的更新：只有当 CSS 内容真正变化时才更新
        if (existing.textContent !== css) {
            existing.textContent = css;
        }
    } else {
        const style = document.createElement('style');
        style.id = targetStyleId(targetId);
        style.textContent = css;
        document.head.appendChild(style);
    }
};

const removeFrostedGlassForTarget = targetId => {
    const existing = document.getElementById(targetStyleId(targetId));
    if (existing) {
        existing.remove();
    }
};

/**
 * 检测当前主题是否为深色模式。
 * 读取 document 根元素上的 --color-scheme CSS 变量（由主题系统设置）。
 * @returns {boolean} 深色主题返回 true
 */
const isDarkMode = () => {
    const scheme = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-scheme')
        .trim()
        .toLowerCase();
    return scheme === 'dark';
};

/**
 * 获取当前主题下毛玻璃背景的 RGB 值。
 * 深色模式使用黑色底色，亮色模式使用白色底色。
 * 结果缓存，避免频繁调用 getComputedStyle()。
 * @returns {{r: number, g: number, b: number}} 主题底色 RGB
 */
const getThemeRGB = () => {
    if (_cachedRGB) return _cachedRGB;
    if (isDarkMode()) {
        _cachedRGB = {r: 0, g: 0, b: 0};
    } else {
        _cachedRGB = {r: 255, g: 255, b: 255};
    }
    return _cachedRGB;
};

/**
 * 清除主题 RGB 缓存，下次调用 getThemeRGB() 时会重新计算。
 * 在主题切换时调用。
 * @returns {void}
 */
const clearThemeRGBCache = () => {
    _cachedRGB = null;
};

/**
 * 检查参数是否与上次应用的一致，避免重复更新 style 标签。
 * @param {number} blurRadius 模糊半径
 * @param {number} opacity 生效后的不透明度
 * @param {number} r 主题底色红通道
 * @param {number} g 主题底色绿通道
 * @param {number} b 主题底色蓝通道
 * @returns {boolean} 与上次完全一致返回 true
 */
const isSameAsLastApplied = (blurRadius, opacity, r, g, b) => {
    if (!_lastApplied) return false;
    return _lastApplied.blurRadius === blurRadius &&
        _lastApplied.opacity === opacity &&
        _lastApplied.r === r &&
        _lastApplied.g === g &&
        _lastApplied.b === b;
};

const applyFrostedGlass = settings => {
    if (!settings) {
        settings = DEFAULT_SETTINGS;
    }

    if (!settings.enabled) {
        // Remove all frosted glass styles
        for (const target of TARGETS) {
            removeFrostedGlassForTarget(target.id);
        }
        _lastApplied = null;
        return;
    }

    const blurRadius = settings.blurRadius || DEFAULT_SETTINGS.blurRadius;
    const opacity = settings.opacity || DEFAULT_SETTINGS.opacity;
    const {r, g, b} = getThemeRGB();

    // 深色模式暗度增强：深色下白字需要更不透明的深色玻璃底才清晰。
    // getThemeRGB() 只可能返回纯黑(0,0,0)或纯白(255,255,255)，
    // 在用户透明度基础上加 0.30（上限 0.72），浅色模式维持用户设定不变。
    const isDark = r === 0 && g === 0 && b === 0;
    const effectiveOpacity = isDark ? Math.min(0.72, opacity + 0.30) : opacity;

    // 如果参数没变，跳过更新以避免不必要的 style 重计算
    if (isSameAsLastApplied(blurRadius, effectiveOpacity, r, g, b)) {
        return;
    }

    // Apply to all targets
    for (const target of TARGETS) {
        applyFrostedGlassForTarget(target.id, blurRadius, effectiveOpacity, r, g, b);
    }

    _lastApplied = {blurRadius, opacity: effectiveOpacity, r, g, b};
};

// 防抖 MutationObserver：DOM 变化频繁时（如 xterm 终端渲染），
// 只在变化停止后的一次性执行，避免性能问题
let _observerTimer = null;

const initFrostedGlass = () => {
    const settings = getFrostedGlassSettings();
    applyFrostedGlass(settings);

    // 监听主题切换以清除 RGB 缓存
    // themePersistance.js 的 applyTheme 会触发 DOM 属性变化，
    // 我们可以监听 document.documentElement 的 attribute 变化
    const themeObserver = new MutationObserver(() => {
        clearThemeRGBCache();
        // 重新应用毛玻璃以使用新的主题颜色
        const currentSettings = getFrostedGlassSettings();
        if (currentSettings && currentSettings.enabled) {
            applyFrostedGlass(currentSettings);
        }
    });
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['style']
    });

    // 防抖的 MutationObserver：检测动态 DOM 变化（如弹窗打开/关闭）
    // 使用防抖避免在频繁 DOM 变化（如 xterm 终端渲染）时反复更新 style
    const domObserver = new MutationObserver(() => {
        if (_observerTimer) {
            clearTimeout(_observerTimer);
        }
        _observerTimer = setTimeout(() => {
            _observerTimer = null;
            const currentSettings = getFrostedGlassSettings();
            if (currentSettings && currentSettings.enabled) {
                applyFrostedGlass(currentSettings);
            }
        }, OBSERVER_DEBOUNCE_MS);
    });

    domObserver.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: false
    });
};

export {
    TARGETS,
    DEFAULT_SETTINGS,
    getFrostedGlassSettings,
    setFrostedGlassSettings,
    applyFrostedGlass,
    initFrostedGlass
};
