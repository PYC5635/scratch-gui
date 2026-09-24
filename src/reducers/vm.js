import VM from 'scratch-vm';
import formatMessage from 'format-message';
import storage from '../lib/persistence/storage';
import {MAXIMUM_CLOUD_VARIABLES} from '../lib/constants/tw-cloud-limits';
import {installProjectMetadata} from '../lib/mw-project-metadata';

const SET_VM = 'scratch-gui/vm/SET_VM';
const defaultVM = new VM();
defaultVM.setCompatibilityMode(true);
defaultVM.runtime.cloudOptions.limit = MAXIMUM_CLOUD_VARIABLES;
defaultVM.attachStorage(storage);

// WORKAROUND (Bilup): scratch-vm's setLocale() only re-applies translations
// when the requested locale differs from format-message's *current* locale.
// format-message auto-detects the browser/system locale at load time, so on a
// Chinese-locale browser the default is already 'zh-cn'. The GUI then calls
// setLocale('zh-cn', messages) and the guard sees
// `locale === formatMessage.setup().locale`, SKIPPING formatMessage.setup().
// Extension-block translations are never registered, so every extension block
// (music / pen / tw / text2speech / translate / ...) falls back to English
// while the rest of the GUI stays Chinese. We force the translations to be
// applied whenever they are missing for the requested locale, independent of the
// locale-equality guard.
const _setLocale = defaultVM.setLocale.bind(defaultVM);
defaultVM.setLocale = (locale, messages) => {
    const current = formatMessage.setup();
    const registered = Boolean(current.translations && current.translations[locale]);
    if (locale !== current.locale || !registered) {
        formatMessage.setup({
            locale: locale,
            translations: {[locale]: messages}
        });
    }
    return _setLocale(locale, messages);
};

installProjectMetadata(defaultVM);
const initialState = defaultVM;

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case SET_VM:
        return action.vm;
    default:
        return state;
    }
};
const setVM = function (vm) {
    return {
        type: SET_VM,
        vm: vm
    };
};

export {
    reducer as default,
    initialState as vmInitialState,
    setVM
};
