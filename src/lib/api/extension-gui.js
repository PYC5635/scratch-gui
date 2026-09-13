import LazyScratchBlocks from '../tw-lazy-scratch-blocks';
import AddonHooks from '../../addons/hooks';

import WindowManager from '../../addons/window-system/window-manager';

// browser-git pulls in isomorphic-git, lightning-fs and jszip (several hundred
// KB after gzip). Extensions almost never use Scratch.gui.git, so expose a lazy
// proxy that loads the real module on first access instead of at startup.
const createBrowserGitAccessor = () => {
    if (typeof Proxy === 'undefined') {
        // Very old browsers: keep a stub so Scratch.gui.git exists.
        return {};
    }
    let browserGitPromise;
    const getBrowserGit = () => {
        if (!browserGitPromise) {
            browserGitPromise = import('../git/browser-git');
        }
        return browserGitPromise;
    };
    const cache = {};
    return new Proxy(cache, {
        get: (target, prop) => {
            if (prop in target) {
                return target[prop];
            }
            // Function exports resolve to promises of their return values;
            // non-function exports (constants) resolve to their value.
            target[prop] = (...args) => getBrowserGit().then(module => {
                const value = module[prop];
                return typeof value === 'function' ? value(...args) : value;
            });
            return target[prop];
        },
        has: () => true
    });
};

/**
 * Implements Scratch.gui API for unsandboxed extensions.
 * @param {any} Scratch window.Scratch, mutated in place.
 */
const implementGuiAPI = Scratch => {
    Scratch.gui = {
        /**
         * Lazily get the internal ScratchBlocks object when it becomes available. It may never be
         * available if, for example, the user never enters the editor.
         *
         * You should not assume that ScratchBlocks becoming available means the user is actually
         * in the editor or that a workspace has been created already.
         *
         * @returns {Promise<any>} Promise that may eventually resolve to ScratchBlocks
         */
        getBlockly: () => {
            if (AddonHooks.blockly) {
                return Promise.resolve(AddonHooks.blockly);
            }
            return new Promise(resolve => {
                AddonHooks.blocklyCallbacks.push(() => resolve(AddonHooks.blockly));
            });
        },

        /**
         * Get the internal ScratchBlocks object as soon as possible. This lets you access it even
         * if the user never enters the editor.
         *
         * This method is VERY SLOW and will cause A LOT OF CPU AND NETWORK ACTIVITY because it
         * downloads and evaluates all of scratch-blocks, a multi-megabyte JavaScript bundle.
         *
         * @returns {Promise<any>} Promise that will resolve to ScratchBlocks.
         */
        getBlocklyEagerly: () => LazyScratchBlocks.load(),

        // Expose the window manager on the VM for addons/integration.
        wm: WindowManager,

        // Expose Bilup's browser git integration on the VM.
        git: createBrowserGitAccessor()
    };
};

export default implementGuiAPI;
