import classNames from 'classnames';
import {getItem as getStorageItem} from '../../lib/utils/safe-storage.js';
import omit from 'lodash.omit';
import PropTypes from 'prop-types';
import React, {useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo} from 'react';
import {defineMessages, FormattedMessage, injectIntl, intlShape} from 'react-intl';
import {connect} from 'react-redux';
import MediaQuery from 'react-responsive';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import tabStyles from 'react-tabs/style/react-tabs.css';
import VM from 'scratch-vm';

import Blocks from '../../containers/blocks.jsx';
import CostumeTab from '../../containers/costume-tab.jsx';
import SoundTab from '../../containers/sound-tab.jsx';
import ExtensionLibrary from '../../containers/extension-library.jsx';
import TargetPane from '../../containers/target-pane.jsx';
import StageWrapper from '../../containers/stage-wrapper.jsx';
import Loader from '../loader/loader.jsx';
import Box from '../box/box.jsx';
import MenuBar from '../menu-bar/menu-bar.jsx';
import CostumeLibrary from '../../containers/costume-library.jsx';
import SoundLibrary from '../../containers/sound-library.jsx';
import BackdropLibrary from '../../containers/backdrop-library.jsx';
import Watermark from '../../containers/watermark.jsx';

import Backpack from '../../containers/backpack.jsx';
import BrowserModal from '../browser-modal/browser-modal.jsx';
import TipsLibrary from '../../containers/tips-library.jsx';
import Cards from '../../containers/cards.jsx';
import Alerts from '../../containers/alerts.jsx';
import NotificationsProvider from '../../lib/notifications-provider.jsx';
import DragLayer from '../../containers/drag-layer.jsx';
import ConnectionModal from '../../containers/connection-modal.jsx';
import CollaborationContainer from '../../containers/collaboration-container.jsx';
import CollabLoader from '../collab-loader/collab-loader.jsx';
import TWSecurityManager from '../../containers/tw-security-manager.jsx';
import TWRestorePointManager from '../../containers/tw-restore-point-manager.jsx';
import TWUnknownPlatformModal from '../../containers/tw-unknown-platform-modal.jsx';
import TWInvalidProjectModal from '../../containers/tw-invalid-project-modal.jsx';
import MWExtensionManagerModal from '../../containers/mw-extension-manager-modal.jsx';
import MWHelpModal from '../../containers/mw-help-modal.jsx';
import MWProjectThemeModal from '../../containers/mw-project-theme-modal.jsx';
import RoturSession from '../../containers/rotur-session.jsx';
import RoturExtensionHost from '../../containers/rotur-extension-host.jsx';
import CustomGalleryModal from '../../containers/custom-gallery-modal.jsx';
import RoturLoginModal from '../mw-rotur-login-modal/rotur-login-modal.jsx';
import {closeRoturLoginModal} from '../../reducers/modals.js';
import SimpleDialog from '../../containers/simple-dialog.jsx';
import AddonHooks from '../../addons/hooks.js';
import NativeFindBar from '../find-bar/find-bar.jsx';
import NativeSpotlight from '../../containers/spotlight.jsx';

import {STAGE_SIZE_MODES, STAGE_DISPLAY_SIZES, FIXED_WIDTH, UNCONSTRAINED_NON_STAGE_WIDTH} from '../../lib/constants/layout-constants';
import {resolveStageSize} from '../../lib/utils/screen';
import {getFindBarApi} from '../../lib/find-bar/api';
import {setFractchModeOpener} from '../../lib/git/fractch-mode';
import {Theme} from '../../lib/themes';

import {BLOCKS_TAB_INDEX, COSTUMES_TAB_INDEX, SOUNDS_TAB_INDEX} from '../../reducers/editor-tab';
import CollaborationTabIndicator from '../../containers/collaboration-tab-indicator.jsx';
import {setStageSize} from '../../reducers/stage-size';

import {isRendererSupported, isBrowserSupported} from '../../lib/utils/tw-environment-support-prober.js';

import styles from './gui.css';

const FractchWorkspace = React.lazy(() => import('../mw-fractch-workspace/fractch-workspace.jsx'));

// The git panel imports the whole git toolchain (isomorphic-git, lightning-fs,
// jszip). Lazy load it so it does not slow down the first editor load; it is
// only mounted when the user actually opens the git panel.
const TWGitModal = React.lazy(() => import('../../containers/mw-git-modal.jsx'));

// Heavy modal / panel components that are not shown on the initial editor
// load. Lazy-loading them removes their code (and transitive dependencies)
// from the main bundle, shrinking the first-paint JavaScript payload.
const TWSettingsModal = React.lazy(() => import('../../containers/tw-settings-modal.jsx'));
const TWCustomExtensionModal = React.lazy(() => import('../../containers/tw-custom-extension-modal.jsx'));
const TWFontsModal = React.lazy(() => import('../../containers/tw-fonts-modal.jsx'));
const MWAssetsModal = React.lazy(() => import('../../containers/mw-assets-modal.jsx'));
const MWProjectMetadataModal = React.lazy(() => import('../../containers/mw-project-metadata-modal.jsx'));
const TWDebugger = React.lazy(() => import('../../containers/tw-debugger.jsx'));
const TWUsernameModal = React.lazy(() => import('../../containers/tw-username-modal.jsx'));
const TelemetryModal = React.lazy(() => import('../telemetry-modal/telemetry-modal.jsx'));

const messages = defineMessages({
    addExtension: {
        id: 'gui.gui.addExtension',
        description: 'Button to add an extension in the target pane',
        defaultMessage: 'Add Extension'
    },
    findBlocks: {
        id: 'gui.gui.findBlocks',
        description: 'Button in the block palette that opens block search',
        defaultMessage: 'Find Blocks'
    }
});

import {
    Blocks as BlocksIcon,
    PaintbrushVertical as CostumesIcon,
    Volume2 as SoundsIcon,
    PackagePlus as ExtensionIcon,
    Search
} from 'lucide-react';

const getFullscreenBackgroundColor = () => {
    const params = new URLSearchParams(location.search);
    if (params.has('fullscreen-background')) {
        return params.get('fullscreen-background');
    }
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return '#111';
    }
    return 'white';
};

const fullscreenBackgroundColor = getFullscreenBackgroundColor();

const AUTO_SMALL_STAGE_INNER_WIDTH = Math.round(FIXED_WIDTH);
const MIN_EDITOR_PANE_WIDTH = 598;
const MIN_TARGET_PANE_HEIGHT = 180;
// 面板隐藏的拖拽容差。值越大，面板在隐藏前可缩得越小。
// 移除 getStageDimensions 的 scale 下限后，舞台可安全缩到 1px，
// 面板不再需要为容纳固定尺寸舞台而保留较大宽度。
// 120px ≈ 短视口布局的最小面板宽度，也是拖拽面板的最小宽度。
const HIDE_STAGE_DRAG_SLOP = 138;
const NARROW_LAYOUT_WIDTH = 900;
const STAGE_RESIZER_WIDTH = 6;
const MIN_STAGE_PANEL_WIDTH = (FIXED_WIDTH * 0.5) + 18;

// Short viewports (e.g. phones in landscape) don't have enough vertical space
// for both the stage and the sprite selector. Below this height we switch to a
// compact layout where the sprite selector is always visible and the stage
// canvas is scaled down to fit the remaining space.
const SHORT_LAYOUT_MAX_HEIGHT = 480;
const SHORT_LAYOUT_TARGET_PANE_HEIGHT = 136;
const SHORT_LAYOUT_STAGE_MENU_HEIGHT = 44;
const MENU_BAR_HEIGHT = 48;
const SHORT_LAYOUT_MIN_STAGE_PANEL_WIDTH = 120;

const cachedStyleValues = new WeakMap();

const getCachedBorderWidth = element => {
    if (!element) return 2;
    
    const cached = cachedStyleValues.get(element);
    if (typeof cached !== 'undefined') return cached;
    
    const computedStyle = window.getComputedStyle(element);
    const borderLeft = Number.parseFloat(computedStyle.borderLeftWidth) || 0;
    const borderRight = Number.parseFloat(computedStyle.borderRightWidth) || 0;
    const total = borderLeft + borderRight;
    const result = (!Number.isFinite(total) || total < 0) ? 2 : total;
    
    cachedStyleValues.set(element, result);
    return result;
};

const GUIComponent = props => {
    const [fractchMode, setFractchMode] = useState(false);
    const [fractchExitRequested, setFractchExitRequested] = useState(false);
    const handleToggleFractchMode = useCallback(() => {
        if (props.activeTabIndex !== BLOCKS_TAB_INDEX) props.onActivateTab(BLOCKS_TAB_INDEX);
        if (fractchMode) {
            setFractchExitRequested(true);
        } else {
            setFractchMode(true);
        }
    }, [fractchMode, props.activeTabIndex, props.onActivateTab]);
    const handleExitFractchMode = useCallback(() => {
        setFractchExitRequested(false);
        setFractchMode(false);
    }, []);
    useEffect(() => {
        setFractchModeOpener(() => {
            props.onActivateTab(BLOCKS_TAB_INDEX);
            setFractchMode(true);
        });
        return () => setFractchModeOpener(null);
    }, [props.onActivateTab]);
    const handleEnableProcedureReturns = useCallback(() => {
        try {
            const workspace = AddonHooks.blocklyWorkspace;
            
            if (workspace && workspace.enableProcedureReturns) {
                workspace.enableProcedureReturns();
                
                if (workspace.refreshToolboxSelection_) {
                    workspace.refreshToolboxSelection_();
                }
            }
        } catch (error) {
            console.error('Error enabling procedure returns:', error);
        }
    }, []);

    const [windowAnimation, setWindowAnimation] = useState(() => {
        try {
            return getStorageItem('mw:window-animation') !== 'false';
        } catch (e) {
            return true;
        }
    });

    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'mw:window-animation') {
                setWindowAnimation(e.newValue !== 'false');
            }
        };
        const handleAnimationToggle = (e) => {
            setWindowAnimation(e.detail.enabled);
        };
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('mw:window-animation-change', handleAnimationToggle);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('mw:window-animation-change', handleAnimationToggle);
        };
    }, []);

    useEffect(() => {
        if (windowAnimation) {
            document.documentElement.classList.remove('no-window-animation');
        } else {
            document.documentElement.classList.add('no-window-animation');
        }
    }, [windowAnimation]);

    const [enableStageResize, setEnableStageResize] = useState(() => {
        // 优先使用props传递的值，如果没有则从localStorage读取
        if (props.enableStageResize !== undefined) {
            return props.enableStageResize;
        }
        try {
            return getStorageItem('mw:enable-stage-resize') !== 'false';
        } catch (e) {
            return true;
        }
    });

    // 当props变化时更新状态
    useEffect(() => {
        if (props.enableStageResize !== undefined) {
            setEnableStageResize(props.enableStageResize);
        }
    }, [props.enableStageResize]);

    useEffect(() => {
        const handleStorageChange = () => {
            try {
                const newValue = getStorageItem('mw:enable-stage-resize') === 'true';
                // 只有当props没有提供值时才从localStorage更新
                if (props.enableStageResize === undefined) {
                    setEnableStageResize(newValue);
                }
            } catch (e) {
                // ignore
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [props.enableStageResize]);

    const editorWrapperRef = useRef(null);
    const stageAndTargetWrapperRef = useRef(null);
    const stageResizeRafRef = useRef(null);
    const resizeAfterTransitionRafRef = useRef(null);
    const measureRafRef = useRef(null);
    const syncingModeRef = useRef(false);
    // 实时反映当前是否处于全屏/嵌入模式（供 ResizeObserver 回调读取，
    // 避免闭包中捕获过期的 props.isFullScreen）。
    const isFullScreenRef = useRef(props.isFullScreen);
    isFullScreenRef.current = props.isFullScreen;
    const prevStageSizeModeRef = useRef(null);
    const lastSyncedWidthRef = useRef(null);
    const skipNextMeasureRef = useRef(false);
    const [stagePanelWidth, setStagePanelWidth] = useState(null);
    const [stageContainerWidth, setStageContainerWidth] = useState(null);
    const [isNarrowLayout, setIsNarrowLayout] = useState(false);
    const [playerStageWidth, setPlayerStageWidth] = useState(null);
    const [stageCanvasMaxHeight, setStageCanvasMaxHeight] = useState(null);

    const isStageHidden = props.stageSizeMode === STAGE_SIZE_MODES.hidden && !props.isFullScreen;
    const preferredPanelWidthRef = useRef(null);
    const isStageHiddenRef = useRef(isStageHidden);
    isStageHiddenRef.current = isStageHidden;
    const isShortLayoutRef = useRef(false);

    const handleOpenSearch = useCallback(() => {
        const findBar = getFindBarApi();
        if (findBar) findBar.expand();
    }, []);

    const handleStagePanelResizeDoubleClick = useCallback(() => {
        preferredPanelWidthRef.current = null;
        setStagePanelWidth(null);
        setStageContainerWidth(null);
        if (isStageHiddenRef.current && typeof props.onSetStageSize === 'function') {
            props.onSetStageSize(STAGE_SIZE_MODES.full);
        }
    }, [props.onSetStageSize]);

    const getStageBorderExtraWidth = useCallback(containerEl => {
        if (!containerEl || typeof window === 'undefined') return 0;
        
        const stageEl = containerEl.querySelector('[class*="stage_stage"]');
        if (!stageEl) return 2;
        
        return getCachedBorderWidth(stageEl);
    }, []);

    const measureStageContainerWidth = useCallback(() => {
        if (!enableStageResize) return;
        // 全屏（或嵌入）模式下，stageAndTargetWrapper 的宽度是覆盖布局下
        // 的值（StageWrapper 脱离文档流后仅剩 TargetPane 撑开），用它更新
        // stageContainerWidth 会污染编辑器模式的舞台宽度:退出全屏后舞台
        // 大小将和进入全屏前不一致（可能被拉大或逐渐缩小）。
        if (isFullScreenRef.current) return;
        if (measureRafRef.current) return;
        if (skipNextMeasureRef.current) {
            skipNextMeasureRef.current = false;
            return;
        }
        
        measureRafRef.current = requestAnimationFrame(() => {
            measureRafRef.current = null;
            
            // rAF 排队等待执行时可能已经进入全屏，需要再次检查
            if (isFullScreenRef.current) return;

            const el = stageAndTargetWrapperRef.current;
            if (!el) return;

            const rect = el.getBoundingClientRect();
            if (!Number.isFinite(rect.width)) return;

            const computedStyle = window.getComputedStyle(el);
            const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
            const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0;

            // stageContainerWidth 的语义 = 面板内容区宽度 = 舞台总宽（含
            // 舞台 1px 边框）。不再扣除 borderExtra：getStageDimensions
            // 内部会再减 2（舞台边框），若这里也减，舞台会比面板内容区
            // 窄 2px，导致缩放后错位。
            const innerWidth = Math.max(
                0,
                rect.width - paddingLeft - paddingRight
            );

            setStageContainerWidth(prev => {
                if (typeof prev === 'number' && Math.abs(prev - innerWidth) < 2) {
                    return prev;
                }
                return innerWidth;
            });
        });
    }, [enableStageResize]);

    const lastResizeWidthRef = useRef(null);
    useEffect(() => {
        if (!enableStageResize) return;
        if (typeof stageContainerWidth !== 'number') return;

        const rounded = Math.round(stageContainerWidth);
        if (lastResizeWidthRef.current === rounded) return;

        lastResizeWidthRef.current = rounded;

        if (stageResizeRafRef.current) return;
        stageResizeRafRef.current = requestAnimationFrame(() => {
            stageResizeRafRef.current = null;
            window.dispatchEvent(new Event('resize'));
        });
    }, [stageContainerWidth, enableStageResize]);

    const setStageWidth = useCallback(contentWidth => {
        skipNextMeasureRef.current = true;
        if (contentWidth === null) {
            setStagePanelWidth(null);
            setStageContainerWidth(null);
            return;
        }

        const el = stageAndTargetWrapperRef.current;
        let paddingLeft = 8;
        let paddingRight = 8;
        if (el) {
            const computedStyle = window.getComputedStyle(el);
            paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
            paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0;
        }

        let outerWidth = contentWidth + 2 + paddingLeft + paddingRight;

        const editorEl = editorWrapperRef.current;
        const containerEl = editorEl ? editorEl.parentElement : null;
        const containerWidth = containerEl ?
            containerEl.getBoundingClientRect().width :
            window.innerWidth;
        const maxOuterWidth = containerWidth - MIN_EDITOR_PANE_WIDTH - 6;
        if (Number.isFinite(maxOuterWidth) && maxOuterWidth > 0) {
            outerWidth = Math.min(outerWidth, maxOuterWidth);
        }

        setStagePanelWidth(outerWidth);
        setStageContainerWidth(contentWidth + 2);
    }, []);

    useLayoutEffect(() => {
        if (props.isFullScreen) return;
        if (syncingModeRef.current) {
            syncingModeRef.current = false;
            return;
        }

        if (props.stageSizeMode === STAGE_SIZE_MODES.hidden) {
            return;
        }
        if (enableStageResize) {
            if (props.stageSizeMode === STAGE_SIZE_MODES.small) {
                setStageWidth(FIXED_WIDTH * 0.5);
            } else if (props.stageSizeMode === STAGE_SIZE_MODES.large) {
                setStageWidth(FIXED_WIDTH);
            } else if (props.stageSizeMode === STAGE_SIZE_MODES.full) {
                // 完整舞台模式：将面板宽度重置为完整舞台宽度，
                // 使舞台以其自然尺寸显示，不再被 fit-scale 缩放。
                setStageWidth(
                    (props.customStageSize && props.customStageSize.width) || FIXED_WIDTH
                );
            }
        } else {
            if (props.stageSizeMode === STAGE_SIZE_MODES.small) {
                setStageWidth(FIXED_WIDTH * 0.5);
            } else if (props.stageSizeMode === STAGE_SIZE_MODES.large) {
                setStageWidth(FIXED_WIDTH);
            } else {
                setStageWidth(null);
            }
        }
    }, [props.stageSizeMode, props.stageSizeRequestId, props.isFullScreen, setStageWidth, enableStageResize]);

    useEffect(() => {
        if (!enableStageResize) return;
        if (stageContainerWidth === lastSyncedWidthRef.current) return;
        lastSyncedWidthRef.current = stageContainerWidth;

        if (props.isFullScreen) return;
        if (props.stageSizeMode === STAGE_SIZE_MODES.hidden) return;
        if (typeof stageContainerWidth !== 'number') return;
        if (typeof props.onSetStageSize !== 'function') return;

        const smallThreshold = Math.min(
            AUTO_SMALL_STAGE_INNER_WIDTH,
            (props.customStageSize && props.customStageSize.width) || FIXED_WIDTH
        );
        const isSmall = stageContainerWidth < smallThreshold;

        if (isSmall && props.stageSizeMode !== STAGE_SIZE_MODES.small) {
            // 拖拽调整大小模式下，不要自动降级到 small 固定宽度：
            // 保持当前 stageSizeMode（通常是 full/large），让
            // getStageDimensions 的 fit-scale 按 stageContainerWidth
            // 平滑缩放舞台。否则舞台只会在 240/480 两个离散值之间
            // 跳变，出现"面板动了但舞台缩放不动"的问题。
            // 下方的 small -> full 恢复分支必须保留：拖拽把面板隐藏后
            // 再拖出来时 onMove 会把模式强制设为 small，若这里不再
            // 恢复，面板变宽后舞台会一直卡在 240。
            return;
        } else if (!isSmall && props.stageSizeMode === STAGE_SIZE_MODES.small) {
            syncingModeRef.current = true;
            props.onSetStageSize(STAGE_SIZE_MODES.full);
        }
    }, [stageContainerWidth, props.isFullScreen, props.onSetStageSize, props.stageSizeMode, props.customStageSize, enableStageResize]);

    useEffect(() => {
        if (!props.isPlayerOnly || typeof window === 'undefined') return;
        const fitPlayer = () => {
            const naturalWidth = (props.customStageSize && props.customStageSize.width) || FIXED_WIDTH;
            setPlayerStageWidth(Math.min(window.innerWidth, naturalWidth + 2));
        };
        fitPlayer();
        window.addEventListener('resize', fitPlayer);
        return () => window.removeEventListener('resize', fitPlayer);
    }, [props.isPlayerOnly, props.customStageSize]);

    const autoHiddenRef = useRef(false);
    useEffect(() => {
        const editorEl = editorWrapperRef.current;
        const containerEl = editorEl ? editorEl.parentElement : null;
        if (!containerEl || typeof ResizeObserver === 'undefined') return;

        const fit = () => {
            if (props.isFullScreen || typeof props.onSetStageSize !== 'function') return;

            const measuredWidth = containerEl.getBoundingClientRect().width;
            if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) return;

            const containerWidth = Math.min(measuredWidth, window.innerWidth);
            setIsNarrowLayout(containerWidth < NARROW_LAYOUT_WIDTH);
            const available = containerWidth - MIN_EDITOR_PANE_WIDTH - STAGE_RESIZER_WIDTH;

            // Short viewports (mobile landscape, etc.) keep the stage visible
            // with a height-capped canvas so the sprite selector always fits.
            // Note: keep in sync with the `max-height: 480px` media queries.
            const isShortLayout = window.innerHeight <= SHORT_LAYOUT_MAX_HEIGHT;
            isShortLayoutRef.current = isShortLayout;

            const updateStageCanvasMaxHeight = () => {
                if (!isShortLayout) {
                    setStageCanvasMaxHeight(null);
                    return;
                }
                const stageEl = stageAndTargetWrapperRef.current;
                const wrapperHeight = (stageEl && stageEl.getBoundingClientRect().height > 0) ?
                    stageEl.getBoundingClientRect().height :
                    (window.innerHeight - MENU_BAR_HEIGHT);
                const next = Math.max(
                    0,
                    wrapperHeight - SHORT_LAYOUT_STAGE_MENU_HEIGHT - SHORT_LAYOUT_TARGET_PANE_HEIGHT
                );
                setStageCanvasMaxHeight(prev => (
                    typeof prev === 'number' && Math.abs(prev - next) < 1 ? prev : next
                ));
            };
            updateStageCanvasMaxHeight();

            // 面板隐藏阈值与拖拽的 hideThreshold（handleStagePanelResizePointerDown）
            // 保持一致：MIN_STAGE_PANEL_WIDTH(258) - HIDE_STAGE_DRAG_SLOP(80) = 178。
            // 原来直接用 258 会导致窗口/容器稍窄（面板可用宽度 < 258）时面板
            // 直接隐藏，而不是继续缩小跟随——"舞台面板在小的时候不缩放"。
            // 舞台由 getStageDimensions 双向 fit-scale 缩放，可安全缩到更小。
            const minStagePanelWidth = isShortLayout ?
                SHORT_LAYOUT_MIN_STAGE_PANEL_WIDTH :
                MIN_STAGE_PANEL_WIDTH - HIDE_STAGE_DRAG_SLOP;

            if (available < minStagePanelWidth) {
                if (!isStageHiddenRef.current) {
                    autoHiddenRef.current = true;
                    isStageHiddenRef.current = true;
                    syncingModeRef.current = true;
                    props.onSetStageSize(STAGE_SIZE_MODES.hidden);
                }
                return;
            }

            if (isStageHiddenRef.current) {
                if (!autoHiddenRef.current) return;
                autoHiddenRef.current = false;
                isStageHiddenRef.current = false;
                props.onSetStageSize(STAGE_SIZE_MODES.small);
                return;
            }

            const stageEl = stageAndTargetWrapperRef.current;
            if (!stageEl) return;

            const outerWidth = stageEl.getBoundingClientRect().width;
            if (!Number.isFinite(outerWidth) || outerWidth <= 0) return;

            const preferred = preferredPanelWidthRef.current;
            const target = Math.min(
                typeof preferred === 'number' ? preferred : outerWidth,
                available
            );
            if (Math.abs(outerWidth - target) <= 1) return;

            const computedStyle = window.getComputedStyle(stageEl);
            const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
            const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0;

            // contentWidth = 舞台内容宽度。setStageWidth 内部会 +2（舞台边框）
            // 作为 stageContainerWidth，因此这里传 target(面板总宽) - padding
            // - 2。不再扣 borderExtra，与 measureStageContainerWidth 语义一致。
            setStageWidth(Math.max(0, target - paddingLeft - paddingRight - 2));
        };

        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(containerEl);
        window.addEventListener('resize', fit);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', fit);
        };
    }, [props.isFullScreen, props.onSetStageSize, setStageWidth]);

    useEffect(() => {
        measureStageContainerWidth();
        const el = stageAndTargetWrapperRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => {
            measureStageContainerWidth();
        });
        observer.observe(el);
        return () => {
            observer.disconnect();
            if (measureRafRef.current) {
                cancelAnimationFrame(measureRafRef.current);
                measureRafRef.current = null;
            }
        };
    }, [measureStageContainerWidth, enableStageResize]);

    // The stage panel has a CSS transition on its width/flex-basis. Blockly's
    // resize handler fires (and reads the container width) right when the
    // animation starts, so it always lays out at an intermediate width. Wait
    // for the transition to finish, then re-trigger a resize so the blocks
    // workspace settles on the final dimensions. This prevents the blocks
    // pane from being misaligned / clipped after the stage is resized.
    useEffect(() => {
        if (!enableStageResize) return;
        const el = stageAndTargetWrapperRef.current;
        if (!el) return;

        const handleTransitionEnd = e => {
            if (e.target !== el) return;
            const prop = e.propertyName;
            if (prop !== 'width' && prop !== 'flex-basis') return;
            if (resizeAfterTransitionRafRef.current) {
                cancelAnimationFrame(resizeAfterTransitionRafRef.current);
            }
            resizeAfterTransitionRafRef.current = requestAnimationFrame(() => {
                resizeAfterTransitionRafRef.current = null;
                window.dispatchEvent(new Event('resize'));
            });
        };

        el.addEventListener('transitionend', handleTransitionEnd);
        return () => {
            el.removeEventListener('transitionend', handleTransitionEnd);
            if (resizeAfterTransitionRafRef.current) {
                cancelAnimationFrame(resizeAfterTransitionRafRef.current);
                resizeAfterTransitionRafRef.current = null;
            }
        };
    }, [enableStageResize]);

    const handleStagePanelResizePointerDown = useCallback(e => {
        if (!enableStageResize) return;
        if (typeof e.button !== 'undefined' && e.button !== 0) return;
        e.preventDefault();

        const el = stageAndTargetWrapperRef.current;
        if (!el) return;

        // While dragging, disable the CSS width/flex-basis transition so
        // Blockly always lays out against the live width instead of an
        // animated intermediate value. It is restored on pointer up.
        el.style.transition = 'none';

        const editorEl = editorWrapperRef.current;
        const startRect = el.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(el);
        const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
        const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0;
        const borderExtra = getStageBorderExtraWidth(el);
        const editorRect = editorEl ? editorEl.getBoundingClientRect() : null;
        const startX = (typeof e.clientX === 'number') ? e.clientX : 0;
        const startWidth = startRect.width;
        // 语义与 measureStageContainerWidth 保持一致：
        // stageContainerWidth = 面板内容区宽度（含舞台边框），不减 borderExtra。
        const startInnerWidth = Math.max(0, startWidth - paddingLeft - paddingRight);

        setStageContainerWidth(Math.round(startInnerWidth));

        if (e.currentTarget &&
            typeof e.currentTarget.setPointerCapture === 'function' &&
            typeof e.pointerId === 'number') {
            try {
                e.currentTarget.setPointerCapture(e.pointerId);
            } catch (err) {
                // ignore
            }
        }

        // 面板"正常最小宽度"：容纳 small 舞台（240px）+ 左右 padding + 舞台边框。
        // 用于 maxWidth 的下限保护，但不再作为拖拽的 clamp 下限——
        // 否则面板在 [hideThreshold, minPanelWidth] 区间拖动时被卡住，
        // 出现"舞台缩放小于一个值的时候舞台面板不跟着缩放"。
        const minPanelWidth = Math.max(0, (FIXED_WIDTH * 0.5) + paddingLeft + paddingRight + borderExtra);
        // 拖拽到比正常最小宽度再窄 HIDE_STAGE_DRAG_SLOP 时才隐藏面板。
        // 在 [hideThreshold, maxWidth] 区间内面板全程跟随拖动，舞台由
        // getStageDimensions 的双向 fit-scale 同步缩放。
        const hideThreshold = Math.max(0, minPanelWidth - HIDE_STAGE_DRAG_SLOP);

        const containerEl = editorEl ? editorEl.parentElement : null;
        const containerRect = containerEl ? containerEl.getBoundingClientRect() : null;
        const containerWidth = (containerRect && Number.isFinite(containerRect.width)) ?
            containerRect.width :
            window.innerWidth;
        const resizerRect = (e.currentTarget && typeof e.currentTarget.getBoundingClientRect === 'function') ?
            e.currentTarget.getBoundingClientRect() : null;
        const resizerWidth = (resizerRect && Number.isFinite(resizerRect.width)) ? resizerRect.width : 6;

        const maxWidthByEditor = Math.max(minPanelWidth, containerWidth - MIN_EDITOR_PANE_WIDTH - resizerWidth);

        let stageWrapperEl = el.querySelector('[class*="stage-wrapper_stage-wrapper"]');
        if (!stageWrapperEl) {
            const candidates = Array.from(el.querySelectorAll('[class*="stage-wrapper"]'));
            stageWrapperEl = candidates.find(candidate => candidate.querySelector('[class*="stage-header"]'));
        }
        const stageCanvasEl = stageWrapperEl ? stageWrapperEl.querySelector('[class*="stage_stage"]') : null;

        const stageWrapperRect = stageWrapperEl ? stageWrapperEl.getBoundingClientRect() : null;
        const stageCanvasRect = stageCanvasEl ? stageCanvasEl.getBoundingClientRect() : null;
        const stageOverheadHeight = (stageWrapperRect && stageCanvasRect && stageCanvasRect.height > 0) ?
            Math.max(0, stageWrapperRect.height - stageCanvasRect.height) :
            88;

        const panelHeight = startRect.height > 0 ?
            startRect.height :
            ((editorRect && editorRect.height > 0) ? editorRect.height : window.innerHeight);

        const maxStageCanvasHeight = Math.max(
            0,
            panelHeight - MIN_TARGET_PANE_HEIGHT - stageOverheadHeight
        );

        const customSize = props.customStageSize;
        const widthPerHeight = (customSize && customSize.height > 0) ?
            (customSize.width / customSize.height) :
            (4 / 3);
        const maxInnerWidthByHeight = (maxStageCanvasHeight * widthPerHeight) + 2;
        const maxWidthByHeight = Math.max(
            minPanelWidth,
            maxInnerWidthByHeight + paddingLeft + paddingRight + borderExtra
        );

        const maxWidth = Math.min(maxWidthByEditor, maxWidthByHeight);

        const stageIsLeft = editorRect ? (startRect.left < editorRect.left) : false;
        const directionFactor = stageIsLeft ? 1 : -1;

        let moveRaf = null;
        const onMove = ev => {
            if (moveRaf) return;
            
            moveRaf = requestAnimationFrame(() => {
                moveRaf = null;
                
                const x = (typeof ev.clientX === 'number') ? ev.clientX : 0;
                const dx = x - startX;
                const rawWidth = startWidth + (dx * directionFactor);

                if (typeof props.onSetStageSize === 'function') {
                    if (rawWidth < hideThreshold) {
                        if (!isStageHiddenRef.current) {
                            isStageHiddenRef.current = true;
                            syncingModeRef.current = true;
                            props.onSetStageSize(STAGE_SIZE_MODES.hidden);
                        }
                        return;
                    }
                    if (isStageHiddenRef.current) {
                        isStageHiddenRef.current = false;
                        autoHiddenRef.current = false;
                        syncingModeRef.current = true;
                        props.onSetStageSize(STAGE_SIZE_MODES.small);
                    }
                }

                // clamp 下限用 hideThreshold：面板在 [hideThreshold, maxWidth]
                // 全程跟随拖动（舞台双向 fit 同步缩放），只有拖过隐藏阈值
                // 才触发隐藏。原逻辑 clamp 到 minPanelWidth，导致舞台缩到
                // 240 后面板不再跟随。
                const nextWidth = Math.min(maxWidth, Math.max(hideThreshold, rawWidth));
                // 语义与 measureStageContainerWidth 保持一致：
                // stageContainerWidth = 面板内容区宽度（含舞台边框）。
                const nextInnerWidth = Math.max(0, nextWidth - paddingLeft - paddingRight);
                preferredPanelWidthRef.current = nextWidth;

                setStagePanelWidth(nextWidth);
                setStageContainerWidth(prev => {
                    if (typeof prev === 'number' && Math.abs(prev - nextInnerWidth) < 0.5) {
                        return prev;
                    }
                    return nextInnerWidth;
                });
            });
        };

        const onUp = () => {
            if (moveRaf) {
                cancelAnimationFrame(moveRaf);
                moveRaf = null;
            }
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);

            // Restore the CSS transition and re-measure the final width.
            el.style.transition = '';
            measureStageContainerWidth();

            // Let React commit the final width, then tell Blockly to re-layout
            // against the settled dimensions.
            if (resizeAfterTransitionRafRef.current) {
                cancelAnimationFrame(resizeAfterTransitionRafRef.current);
            }
            resizeAfterTransitionRafRef.current = requestAnimationFrame(() => {
                resizeAfterTransitionRafRef.current = null;
                window.dispatchEvent(new Event('resize'));
            });
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [
        getStageBorderExtraWidth,
        measureStageContainerWidth,
        props.customStageSize,
        enableStageResize
    ]);

    const {
        ur_mom,
        accountNavOpen,
        activeTabIndex,
        alertsVisible,
        authorId,
        authorThumbnailUrl,
        authorUsername,
        basePath,
        backdropLibraryVisible,
        backpackHost,
        backpackVisible,
        blocksId,
        blocksTabVisible,
        cardsVisible,
        canChangeLanguage,
        canChangeTheme,
        canCreateNew,
        canEditTitle,
        canManageFiles,
        canRemix,
        canSave,
        canCreateCopy,
        canShare,
        canUseCloud,
        children,
        connectionModalVisible,
        costumeLibraryVisible,
        soundLibraryVisible,
        costumesTabVisible,
        customStageSize,
        enableCommunity,
        intl,
        extensionLibraryVisible,
        isCreating,
        isEmbedded,
        isFullScreen,
        isPlayerOnly,
        isRtl,
        isShared,
        isWindowFullScreen,
        isTelemetryEnabled,
        isTotallyNormal,
        loading,
        locale,
        logo,
        renderLogin,
        onClickAbout,
        onClickAccountNav,
        onCloseAccountNav,
        onClickAddonSettings,
        onClickDesktopSettings,
        onClickNewWindow,
        onClickPackager,
        onLogOut,
        onOpenExtensionLibrary,
        onOpenExtensionManagerModal,
        onOpenRegistration,
        onToggleLoginOpen,
        onActivateCostumesTab,
        onActivateSoundsTab,
        onActivateTab,
        onClickLogo,
        onExtensionButtonClick,
        onOpenCustomExtensionModal,
        onOpenCustomGalleryModal,
        onProjectTelemetryEvent,
        onRequestCloseBackdropLibrary,
        onRequestCloseCostumeLibrary,
        onRequestCloseExtensionLibrary,
        onRequestCloseSoundLibrary,
        onRequestCloseTelemetryModal,
        onSeeCommunity,
        onSetStageSize: _onSetStageSize,
        onSetFullScreen: _onSetFullScreen,
        onShare,
        onShowPrivacyPolicy,
        onStartSelectingFileUpload,
        onTelemetryModalCancel,
        onTelemetryModalOptIn,
        onTelemetryModalOptOut,
        securityManager,
        showComingSoon,
        showOpenFilePicker,
        showSaveFilePicker,
        soundsTabVisible,
        stageSizeMode,
        stageSizeRequestId,
        targetIsStage,
        telemetryModalVisible,
        theme,
        tipsLibraryVisible,
        usernameModalVisible,
        settingsModalVisible,
        customExtensionModalVisible,
        customGalleryModalVisible,
        fontsModalVisible,
        assetsModalVisible,
        projectMetadataModalVisible,
        unknownPlatformModalVisible,
        invalidProjectModalVisible,
        gitModalVisible,
        shortcutManagerModalVisible,
        roturLoginModalVisible,
        onRequestCloseRoturLogin,
        vm,
        enableStageResize: _enableStageResize, // eslint-disable-line no-unused-vars
        customShortcuts: _customShortcuts, // eslint-disable-line no-unused-vars
        ...componentProps
    } = omit(props, 'dispatch');
    if (children) {
        return <Box {...componentProps}>{children}</Box>;
    }

    useEffect(() => {
        if (onStartSelectingFileUpload || onClickPackager) {
            const {updateCallbacks: updateShortcutsCallbacks} = require('../../lib/shortcuts/event-router.js');
            const newCallbacks = {};
            if (onStartSelectingFileUpload) {
                newCallbacks.loadFromComputer = onStartSelectingFileUpload;
            }
            if (onClickPackager) {
                newCallbacks.openPackager = onClickPackager;
            }
            updateShortcutsCallbacks(newCallbacks);
        }
    }, [onStartSelectingFileUpload, onClickPackager]);

    const tabClassNames = useMemo(() => ({
        tabs: styles.tabs,
        tab: classNames(tabStyles.reactTabsTab, styles.tab),
        tabList: classNames(tabStyles.reactTabsTabList, styles.tabList),
        tabPanel: classNames(tabStyles.reactTabsTabPanel, styles.tabPanel),
        tabPanelSelected: classNames(tabStyles.reactTabsTabPanelSelected, styles.isSelected),
        tabSelected: classNames(tabStyles.reactTabsTabSelected, styles.isSelected)
    }), []);

    const unconstrainedWidth = useMemo(() => (
        UNCONSTRAINED_NON_STAGE_WIDTH +
        FIXED_WIDTH +
        Math.max(0, customStageSize.width - FIXED_WIDTH)
    ), [customStageSize.width]);

    const alwaysEnabledModals = useMemo(() => (
        <React.Fragment>
            <RoturSession />
            {!isEmbedded && <RoturExtensionHost />}
            <NotificationsProvider />
            <TWSecurityManager securityManager={securityManager} />
            <TWRestorePointManager />
            <MWExtensionManagerModal />
            <MWHelpModal />
            <MWProjectThemeModal />
            {usernameModalVisible && (
                <React.Suspense fallback={null}>
                    <TWUsernameModal visible={usernameModalVisible} />
                </React.Suspense>
            )}
            {settingsModalVisible && (
                <React.Suspense fallback={null}>
                    <TWSettingsModal
                        isRtl={isRtl}
                        visible={settingsModalVisible}
                    />
                </React.Suspense>
            )}
            {customExtensionModalVisible && (
                <React.Suspense fallback={null}>
                    <TWCustomExtensionModal />
                </React.Suspense>
            )}
            {customGalleryModalVisible && <CustomGalleryModal />}
            {fontsModalVisible && (
                <React.Suspense fallback={null}>
                    <TWFontsModal />
                </React.Suspense>
            )}
            {assetsModalVisible && (
                <React.Suspense fallback={null}>
                    <MWAssetsModal />
                </React.Suspense>
            )}
            {projectMetadataModalVisible && (
                <React.Suspense fallback={null}>
                    <MWProjectMetadataModal />
                </React.Suspense>
            )}
            {unknownPlatformModalVisible && <TWUnknownPlatformModal />}
            {invalidProjectModalVisible && <TWInvalidProjectModal />}
            <React.Suspense fallback={null}>
                {gitModalVisible && <TWGitModal />}
            </React.Suspense>
            {roturLoginModalVisible && (
                <RoturLoginModal onRequestClose={onRequestCloseRoturLogin} />
            )}
            <SimpleDialog />
        </React.Fragment>
    ), [
        securityManager,
        usernameModalVisible,
        settingsModalVisible,
        isRtl,
        customExtensionModalVisible,
        customGalleryModalVisible,
        fontsModalVisible,
        assetsModalVisible,
        projectMetadataModalVisible,
        unknownPlatformModalVisible,
        invalidProjectModalVisible,
        gitModalVisible,
        roturLoginModalVisible,
        onRequestCloseRoturLogin,
        isEmbedded
    ]);

    const minDimensions = useMemo(() => {
        if (isNarrowLayout) {
            return {
                minWidth: 0,
                minHeight: 0
            };
        }
        if (isStageHidden) {
            return {
                minWidth: MIN_EDITOR_PANE_WIDTH + 16,
                minHeight: 640 + Math.max(0, customStageSize.height - 360)
            };
        }
        return {
            minWidth: MIN_EDITOR_PANE_WIDTH + MIN_STAGE_PANEL_WIDTH + STAGE_RESIZER_WIDTH + 16,
            minHeight: 640 + Math.max(0, customStageSize.height - 360)
        };
    }, [customStageSize.height, isStageHidden, isNarrowLayout]);

    const stagePanelStyle = useMemo(() => {
        if (isStageHidden) {
            return {
                width: 'auto',
                flexBasis: 'auto',
                flexGrow: 0,
                flexShrink: 0
            };
        }
        if (!stagePanelWidth) return null;
        return {
            width: `${stagePanelWidth}px`,
            flexBasis: `${stagePanelWidth}px`,
            flexShrink: 0
        };
    }, [stagePanelWidth, isStageHidden]);

    return (<MediaQuery minWidth={unconstrainedWidth}>{isUnconstrained => {
        const stageSize = resolveStageSize(
            stageSizeMode === STAGE_SIZE_MODES.hidden ? STAGE_SIZE_MODES.small : stageSizeMode,
            isUnconstrained
        );

        // 当拖拽缩放面板时，stageSize 保持 large/full 不变（避免舞台离散跳变），
        // 但角色选择区的 SpriteInfo 需要使用简略布局来防止控件溢出。
        // 当面板内容宽度小于完整舞台宽度时，强制使用 small 布局。
        const spriteLayoutSize = enableStageResize && 
            typeof stageContainerWidth === 'number' && 
            stageContainerWidth < FIXED_WIDTH ? 
            STAGE_DISPLAY_SIZES.small : 
            stageSize;

        return (
            <React.Fragment>
                {isWindowFullScreen ? (
                    <div
                        className={styles.fullscreenBackground}
                        style={{
                            backgroundColor: fullscreenBackgroundColor
                        }}
                    />
                ) : null}
                {alwaysEnabledModals}
                {isPlayerOnly ? (
                    <React.Fragment>
                        {isWindowFullScreen ? (
                            <div
                                className={styles.fullscreenBackground}
                                style={{
                                    backgroundColor: fullscreenBackgroundColor
                                }}
                            />
                        ) : null}
                        <StageWrapper
                            isFullScreen={isFullScreen}
                            isEmbedded={isEmbedded}
                            isRendererSupported={isRendererSupported()}
                            isRtl={isRtl}
                            loading={loading}
                            stageSize={STAGE_SIZE_MODES.full}
                            vm={vm}
                        >
                            {alertsVisible ? (
                                <Alerts className={styles.alertsContainer} />
                            ) : null}
                        </StageWrapper>
                    </React.Fragment>
                ) : (
                    <Box
                        className={styles.pageWrapper}
                        dir={isRtl ? 'rtl' : 'ltr'}
                        // style={minDimensions}
                        {...componentProps}
                    >
                        <React.Suspense fallback={null}>
                            <TWDebugger />
                        </React.Suspense>
                        {telemetryModalVisible ? (
                            <React.Suspense fallback={null}>
                                <TelemetryModal
                                    isRtl={isRtl}
                                    isTelemetryEnabled={isTelemetryEnabled}
                                    onCancel={onTelemetryModalCancel}
                                    onOptIn={onTelemetryModalOptIn}
                                    onOptOut={onTelemetryModalOptOut}
                                    onRequestClose={onRequestCloseTelemetryModal}
                                    onShowPrivacyPolicy={onShowPrivacyPolicy}
                                />
                            </React.Suspense>
                        ) : null}
                {loading ? (
                    <Loader isFullScreen />
                ) : null}
                {isCreating ? (
                    <Loader
                        isFullScreen
                        messageId="gui.loader.creating"
                    />
                ) : null}
                <CollabLoader />
                {isBrowserSupported() ? null : (
                    <BrowserModal
                        isRtl={isRtl}
                        onClickDesktopSettings={onClickDesktopSettings}
                    />
                )}
                {tipsLibraryVisible ? (
                    <TipsLibrary />
                ) : null}
                {cardsVisible ? (
                    <Cards />
                ) : null}
                {alertsVisible ? (
                    <Alerts className={styles.alertsContainer} />
                ) : null}
                {connectionModalVisible ? (
                    <ConnectionModal
                        vm={vm}
                    />
                ) : null}
                <CollaborationContainer />
                {costumeLibraryVisible ? (
                    <CostumeLibrary
                        vm={vm}
                        onRequestClose={onRequestCloseCostumeLibrary}
                    />
                ) : null}
                {backdropLibraryVisible ? (
                    <BackdropLibrary
                        vm={vm}
                        onRequestClose={onRequestCloseBackdropLibrary}
                    />
                ) : null}
                {soundLibraryVisible ? (
                    <SoundLibrary
                        vm={vm}
                        onRequestClose={onRequestCloseSoundLibrary}
                    />
                ) : null}
                <MenuBar
                    accountNavOpen={accountNavOpen}
                    fractchMode={fractchMode}
                    onToggleFractchMode={handleToggleFractchMode}
                    authorId={authorId}
                    authorThumbnailUrl={authorThumbnailUrl}
                    authorUsername={authorUsername}
                    canChangeLanguage={canChangeLanguage}
                    canChangeTheme={canChangeTheme}
                    canCreateCopy={canCreateCopy}
                    canCreateNew={canCreateNew}
                    canEditTitle={canEditTitle}
                    canManageFiles={canManageFiles}
                    canRemix={canRemix}
                    canSave={canSave}
                    canShare={canShare}
                    className={styles.menuBarPosition}
                    enableCommunity={enableCommunity}
                    isShared={isShared}
                    isTotallyNormal={isTotallyNormal}
                    logo={logo}
                    renderLogin={renderLogin}
                    showComingSoon={showComingSoon}
                    showOpenFilePicker={showOpenFilePicker}
                    showSaveFilePicker={showSaveFilePicker}
                    onClickAbout={onClickAbout}
                    onClickAccountNav={onClickAccountNav}
                    onClickAddonSettings={onClickAddonSettings}
                    onClickDesktopSettings={onClickDesktopSettings}
                    onClickNewWindow={onClickNewWindow}
                    onClickPackager={onClickPackager}
                    onClickLogo={onClickLogo}
                    onCloseAccountNav={onCloseAccountNav}
                    onLogOut={onLogOut}
                    onOpenExtensionLibrary={onOpenExtensionLibrary}
                    onOpenExtensionManagerModal={onOpenExtensionManagerModal}
                    onOpenRegistration={onOpenRegistration}
                    onProjectTelemetryEvent={onProjectTelemetryEvent}
                    onSeeCommunity={onSeeCommunity}
                    onShare={onShare}
                    onStartSelectingFileUpload={onStartSelectingFileUpload}
                    onToggleLoginOpen={onToggleLoginOpen}
                />
                <Box className={styles.bodyWrapper}>
                    <Box className={styles.flexWrapper}>
                        <Box
                            className={styles.editorWrapper}
                            // ref={editorWrapperRef}
                        >
                            <NativeFindBar
                                activeTabIndex={activeTabIndex}
                                isPlayerOnly={isPlayerOnly}
                                locale={locale}
                                vm={vm}
                            />
                            <NativeSpotlight
                                activeTabIndex={activeTabIndex}
                                isPlayerOnly={isPlayerOnly}
                                locale={locale}
                                vm={vm}
                            />
                            <Tabs
                                forceRenderTabPanel
                                className={tabClassNames.tabs}
                                selectedIndex={activeTabIndex}
                                selectedTabClassName={tabClassNames.tabSelected}
                                selectedTabPanelClassName={tabClassNames.tabPanelSelected}
                                onSelect={onActivateTab}
                            >
                                <TabList className={tabClassNames.tabList}>
                                    <Tab className={tabClassNames.tab}>
                                        <BlocksIcon size={20} />
                                        <FormattedMessage
                                            defaultMessage="Code"
                                            description="Button to get to the code panel"
                                            id="gui.gui.codeTab"
                                        />
                                        <CollaborationTabIndicator tab={BLOCKS_TAB_INDEX} />
                                    </Tab>
                                    <Tab
                                        className={tabClassNames.tab}
                                        onClick={onActivateCostumesTab}
                                    >
                                        <CostumesIcon size={20} />
                                        {targetIsStage ? (
                                            <FormattedMessage
                                                defaultMessage="Backdrops"
                                                description="Button to get to the backdrops panel"
                                                id="gui.gui.backdropsTab"
                                            />
                                        ) : (
                                            <FormattedMessage
                                                defaultMessage="Costumes"
                                                description="Button to get to the costumes panel"
                                                id="gui.gui.costumesTab"
                                            />
                                        )}
                                        <CollaborationTabIndicator tab={COSTUMES_TAB_INDEX} />
                                    </Tab>
                                    <Tab
                                        className={tabClassNames.tab}
                                        onClick={onActivateSoundsTab}
                                    >
                                        <SoundsIcon size={20} />
                                        <FormattedMessage
                                            defaultMessage="Sounds"
                                            description="Button to get to the sounds panel"
                                            id="gui.gui.soundsTab"
                                        />
                                        <CollaborationTabIndicator tab={SOUNDS_TAB_INDEX} />
                                    </Tab>
                                </TabList>
                                <TabPanel className={tabClassNames.tabPanel}>
                                    {fractchMode ? (
                                        <React.Suspense fallback={<Loader />}>
                                            <FractchWorkspace
                                                exitRequested={fractchExitRequested}
                                                theme={theme}
                                                vm={vm}
                                                onExit={handleExitFractchMode}
                                            />
                                        </React.Suspense>
                                    ) : (
                                        <React.Fragment>
                                            <Box className={styles.blocksWrapper}>
                                                <Blocks
                                                    key={`${blocksId}/${theme.getBlocksThemeId()}`}
                                                    canUseCloud={canUseCloud}
                                                    grow={1}
                                                    isVisible={blocksTabVisible}
                                                    options={{
                                                        media: `${basePath}static/${theme.getBlocksMediaFolder()}/`
                                                    }}
                                                    stageSize={stageSize}
                                                    onOpenCustomExtensionModal={onOpenCustomExtensionModal}
                                                    theme={theme}
                                                    vm={vm}
                                                />
                                            </Box>
                                            <Box className={styles.paletteFooter}>
                                                <button
                                                    className={classNames(
                                                        styles.paletteButton,
                                                        styles.paletteSearchButton
                                                    )}
                                                    title={intl.formatMessage(messages.findBlocks)}
                                                    onClick={handleOpenSearch}
                                                >
                                                    <Search
                                                        className={styles.paletteButtonIcon}
                                                        size={22}
                                                    />
                                                </button>
                                                <button
                                                    className={styles.paletteButton}
                                                    title={intl.formatMessage(messages.addExtension)}
                                                    onClick={onExtensionButtonClick}
                                                >
                                                    <ExtensionIcon
                                                        className={styles.extensionButtonIcon}
                                                        draggable={false}
                                                    />
                                                </button>
                                            </Box>
                                            <Box className={styles.watermark}>
                                                <Watermark />
                                            </Box>
                                        </React.Fragment>
                                    )}
                                </TabPanel>
                                <TabPanel className={tabClassNames.tabPanel}>
                                    {costumesTabVisible ? <CostumeTab
                                        vm={vm}
                                    /> : null}
                                </TabPanel>
                                <TabPanel className={tabClassNames.tabPanel}>
                                    {soundsTabVisible ? <SoundTab vm={vm} /> : null}
                                </TabPanel>
                            </Tabs>
                            {backpackVisible && !fractchMode ? (
                                <Backpack host={backpackHost} />
                            ) : null}
                        </Box>

                        <Box
                            className={styles.stagePaneResizer}
                            onPointerDown={enableStageResize ? handleStagePanelResizePointerDown : undefined}
                            onDoubleClick={enableStageResize ? handleStagePanelResizeDoubleClick : undefined}
                            role="separator"
                            aria-orientation="vertical"
                            tabIndex={-1}
                        />

                        <Box
                            className={classNames(styles.stageAndTargetWrapper, styles[stageSize], {
                                [styles.stageHidden]: isStageHidden
                            })}
                            ref={stageAndTargetWrapperRef}
                            style={enableStageResize ? stagePanelStyle : undefined}
                        >
                            <StageWrapper
                                isFullScreen={isFullScreen}
                                isRendererSupported={isRendererSupported()}
                                isRtl={isRtl}
                                isStageHidden={isStageHidden}
                                stageSize={stageSize}
                                stageContainerWidth={
                                    typeof stageContainerWidth === 'number' ? stageContainerWidth : null
                                }
                                stageMaxHeight={
                                    typeof stageCanvasMaxHeight === 'number' ? stageCanvasMaxHeight : null
                                }
                                vm={vm}
                            />
                            {isStageHidden ? null : (
                                <Box className={styles.targetWrapper}>
                                    <TargetPane
                                        stageSize={spriteLayoutSize}
                                        vm={vm}
                                    />
                                </Box>
                            )}
                        </Box>
                    </Box>
                </Box>
                        {extensionLibraryVisible ? (
                            <ExtensionLibrary
                                vm={vm}
                                visible={extensionLibraryVisible}
                                onRequestClose={onRequestCloseExtensionLibrary}
                                onOpenCustomExtensionModal={onOpenCustomExtensionModal}
                                onOpenCustomGalleryModal={onOpenCustomGalleryModal}
                                onEnableProcedureReturns={handleEnableProcedureReturns}
                            />
                        ) : null}
                        <DragLayer />
                    </Box>
                )}
            </React.Fragment>
        );
    }}</MediaQuery>);
};

GUIComponent.propTypes = {
    accountNavOpen: PropTypes.bool,
    activeTabIndex: PropTypes.number,
    authorId: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    authorThumbnailUrl: PropTypes.string,
    authorUsername: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    backdropLibraryVisible: PropTypes.bool,
    backpackHost: PropTypes.string,
    backpackVisible: PropTypes.bool,
    basePath: PropTypes.string,
    blocksTabVisible: PropTypes.bool,
    blocksId: PropTypes.string,
    canChangeLanguage: PropTypes.bool,
    canChangeTheme: PropTypes.bool,
    canCreateCopy: PropTypes.bool,
    canCreateNew: PropTypes.bool,
    canEditTitle: PropTypes.bool,
    canManageFiles: PropTypes.bool,
    canRemix: PropTypes.bool,
    canSave: PropTypes.bool,
    canShare: PropTypes.bool,
    canUseCloud: PropTypes.bool,
    cardsVisible: PropTypes.bool,
    children: PropTypes.node,
    costumeLibraryVisible: PropTypes.bool,
    soundLibraryVisible: PropTypes.bool,
    costumesTabVisible: PropTypes.bool,
    customStageSize: PropTypes.shape({
        width: PropTypes.number,
        height: PropTypes.number
    }),
    enableCommunity: PropTypes.bool,
    extensionLibraryVisible: PropTypes.bool,
    intl: intlShape.isRequired,
    isCreating: PropTypes.bool,
    isEmbedded: PropTypes.bool,
    isFullScreen: PropTypes.bool,
    isPlayerOnly: PropTypes.bool,
    isRtl: PropTypes.bool,
    isShared: PropTypes.bool,
    isWindowFullScreen: PropTypes.bool,
    isTotallyNormal: PropTypes.bool,
    loading: PropTypes.bool,
    logo: PropTypes.string,
    onActivateCostumesTab: PropTypes.func,
    onActivateSoundsTab: PropTypes.func,
    onActivateTab: PropTypes.func,
    onClickAccountNav: PropTypes.func,
    onClickAddonSettings: PropTypes.func,
    onClickDesktopSettings: PropTypes.func,
    onClickPackager: PropTypes.func,
    onClickNewWindow: PropTypes.func,
    onClickLogo: PropTypes.func,
    onCloseAccountNav: PropTypes.func,
    onExtensionButtonClick: PropTypes.func,
    onOpenCustomExtensionModal: PropTypes.func,
    onOpenCustomGalleryModal: PropTypes.func,
    onLogOut: PropTypes.func,
    onOpenExtensionLibrary: PropTypes.func,
    onOpenExtensionManagerModal: PropTypes.func,
    onOpenRegistration: PropTypes.func,
    onRequestCloseBackdropLibrary: PropTypes.func,
    onRequestCloseCostumeLibrary: PropTypes.func,
    onRequestCloseSoundLibrary: PropTypes.func,
    onRequestCloseExtensionLibrary: PropTypes.func,
    onRequestCloseTelemetryModal: PropTypes.func,
    onSeeCommunity: PropTypes.func,
    onShare: PropTypes.func,
    onShowPrivacyPolicy: PropTypes.func,
    onStartSelectingFileUpload: PropTypes.func,
    onTabSelect: PropTypes.func,
    onTelemetryModalCancel: PropTypes.func,
    onTelemetryModalOptIn: PropTypes.func,
    onTelemetryModalOptOut: PropTypes.func,
    onToggleLoginOpen: PropTypes.func,
    onSetStageSize: PropTypes.func,
    onSetFullScreen: PropTypes.func,
    renderLogin: PropTypes.func,
    securityManager: PropTypes.shape({}),
    showComingSoon: PropTypes.bool,
    showOpenFilePicker: PropTypes.func,
    showSaveFilePicker: PropTypes.func,
    soundsTabVisible: PropTypes.bool,
    stageSizeMode: PropTypes.oneOf(Object.keys(STAGE_SIZE_MODES)),
    stageSizeRequestId: PropTypes.number,
    targetIsStage: PropTypes.bool,
    telemetryModalVisible: PropTypes.bool,
    theme: PropTypes.instanceOf(Theme),
    tipsLibraryVisible: PropTypes.bool,
    usernameModalVisible: PropTypes.bool,
    roturLoginModalVisible: PropTypes.bool,
    onRequestCloseRoturLogin: PropTypes.func,
    settingsModalVisible: PropTypes.bool,
    shortcutManagerModalVisible: PropTypes.bool,
    customExtensionModalVisible: PropTypes.bool,
    customGalleryModalVisible: PropTypes.bool,
    fontsModalVisible: PropTypes.bool,
    assetsModalVisible: PropTypes.bool,
    projectMetadataModalVisible: PropTypes.bool,
    unknownPlatformModalVisible: PropTypes.bool,
    invalidProjectModalVisible: PropTypes.bool,
    gitModalVisible: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired
};
GUIComponent.defaultProps = {
    backpackHost: null,
    backpackVisible: false,
    basePath: './',
    blocksId: 'original',
    canChangeLanguage: true,
    canChangeTheme: true,
    canCreateNew: false,
    canEditTitle: false,
    canManageFiles: true,
    canRemix: false,
    canSave: false,
    canCreateCopy: false,
    canShare: false,
    canUseCloud: false,
    enableCommunity: false,
    isCreating: false,
    isShared: false,
    isTotallyNormal: false,
    loading: false,
    showComingSoon: false,
    stageSizeMode: STAGE_SIZE_MODES.large
};

const mapStateToProps = state => ({
    customStageSize: state.scratchGui.customStageSize,
    isWindowFullScreen: state.scratchGui.tw.isWindowFullScreen,
    blocksId: state.scratchGui.timeTravel.year.toString(),
    stageSizeMode: state.scratchGui.stageSize.stageSize,
    stageSizeRequestId: state.scratchGui.stageSize.requestId,
    theme: state.scratchGui.theme.theme,
    locale: state.locales.locale,
    roturLoginModalVisible: state.scratchGui.modals.roturLoginModal
});

const mapDispatchToProps = dispatch => ({
    onSetStageSize: stageSize => dispatch(setStageSize(stageSize)),
    onRequestCloseRoturLogin: () => dispatch(closeRoturLoginModal())
});

export default injectIntl(connect(
    mapStateToProps,
    mapDispatchToProps
)(GUIComponent));
