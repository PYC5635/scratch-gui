import {getVanillaPalette} from './mw-vanilla-palette';
import {getItem as getStorageItem, setItem as setStorageItem} from './utils/safe-storage.js';
import blocksMessages from '@remixwarp/scratch-l10n/locales/blocks-msgs';

let _ScratchBlocks = null;

const isLoaded = () => !!_ScratchBlocks;

const SCRIPT_LAZY_LOADING_KEY = 'mw:script-lazy-loading';

/**
 * Whether the experimental block lazy loading setting is on. Defaults to off.
 * @returns {boolean} True when scripts outside the loaded region get unloaded.
 */
const isScriptLazyLoadingEnabled = () => getStorageItem(SCRIPT_LAZY_LOADING_KEY) === 'true';

/**
 * Push the lazy loading setting into scratch-blocks. This only controls whether
 * scripts that leave the region are unloaded again; loading stays progressive
 * either way.
 * @param {boolean} enabled True to unload scripts that leave the loaded region.
 */
const applyScriptLazyLoading = enabled => {
    if (!_ScratchBlocks || !_ScratchBlocks.Xml) return;
    if (typeof _ScratchBlocks.Xml.VIRTUAL_CULLING_ENABLED === 'undefined') return;
    _ScratchBlocks.Xml.VIRTUAL_CULLING_ENABLED = !!enabled;
};

const setScriptLazyLoading = enabled => {
    setStorageItem(SCRIPT_LAZY_LOADING_KEY, enabled);
    applyScriptLazyLoading(enabled);
};

const get = () => {
    if (!isLoaded()) {
        throw new Error('scratch-blocks is not loaded yet');
    }
    return _ScratchBlocks;
};

const load = () => {
    if (_ScratchBlocks) {
        return Promise.resolve();
    }
    return import(/* webpackChunkName: "sb" */ 'scratch-blocks')
        .then(m => {
            _ScratchBlocks = m.default;
            applyScriptLazyLoading(isScriptLazyLoadingEnabled());

            // 文言（lzh）：以 zh-cn 积木文本为基底，叠加 scratch-l10n 提供的文言积木文本，
            // 使 ScratchMsgs.setLocale('lzh') 时能切换给完整积木翻译（scratch-blocks 内置仅有 en/zh-cn）。
            const wenyanBlocks = blocksMessages && blocksMessages['lzh'];
            const zhCnBlocks = blocksMessages && blocksMessages['zh-cn'];
            if (wenyanBlocks && _ScratchBlocks.ScratchMsgs && _ScratchBlocks.ScratchMsgs.locales) {
                _ScratchBlocks.ScratchMsgs.locales['lzh'] = Object.assign(
                    {},
                    zhCnBlocks || {},
                    wenyanBlocks
                );
            }

            try {
                const operatorUtils = _ScratchBlocks.ScratchBlocks && _ScratchBlocks.ScratchBlocks.OperatorUtils;
                if (operatorUtils) {
                    operatorUtils.arrowsHidden = getStorageItem('mw:hide-operator-arrows') === 'true';
                }
            } catch (e) {
                // ignore
            }

            const Procedures = _ScratchBlocks.Procedures;
            if (Procedures && typeof Procedures.flyoutCategory === 'function') {
                const originalFlyoutCategory = Procedures.flyoutCategory;
                Procedures.flyoutCategory = workspace => originalFlyoutCategory(workspace).filter(node => !(
                    getVanillaPalette() && node.getAttribute('type') === 'procedures_return'
                ));
            }

            const FlyoutProto = _ScratchBlocks.Flyout && _ScratchBlocks.Flyout.prototype;
            if (FlyoutProto) {
                const originalGetWidth = FlyoutProto.getWidth;
                if (typeof originalGetWidth === 'function' && typeof FlyoutProto.setWidth !== 'function') {
                    FlyoutProto.setWidth = function (width) {
                        this.twUserWidth_ = (typeof width === 'number' && Number.isFinite(width)) ? width : null;
                    };
                    FlyoutProto.getWidth = function () {
                        if (typeof this.twUserWidth_ === 'number') return this.twUserWidth_;
                        return originalGetWidth.call(this);
                    };
                }
            }

            const ToolboxProto = _ScratchBlocks.Toolbox && _ScratchBlocks.Toolbox.prototype;

            if (ToolboxProto && typeof ToolboxProto.setFlyoutWidth !== 'function') {
                ToolboxProto.setFlyoutWidth = function (flyoutWidth) {
                    const CATEGORY_MENU_WIDTH = 60;
                    if (!(typeof flyoutWidth === 'number' && Number.isFinite(flyoutWidth))) return;
                    this.width = CATEGORY_MENU_WIDTH + flyoutWidth;
                    if (this.flyout_ && typeof this.flyout_.setWidth === 'function') {
                        this.flyout_.setWidth(flyoutWidth);
                    }
                };
            }

            const verticalFlyoutProto = _ScratchBlocks.VerticalFlyout && _ScratchBlocks.VerticalFlyout.prototype;

            if (verticalFlyoutProto && verticalFlyoutProto.createRect_) {
                verticalFlyoutProto.createRect_ = function (block, x, y, blockHW, index) {
                    const rect = _ScratchBlocks.utils.createSvgElement('rect', {
                        'fill-opacity': 0,
                        'x': x,
                        'y': y,
                        'height': blockHW.height,
                        'width': blockHW.width
                    }, null);
                    
                    rect.tooltip = block;
                    _ScratchBlocks.Tooltip.bindMouseEvents(rect);
                    
                    const blockSvgRoot = block.getSvgRoot();
                    const canvas = this.workspace_.getCanvas();
                    
                    if (blockSvgRoot &&
                        blockSvgRoot.parentNode === canvas &&
                        canvas.contains &&
                        canvas.contains(blockSvgRoot)) {
                        try {
                            canvas.insertBefore(rect, blockSvgRoot);
                        } catch (e) {
                            console.warn('Flyout insertBefore failed, using appendChild as fallback:', e);
                            canvas.appendChild(rect);
                        }
                    } else {
                        canvas.appendChild(rect);
                    }
                    
                    block.flyoutRect_ = rect;
                    this.backgroundButtons_[index] = rect;
                    return rect;
                };
            }
            
            return _ScratchBlocks;
        });
};

export default {
    get,
    isLoaded,
    load,
    isScriptLazyLoadingEnabled,
    setScriptLazyLoading,
    applyScriptLazyLoading
};
