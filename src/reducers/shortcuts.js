import {getItem as getStorageItem} from '../lib/utils/safe-storage.js';
const SET_SHORTCUT = 'scratch-gui/shortcuts/SET_SHORTCUT';
const RESET_SHORTCUT = 'scratch-gui/shortcuts/RESET_SHORTCUT';
const RESET_ALL_SHORTCUTS = 'scratch-gui/shortcuts/RESET_ALL_SHORTCUTS';
const ENABLE_SHORTCUTS = 'scratch-gui/shortcuts/ENABLE_SHORTCUTS';
const LOAD_SHORTCUTS = 'scratch-gui/shortcuts/LOAD_SHORTCUTS';

const loadFromStorage = () => {
    try {
        console.log('Loading shortcuts from localStorage...');
        const saved = getStorageItem('tw:shortcuts');
        console.log('Saved shortcuts from localStorage:', saved);
        if (saved) {
            const parsed = JSON.parse(saved);
            console.log('Parsed shortcuts:', parsed);
            return parsed;
        }
    } catch (e) {
        console.warn('Failed to load shortcuts from storage:', e);
    }
    return null;
};

const persistToStorage = customShortcuts => {
    try {
        console.log('Saving shortcuts to localStorage...');
        localStorage.setItem('tw:shortcuts', JSON.stringify(customShortcuts));
        console.log('Saved to localStorage successfully');
    } catch (e) {
        console.warn('Failed to save shortcuts:', e);
    }
};
const initialState = {
    enabled: true,
    customShortcuts: loadFromStorage() || {}
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    
    switch (action.type) {
    case SET_SHORTCUT: {
        console.log('Setting shortcut:', action.shortcutId, action.key);
        const updated = {
            ...state.customShortcuts,
            [action.shortcutId]: action.key
        };
        console.log('Updated shortcuts:', updated);
        persistToStorage(updated);
        return Object.assign({}, state, {
            customShortcuts: updated
        });
    }
    case RESET_SHORTCUT: {
        console.log('Resetting shortcut:', action.shortcutId);
        const newCustomShortcuts = {...state.customShortcuts};
        delete newCustomShortcuts[action.shortcutId];
        console.log('Updated shortcuts after reset:', newCustomShortcuts);
        persistToStorage(newCustomShortcuts);
        return Object.assign({}, state, {
            customShortcuts: newCustomShortcuts
        });
    }
    case RESET_ALL_SHORTCUTS: {
        console.log('Resetting all shortcuts');
        try {
            console.log('Removing shortcuts from localStorage...');
            localStorage.removeItem('tw:shortcuts');
            console.log('Removed from localStorage successfully');
        } catch (e) {
            console.warn('Failed to clear shortcuts:', e);
        }
        
        console.log('Resetting all shortcuts');
        persistToStorage({});
        return Object.assign({}, state, {
            customShortcuts: {}
        });
    }
    case LOAD_SHORTCUTS: {
        console.log('Loading shortcuts:', action.customShortcuts);
        const loadedShortcuts = action.customShortcuts || {};
        try {
            console.log('Saving shortcuts to localStorage...');
            localStorage.setItem('tw:shortcuts', JSON.stringify(loadedShortcuts));
            console.log('Saved to localStorage successfully');
        } catch (e) {
            console.warn('Failed to save shortcuts:', e);
        }

        return Object.assign({}, state, {
            customShortcuts: loadedShortcuts
        });
    }
    case ENABLE_SHORTCUTS:
        return Object.assign({}, state, {
            enabled: action.enabled
        });
    default:
        return state;
    }
};

const setShortcut = (shortcutId, key) => ({
    type: SET_SHORTCUT,
    shortcutId,
    key
});

const resetShortcut = shortcutId => ({
    type: RESET_SHORTCUT,
    shortcutId
});

const resetAllShortcuts = () => ({
    type: RESET_ALL_SHORTCUTS
});

const setShortcutsEnabled = enabled => ({
    type: ENABLE_SHORTCUTS,
    enabled
});

const loadShortcuts = customShortcuts => ({
    type: LOAD_SHORTCUTS,
    customShortcuts
});

export {
    reducer as default,
    initialState as shortcutsInitialState,
    setShortcut,
    resetShortcut,
    resetAllShortcuts,
    setShortcutsEnabled,
    loadShortcuts
};
