const STORAGE_KEY = 'mw:skip-asset-loading';

const getSkipAssetLoading = () => {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch (err) {
        return false;
    }
};

const applySkipAssetLoading = vm => {
    if (vm && typeof vm.setLoadAssetsLazily === 'function') {
        vm.setLoadAssetsLazily(getSkipAssetLoading());
    }
};

const setSkipAssetLoading = (vm, enabled) => {
    try {
        localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    } catch (err) {
        // ignore
    }
    applySkipAssetLoading(vm);
};

export {
    getSkipAssetLoading,
    applySkipAssetLoading,
    setSkipAssetLoading
};