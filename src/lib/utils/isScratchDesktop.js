import {getItem as getStorageItem} from './safe-storage.js';
const STORAGE_KEY = 'mw:is-scratch-desktop';

/**
 * Detect whether the current page is running inside the desktop app's webview.
 * Used as a fallback when `setIsScratchDesktop()` was never called, e.g. the
 * community site (`index.html` bundle) opened inside the desktop app.
 * @returns {boolean} - true when running inside the desktop app's webview; false otherwise.
 */
const isDesktopEnvironment = function () {
    if (typeof window === 'undefined') {
        return false;
    }
    if (window.DesktopApp) {
        return true;
    }
    if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')) {
        return true;
    }
    // The desktop app shares localStorage with the editor (same origin), so if the
    // editor was opened here and detected the desktop app, remember it across pages.
    try {
        if (window.localStorage && getStorageItem(STORAGE_KEY) === '1') {
            return true;
        }
    } catch (e) {
        // localStorage may be unavailable; ignore
    }
    return false;
};

/**
 * Internal stored state. Not valid until after at least one call to `setIsScratchDesktop()`.
 * @type {boolean}
 */
let _isScratchDesktop; // undefined = not ready yet

/**
 * Tell the `isScratchDesktop()` whether or not the GUI is running under Scratch Desktop.
 * @param {boolean} value - the new value which `isScratchDesktop()` should return in the future.
 */
const setIsScratchDesktop = function (value) {
    _isScratchDesktop = value;
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
        }
    } catch (e) {
        // localStorage may be unavailable; ignore
    }
};

/**
 * @returns {boolean} - true if it seems like the GUI is running under Scratch Desktop; false otherwise.
 * If `setIsScratchDesktop()` has not yet been called, falls back to environment detection.
 */
const isScratchDesktop = function () {
    if (typeof _isScratchDesktop === 'boolean') {
        return _isScratchDesktop;
    }
    return isDesktopEnvironment();
};

/**
 * @returns {boolean} - false if it seems like the GUI is running under Scratch Desktop; true otherwise.
 */
const notScratchDesktop = function () {
    return !isScratchDesktop();
};

export default isScratchDesktop;
export {
    isScratchDesktop,
    notScratchDesktop,
    setIsScratchDesktop
};
