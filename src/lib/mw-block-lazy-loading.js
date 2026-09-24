import VMScratchBlocks from './tw-lazy-scratch-blocks';

const STORAGE_KEY = 'mw:block-lazy-loading';

const getBlockLazyLoading = () => {
    try {
        return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch (err) {
        return true;
    }
};

const getScratchBlocks = () => {
    if (!VMScratchBlocks.isLoaded()) {
        return null;
    }
    const ScratchBlocks = VMScratchBlocks.get();
    return ScratchBlocks && ScratchBlocks.ScratchBlocks;
};

const applyBlockLazyLoading = enabled => {
    const blocks = getScratchBlocks();
    if (blocks && typeof blocks.setBlockLazyLoading === 'function') {
        blocks.setBlockLazyLoading(enabled);
    }
};

const setBlockLazyLoading = enabled => {
    try {
        localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    } catch (err) {
        // ignore
    }
    applyBlockLazyLoading(enabled);
};

const initBlockLazyLoading = () => {
    applyBlockLazyLoading(getBlockLazyLoading());
};

export {
    getBlockLazyLoading,
    setBlockLazyLoading,
    applyBlockLazyLoading,
    initBlockLazyLoading
};