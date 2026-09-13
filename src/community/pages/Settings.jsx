import React, {useState, useEffect} from 'react';
import {getItem as getStorageItem} from '../../lib/utils/safe-storage.js';
import {useIntl} from '../../lib/tw-use-intl.jsx';
import {Menu, Palette, Radio, Store, SwatchBook, User, Brush} from 'lucide-react';
import {applyTheme, detectTheme} from '../../lib/themes/themePersistance.js';
import {ThemeAccentPanel} from '../../components/tw-settings-modal/theme-accent-panel.jsx';
import CustomThemesPage from '../../components/tw-settings-modal/custom-themes-page.jsx';
import BilupThemePanel from '../components/WarpThemePanel.jsx';
import Sidebar from '../components/Sidebar.jsx';
import {useUser} from '../UserContext.jsx';
import {
    getUsernameOverride,
    setUsernameOverride
} from '../../lib/rotur/cloud-sync.js';
import {
    getAccentMenuBar,
    setAccentMenuBar,
    getMenuBarText,
    setMenuBarText,
    MENU_BAR_TEXT_OPTIONS
} from '../../lib/themes/menu-bar-accent.js';
import {getRoturSettings, updateRoturSettings} from '../../lib/rotur/settings.js';
import {presenceSupported} from '../../lib/rotur/client.js';
import isScratchDesktop from '../../lib/utils/isScratchDesktop.js';
import styles from './Settings.module.css';

const PROJECT_THEME_MODE_KEY = 'mw:project-theme-mode';
const PROJECT_THEME_MODES = [
    {value: 'all', labelKey: 'mw.community.settings.all', labelDefault: 'All projects'},
    {value: 'followed', labelKey: 'mw.community.settings.followed', labelDefault: 'Only creators I follow'},
    {value: 'hearted', labelKey: 'mw.community.settings.hearted', labelDefault: 'Only projects I have hearted'},
    {value: 'none', labelKey: 'mw.community.settings.none', labelDefault: 'Never'}
];
const getProjectThemeMode = () => {
    try {
        return getStorageItem(PROJECT_THEME_MODE_KEY) || 'all';
    } catch (e) {
        return 'all';
    }
};

const ALL_SECTIONS = [
    {key: 'theme', labelKey: 'mw.community.settings.section.theme', labelDefault: 'Theme', icon: Palette},
    {key: 'project-themes', labelKey: 'mw.community.settings.section.project-themes', labelDefault: 'Project themes', icon: Brush},
    {key: 'custom-themes', labelKey: 'mw.community.settings.section.custom-themes', labelDefault: 'Custom themes', icon: SwatchBook},
    {key: 'biluptheme', labelKey: 'mw.community.settings.section.biluptheme', labelDefault: 'BilupTheme', icon: Store},
    {key: 'menu-bar', labelKey: 'mw.community.settings.section.menu-bar', labelDefault: 'Menu bar', icon: Menu},
    {key: 'presence', labelKey: 'mw.community.settings.section.presence', labelDefault: 'Presence', icon: Radio},
    {key: 'identity', labelKey: 'mw.community.settings.section.identity', labelDefault: 'Identity', icon: User}
];

const DESKTOP_HIDDEN_SECTIONS = new Set(['biluptheme', 'identity', 'presence']);

const MENU_BAR_TEXT_LABEL_KEYS = {
    auto: 'mw.community.settings.menuBarText.auto',
    light: 'mw.community.settings.menuBarText.light',
    dark: 'mw.community.settings.menuBarText.dark'
};

const Settings = ({isScratchDesktop: desktop = isScratchDesktop()}) => {
    const intl = useIntl();
    const t = (id, defaultMessage, values) => intl.formatMessage({id, defaultMessage}, values);
    const {user, login, logout} = useUser();
    const desktopApp = Boolean(desktop);
    const sections = ALL_SECTIONS
        .filter(section => !desktopApp || !DESKTOP_HIDDEN_SECTIONS.has(section.key))
        .map(section => ({...section, label: t(section.labelKey, section.labelDefault)}));
    const [theme, setTheme] = useState(detectTheme());
    const [username, setUsername] = useState(getUsernameOverride() || '');
    const [accentMenuBar, setAccentMenuBarState] = useState(getAccentMenuBar());
    const [menuBarText, setMenuBarTextState] = useState(getMenuBarText());
    const [presence, setPresence] = useState(getRoturSettings());
    const [projectThemeMode, setProjectThemeMode] = useState(getProjectThemeMode());
    const [activeSection, setActiveSection] = useState(sections[0].key);
    const [presenceOk, setPresenceOk] = useState(true);

    useEffect(() => {
        if (!user) {
            setPresenceOk(true);
            return;
        }
        let cancelled = false;
        presenceSupported().then(supported => {
            if (!cancelled) setPresenceOk(supported);
        });
        return () => {
            cancelled = true;
        };
    }, [user]);

    const reloginForPresence = async () => {
        try {
            await logout();
            await login();
        } catch (e) {
            // ignore
        }
    };

    const changeProjectThemeMode = value => {
        setProjectThemeMode(value);
        try {
            localStorage.setItem(PROJECT_THEME_MODE_KEY, value);
        } catch (e) {
            // ignore
        }
    };

    useEffect(() => {
        setTheme(detectTheme());
        setUsername(getUsernameOverride() || '');
        setAccentMenuBarState(getAccentMenuBar());
        setMenuBarTextState(getMenuBarText());
        setPresence(getRoturSettings());
    }, [user]);

    const applyAndPersist = next => {
        applyTheme(next);
        setTheme(detectTheme());
    };

    const changeUsername = value => {
        setUsername(value);
        setUsernameOverride(value || null);
    };
    const changeAccentMenuBar = enabled => {
        setAccentMenuBar(enabled);
        setAccentMenuBarState(enabled);
        applyTheme(detectTheme());
    };
    const changeMenuBarText = value => {
        setMenuBarText(value);
        setMenuBarTextState(value);
        applyTheme(detectTheme());
    };
    const changePresence = (key, enabled) => {
        updateRoturSettings({[key]: enabled});
        setPresence(current => ({...current, [key]: enabled}));
    };

    const presenceLabels = {
        presenceEnabled: t('mw.community.settings.presenceEnabled', 'Share editor presence'),
        includeEditDuration: t('mw.community.settings.includeEditDuration', 'Include edit duration')
    };
    const menuBarTextLabel = option => t(
        MENU_BAR_TEXT_LABEL_KEYS[option] || 'mw.community.settings.menuBarText.auto',
        option[0].toUpperCase() + option.slice(1)
    );

    return (
        <main className={styles.page}>
            <h1>{t('mw.community.settings.title', 'Settings')}</h1>
            <p className={styles.lead}>
                {t('mw.community.settings.lead',
                    'These settings apply across all of Bilup, including the editor and site.')}
            </p>

            <div className={styles.layout}>
                <Sidebar
                    sections={sections}
                    active={activeSection}
                    onChange={setActiveSection}
                    ariaLabel={t('mw.community.settings.ariaLabel', 'Settings sections')}
                />

                <div className={styles.content}>
                    {activeSection === 'theme' ? (
                        <section className={styles.card}>
                            <ThemeAccentPanel
                                theme={theme}
                                onChangeTheme={applyAndPersist}
                            />
                        </section>
                    ) : null}

                    {activeSection === 'custom-themes' ? (
                        <section className={styles.card}>
                            <h2>{t('mw.community.settings.customThemes', 'Custom themes')}</h2>
                            <CustomThemesPage
                                theme={theme}
                                onChangeTheme={applyAndPersist}
                                onOpenWarpThemeMarketplace={desktopApp ? null : () => setActiveSection('biluptheme')}
                            />
                        </section>
                    ) : null}

                    {activeSection === 'biluptheme' ? (
                        <section className={styles.card}>
                            <h2>{t('mw.community.settings.biluptheme', 'BilupTheme marketplace')}</h2>
                            <BilupThemePanel
                                theme={theme}
                                onThemeChange={applyAndPersist}
                            />
                        </section>
                    ) : null}

                    {activeSection === 'menu-bar' ? (
                        <section className={styles.card}>
                            <h2>{t('mw.community.settings.menuBar', 'Menu bar')}</h2>
                            <div className={styles.settingRows}>
                                <label className={styles.settingRow}>
                                    <span>{t('mw.community.settings.accentMenuBar', 'Accent-colored menu bar')}</span>
                                    <input
                                        className={styles.checkbox}
                                        type="checkbox"
                                        checked={accentMenuBar}
                                        onChange={event => changeAccentMenuBar(event.target.checked)}
                                    />
                                </label>
                                <label className={styles.settingRow}>
                                    <span>{t('mw.community.settings.menuBarText', 'Menu bar text')}</span>
                                    <select
                                        className={styles.select}
                                        value={menuBarText}
                                        onChange={event => changeMenuBarText(event.target.value)}
                                    >
                                        {MENU_BAR_TEXT_OPTIONS.map(option => (
                                            <option
                                                key={option}
                                                value={option}
                                            >
                                                {menuBarTextLabel(option)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </section>
                    ) : null}

                    {activeSection === 'presence' ? (
                        <section className={styles.card}>
                            <h2>{t('mw.community.settings.presence', 'Presence')}</h2>
                            {user && !presenceOk ? (
                                <div className={styles.risk}>
                                    {t('mw.community.settings.presenceMissingPermission1',
                                        'Your current Bilup Accounts login is missing the ')}
                                    <strong>{'account:profile'}</strong>
                                    {t('mw.community.settings.presenceMissingPermission2',
                                        ' permission, so your editor activity cannot be shared. Log in again to grant it.')}
                                    <div>
                                        <button
                                            className={styles.riskAction}
                                            type="button"
                                            onClick={reloginForPresence}
                                        >
                                            {t('mw.community.settings.loginAgain', 'Log in again')}
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                            <div className={styles.settingRows}>
                                {Object.entries(presence).filter(([key]) => presenceLabels[key])
                                    .map(([key, enabled]) => (
                                    <label
                                        key={key}
                                        className={styles.settingRow}
                                    >
                                        <span>{presenceLabels[key]}</span>
                                        <input
                                            className={styles.checkbox}
                                            type="checkbox"
                                            checked={enabled}
                                            onChange={event => changePresence(key, event.target.checked)}
                                        />
                                    </label>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {activeSection === 'project-themes' ? (
                        <section className={styles.card}>
                            <h2>{t('mw.community.settings.projectThemes', 'Project themes')}</h2>
                            <p className={styles.lead}>
                                {t('mw.community.settings.projectThemesLead',
                                    'Some projects come with their own Bilup theme. Choose when the player should switch to a project\'s theme automatically.')}
                            </p>
                            <label className={styles.field}>
                                <span>{t('mw.community.settings.applyProjectThemesFor', 'Apply project themes for')}</span>
                                <select
                                    className={styles.input}
                                    value={projectThemeMode}
                                    onChange={event => changeProjectThemeMode(event.target.value)}
                                >
                                    {PROJECT_THEME_MODES.map(mode => (
                                        <option
                                            key={mode.value}
                                            value={mode.value}
                                        >{t(mode.labelKey, mode.labelDefault)}</option>
                                    ))}
                                </select>
                            </label>
                        </section>
                    ) : null}

                    {activeSection === 'identity' ? (
                        <section className={styles.card}>
                            <h2>{t('mw.community.settings.identity', 'Identity')}</h2>
                            <label
                                className={styles.field}
                                htmlFor="username-override"
                            >
                                <span>{t('mw.community.settings.usernameOverride', 'Username override')}</span>
                                <input
                                    id="username-override"
                                    className={styles.input}
                                    type="text"
                                    value={username}
                                    onChange={event => changeUsername(event.target.value)}
                                    placeholder={t('mw.community.settings.usernamePlaceholder', 'Use account username')}
                                />
                            </label>
                        </section>
                    ) : null}

                    {!user && !desktopApp ? (
                        <p className={styles.note}>
                            {t('mw.community.settings.signInNote',
                                'Sign in to sync your settings across devices through your Bilup Accounts account.')}
                        </p>
                    ) : null}
                </div>
            </div>
        </main>
    );
};

export default Settings;
