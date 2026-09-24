/**
 * Mediarecorder addon
 *
 * The recording UI is implemented natively by the menu bar component
 * (src/components/menu-bar/media-recorder.jsx), which is shown based on the
 * "show_media_recorder" menu bar setting (src/lib/menu-bar/settings.js).
 *
 * This userscript bridges the addon on/off state to that menu bar setting so
 * the plugin is registered in the addon settings list and its toggle controls
 * the native record button.
 */
export default async function ({addon}) {
    const SETTING_ID = 'show_media_recorder';
    const STORAGE_KEY = 'mw:menu-bar:show_media_recorder';
    const CHANGE_EVENT = 'mw-menu-bar-settings-changed';

    const writeSetting = value => {
        try {
            localStorage.setItem(STORAGE_KEY, String(value));
            window.dispatchEvent(new CustomEvent(CHANGE_EVENT, {
                detail: {id: SETTING_ID, value}
            }));
        } catch (e) {
            // ignore
        }
    };

    // The addon's enabled state is the source of truth for the native
    // record button. Write the menu bar setting when the addon state
    // changes so the button stays in sync even without a page reload.
    addon.self.addEventListener('reenabled', () => {
        writeSetting(true);
    });
    addon.self.addEventListener('disabled', () => {
        writeSetting(false);
    });

    // On initial load the addon is already enabled when this runs, so make
    // sure the record button is shown. Write unconditionally so a stale
    // "false" left behind by a previous session can't keep the button hidden.
    writeSetting(true);
}
