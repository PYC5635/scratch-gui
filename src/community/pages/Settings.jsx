/* eslint-disable max-len */
import React, {useState, useEffect, useRef} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {useIntl} from '../../lib/tw-use-intl.jsx';
import {Palette, Radio, User, Bell, Shield, Database, Trash2} from 'lucide-react';
import {applyTheme, detectTheme} from '../../lib/themes/themePersistance.js';
import {ThemeAccentPanel} from '../../components/tw-settings-modal/theme-accent-panel.jsx';
import CustomThemesPage from '../../components/tw-settings-modal/custom-themes-page.jsx';
import BilupThemePanel from '../components/WarpThemePanel.jsx';
import Sidebar from '../components/Sidebar.jsx';
import SectionTabs from '../components/SectionTabs.jsx';
import Modal from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';
import {Switch, SwitchRow} from '../components/ui/Switch.jsx';
import {useUser} from '../UserContext.jsx';
import {
    getUsernameOverride,
    setUsernameOverride,
    notifyLocalChange
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
import {getNotificationPreferences, setNotificationPreferences} from '../notification-preferences';
import api from '../api';
import {analyticsEnabled, setAnalyticsEnabled} from '../analytics.js';
import {LOCALES, useCommunityIntl} from '../i18n.jsx';
import downloadBlob from '../../lib/utils/download-blob.js';

const PROJECT_THEME_MODE_KEY = 'mw:project-theme-mode';
const PROJECT_THEME_MODES = [
    {value: 'all', labelKey: 'mw.community.settings.all', labelDefault: 'All projects'},
    {value: 'followed', labelKey: 'mw.community.settings.followed', labelDefault: 'Only creators I follow'},
    {value: 'hearted', labelKey: 'mw.community.settings.hearted', labelDefault: 'Only projects I have hearted'},
    {value: 'none', labelKey: 'mw.community.settings.none', labelDefault: 'Never'}
];
const THEME_TABS = [
    {key: 'appearance', labelKey: 'settings.themeTabAppearance', labelDefault: 'Appearance'},
    {key: 'projects', labelKey: 'settings.themeTabProjects', labelDefault: 'Projects'},
    {key: 'custom', labelKey: 'settings.themeTabCustom', labelDefault: 'Custom'},
    {key: 'marketplace', labelKey: 'settings.themeTabMarketplace', labelDefault: 'Marketplace'}
];
const getProjectThemeMode = () => {
    try {
        const value = localStorage.getItem(PROJECT_THEME_MODE_KEY);
        return PROJECT_THEME_MODES.some(mode => mode.value === value) ? value : 'all';
    } catch (e) {
        return 'all';
    }
};
const matchesDeleteConfirmation = (value, username) => (
    String(value).trim().toLowerCase() === String(username).toLowerCase()
);

const SECTIONS = [
    {key: 'theme', labelKey: 'mw.community.settings.section.theme', labelDefault: 'Theme', icon: Palette},
    {key: 'presence', labelKey: 'mw.community.settings.section.presence', labelDefault: 'Presence', icon: Radio},
    {key: 'notifications', labelKey: 'mw.community.settings.section.notifications', labelDefault: 'Notifications', icon: Bell},
    {key: 'safety', labelKey: 'mw.community.settings.section.safety', labelDefault: 'Safety', icon: Shield},
    {key: 'data', labelKey: 'mw.community.settings.section.data', labelDefault: 'Your data', icon: Database},
    {key: 'identity', labelKey: 'mw.community.settings.section.identity', labelDefault: 'Identity', icon: User}
];

const DESKTOP_HIDDEN_SECTIONS = new Set(['biluptheme', 'identity', 'presence']);

const MENU_BAR_TEXT_LABEL_KEYS = {
    auto: 'mw.community.settings.menuBarText.auto',
    light: 'mw.community.settings.menuBarText.light',
    dark: 'mw.community.settings.menuBarText.dark'
};
const settingsThemeTab = value => {
    if (THEME_TABS.some(tab => tab.key === value)) return value;
    return THEME_TABS[0].key;
};
const settingsSection = value => {
    if (SECTIONS.some(section => section.key === value)) return value;
    return SECTIONS[0].key;
};

const NOTIFICATION_SETTINGS = [
    ['social', 'settings.notifSocial'],
    ['projects', 'settings.notifProjects'],
    ['economy', 'settings.notifEconomy'],
    ['system', 'settings.notifSystem']
];

const Settings = ({isScratchDesktop: desktop = isScratchDesktop()}) => {
    const intl = useIntl();
    const t = (id, defaultMessage, values) => intl.formatMessage({id, defaultMessage}, values);
    const {user, login, loginOrThrow, logout} = useUser();
    const desktopApp = Boolean(desktop);
    const sections = SECTIONS.map(section => ({...section, label: t(section.labelKey, section.labelDefault)}));
    const [searchParams, setSearchParams] = useSearchParams();
    const {preference: localePreference, setPreference: setLocalePreference, t: ct} = useCommunityIntl();
    const [theme, setTheme] = useState(detectTheme());
    const [username, setUsername] = useState(getUsernameOverride() || '');
    const [accentMenuBar, setAccentMenuBarState] = useState(getAccentMenuBar());
    const [menuBarText, setMenuBarTextState] = useState(getMenuBarText());
    const [presence, setPresence] = useState(getRoturSettings());
    const [projectThemeMode, setProjectThemeMode] = useState(getProjectThemeMode());
    const activeSection = settingsSection(searchParams.get('section'));
    const themeTab = settingsThemeTab(searchParams.get('tab'));
    const [presenceOk, setPresenceOk] = useState(true);
    const [presenceBusy, setPresenceBusy] = useState(false);
    const [notificationPreferences, setNotificationPreferencesState] = useState(getNotificationPreferences());
    const [safety, setSafety] = useState({blocked: [], muted: []});
    const [safetyError, setSafetyError] = useState('');
    const [safetyBusy, setSafetyBusy] = useState('');
    const [dataStatus, setDataStatus] = useState('');
    const [dataBusy, setDataBusy] = useState('');
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [shareAnalytics, setShareAnalytics] = useState(analyticsEnabled());
    const dataContext = useRef((user && user.username) || '');
    dataContext.current = (user && user.username) || '';
    const safetyContext = useRef((user && user.username) || '');
    safetyContext.current = (user && user.username) || '';
    const actionLocks = useRef(new Set());

    useEffect(() => {
        setDataStatus('');
        setDataBusy('');
        setDeleteConfirmation('');
        setDeleteModalOpen(false);
    }, [user]);

    const setActiveSection = section => {
        const next = new URLSearchParams(searchParams);
        if (section === SECTIONS[0].key) next.delete('section');
        else next.set('section', section);
        setSearchParams(next);
    };
    const setThemeTab = tab => {
        const next = new URLSearchParams(searchParams);
        if (tab === THEME_TABS[0].key) next.delete('tab');
        else next.set('tab', tab);
        setSearchParams(next);
    };

    useEffect(() => {
        setSafetyError('');
        setSafetyBusy('');
        if (!user) {
            setSafety({blocked: [], muted: []});
            return () => {};
        }
        let cancelled = false;
        api.safety()
            .then(data => {
                if (!cancelled) setSafety({blocked: data.blocked || [], muted: data.muted || []});
            })
            .catch(() => {
                if (!cancelled) setSafetyError(ct('settings.safetyLoadFailed'));
            });
        return () => {
            cancelled = true;
        };
    }, [user]);

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
        const context = dataContext.current;
        const actionKey = `${context}\u0000presence-login`;
        if (actionLocks.current.has(actionKey)) return;
        actionLocks.current.add(actionKey);
        setPresenceBusy(true);
        try {
            await logout();
            await loginOrThrow();
        } catch (e) {
            // ignore
        } finally {
            actionLocks.current.delete(actionKey);
            setPresenceBusy(false);
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
    const changeNotificationPreference = (key, enabled) => {
        const next = {...notificationPreferences, [key]: enabled};
        setNotificationPreferencesState(next);
        setNotificationPreferences(next);
        notifyLocalChange();
    };
    const changeAnalytics = enabled => {
        setAnalyticsEnabled(enabled);
        setShareAnalytics(enabled);
    };
    const removeSafetyEntry = async (kind, name) => {
        const context = safetyContext.current;
        const actionKey = `${context}\u0000safety`;
        if (actionLocks.current.has(actionKey)) return;
        actionLocks.current.add(actionKey);
        setSafetyBusy(`${kind}:${name}`);
        setSafetyError('');
        try {
            const data = kind === 'blocked' ? await api.unblockUser(name) : await api.unmuteUser(name);
            if (safetyContext.current === context) {
                setSafety({blocked: data.blocked || [], muted: data.muted || []});
            }
        } catch (e) {
            if (safetyContext.current === context) {
                setSafetyError(e.message || ct('settings.safetyUpdateFailed'));
            }
        } finally {
            actionLocks.current.delete(actionKey);
            if (safetyContext.current === context) setSafetyBusy('');
        }
    };
    const downloadData = async () => {
        if (!user) return;
        const usernameContext = dataContext.current;
        const actionKey = `${usernameContext}\u0000data`;
        if (actionLocks.current.has(actionKey)) return;
        actionLocks.current.add(actionKey);
        setDataBusy('export');
        setDataStatus(ct('settings.preparingExport'));
        try {
            const data = await api.exportMyData();
            if (dataContext.current !== usernameContext) return;
            const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
            downloadBlob(`mistwarp-${usernameContext}-data.json`, blob);
            setDataStatus(ct('settings.exportDownloaded'));
        } catch (e) {
            if (dataContext.current === usernameContext) setDataStatus(e.message || ct('settings.exportFailed'));
        } finally {
            actionLocks.current.delete(actionKey);
            if (dataContext.current === usernameContext) setDataBusy('');
        }
    };
    const deleteData = async () => {
        if (!user || !matchesDeleteConfirmation(deleteConfirmation, user.username)) return;
        const usernameContext = dataContext.current;
        const confirmation = deleteConfirmation.trim();
        const actionKey = `${usernameContext}\u0000data`;
        if (actionLocks.current.has(actionKey)) return;
        actionLocks.current.add(actionKey);
        setDataBusy('delete');
        setDataStatus(ct('settings.deletingData'));
        try {
            await api.deleteMyData(confirmation);
            if (dataContext.current !== usernameContext) return;
            try {
                await logout();
            } catch (e) {
                // The data deletion already succeeded. Reloading clears the local session state.
            }
            window.location.assign('/');
        } catch (e) {
            if (dataContext.current === usernameContext) setDataStatus(e.message || ct('settings.deleteFailed'));
        } finally {
            actionLocks.current.delete(actionKey);
            if (dataContext.current === usernameContext) setDataBusy('');
        }
    };
    const openDeleteModal = () => {
        setDataStatus('');
        setDeleteModalOpen(true);
    };
    const closeDeleteModal = () => {
        if (dataBusy !== 'delete') setDeleteModalOpen(false);
    };

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
                            <SectionTabs items={THEME_TABS.map(tab => ({key: tab.key, label: ct(tab.labelKey)}))} value={themeTab} onChange={setThemeTab} className={styles.themeTabs} itemClassName={styles.themeTab} activeClassName={styles.themeTabActive} ariaLabel={ct('settings.themeAria')} />
                            {themeTab === 'appearance' ? <div className={styles.themeContent}>
                                <ThemeAccentPanel theme={theme} onChangeTheme={applyAndPersist} />
                                <div className={styles.appearanceSection}>
                                    <h2>{t('mw.community.settings.menuBar', 'Menu bar')}</h2>
                                    <div className={styles.settingRows}>
                                        <SwitchRow
                                            checked={accentMenuBar}
                                            label={t('mw.community.settings.accentMenuBar', 'Accent-colored menu bar')}
                                            onChange={changeAccentMenuBar}
                                        />
                                        <label className={styles.settingRow}>
                                            <span>{t('mw.community.settings.menuBarText', 'Menu bar text')}</span>
                                            <select className={styles.select} value={menuBarText} onChange={event => changeMenuBarText(event.target.value)}>
                                                {MENU_BAR_TEXT_OPTIONS.map(option => <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>)}
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            </div> : null}
                            {themeTab === 'projects' ? <div className={styles.themeContent}>
                                <h2>{t('mw.community.settings.projectThemes', 'Project themes')}</h2>
                                <p className={styles.lead}>{t('mw.community.settings.projectThemesLead',
                                    'Some projects come with their own Bilup theme. Choose when the player should switch to a project\'s theme automatically.')}</p>
                                <label className={styles.field}>
                                    <span>{t('mw.community.settings.applyProjectThemesFor', 'Apply project themes for')}</span>
                                    <select className={styles.input} value={projectThemeMode} onChange={event => changeProjectThemeMode(event.target.value)}>
                                        {PROJECT_THEME_MODES.map(mode => <option key={mode.value} value={mode.value}>{t(mode.labelKey, mode.labelDefault)}</option>)}
                                    </select>
                                </label>
                            </div> : null}
                            {themeTab === 'custom' ? <div className={styles.themeContent}>
                                <h2>{t('mw.community.settings.customThemes', 'Custom themes')}</h2>
                                <CustomThemesPage theme={theme} onChangeTheme={applyAndPersist} onOpenWarpThemeMarketplace={() => setThemeTab('marketplace')} />
                            </div> : null}
                            {themeTab === 'marketplace' ? <div className={styles.themeContent}>
                                <h2>{t('mw.community.settings.biluptheme', 'WarpTheme marketplace')}</h2>
                                <BilupThemePanel theme={theme} onThemeChange={applyAndPersist} />
                            </div> : null}
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
                                        <Button
                                            className={styles.riskAction}
                                            busy={presenceBusy}
                                            busyLabel={ct('settings.loggingIn')}
                                            onClick={reloginForPresence}
                                        >
                                            {t('mw.community.settings.loginAgain', 'Log in again')}
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                            <div className={styles.settingRows}>
                                {Object.entries(presence).map(([key, enabled]) => (
                                    <SwitchRow
                                        key={key}
                                        checked={Boolean(enabled)}
                                        label={key === 'presenceEnabled'
                                            ? t('mw.community.settings.presenceEnabled', 'Share editor presence')
                                            : t('mw.community.settings.includeEditDuration', 'Include edit duration')}
                                        onChange={value => changePresence(key, value)}
                                    />
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {activeSection === 'notifications' ? (
                        <section className={styles.card}>
                            <h2>{t('mw.community.settings.notifications', 'Notifications')}</h2>
                            <p className={styles.lead}>{ct('settings.notifLead')}</p>
                            <div className={styles.settingRows}>
                                {NOTIFICATION_SETTINGS.map(([key, label]) => (
                                    <SwitchRow
                                        key={key}
                                        checked={Boolean(notificationPreferences[key])}
                                        label={ct(label)}
                                        onChange={value => changeNotificationPreference(key, value)}
                                    />
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {activeSection === 'identity' ? (
                        <section className={styles.card}>
                            <h2>{t('mw.community.settings.identity', 'Identity')}</h2>
                            <p className={styles.lead}>{ct('settings.identityLead')}</p>
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
                                <small>{ct('settings.usernameOverrideHelp')}</small>
                            </label>
                            <label className={styles.field} htmlFor="community-locale">
                                <span>{t('settings.language')}</span>
                                <select id="community-locale" className={styles.input} value={localePreference} onChange={event => setLocalePreference(event.target.value)}>
                                    {LOCALES.map(locale => <option value={locale.value} key={locale.value}>{locale.label}</option>)}
                                </select>
                                <small>{t('settings.languageHelp')}</small>
                            </label>
                        </section>
                    ) : null}

                    {activeSection === 'safety' ? (
                        <section className={styles.card}>
                            <h2>{t('mw.community.settings.safety', 'Safety')}</h2>
                            <p className={styles.lead}>{ct('settings.safetyLead')}</p>
                            {!user ? <p className={styles.note}>{ct('settings.safetySignIn')}</p> : null}
                            {safetyError ? <p className={styles.error}>{safetyError}</p> : null}
                            {user ? <div className={styles.safetyGroups}>
                                <div>
                                    <h3>{ct('settings.blockedUsers')}</h3>
                                    {safety.blocked.length ? safety.blocked.map(name => (
                                        <div className={styles.safetyRow} key={name}>
                                            <Link to={`/users/${name}`}>@{name}</Link>
                                            <Button
                                                busy={safetyBusy === `blocked:${name}`}
                                                busyLabel={ct('settings.removing')}
                                                disabled={Boolean(safetyBusy)}
                                                onClick={() => removeSafetyEntry('blocked', name)}
                                            >
                                                {ct('settings.unblock')}
                                            </Button>
                                        </div>
                                    )) : <p className={styles.note}>{ct('settings.noBlocked')}</p>}
                                </div>
                                <div>
                                    <h3>{ct('settings.mutedUsers')}</h3>
                                    {safety.muted.length ? safety.muted.map(name => (
                                        <div className={styles.safetyRow} key={name}>
                                            <Link to={`/users/${name}`}>@{name}</Link>
                                            <Button
                                                busy={safetyBusy === `muted:${name}`}
                                                busyLabel={ct('settings.removing')}
                                                disabled={Boolean(safetyBusy)}
                                                onClick={() => removeSafetyEntry('muted', name)}
                                            >
                                                {ct('settings.unmute')}
                                            </Button>
                                        </div>
                                    )) : <p className={styles.note}>{ct('settings.noMuted')}</p>}
                                </div>
                            </div> : null}
                            <p className={styles.note}>{ct('settings.safetyContact')} <Link to="/support?topic=safety">{ct('settings.contactSupport')}</Link>.</p>
                        </section>
                    ) : null}

                    {activeSection === 'data' ? (
                        <section className={styles.card}>
                            <h2>{t('mw.community.settings.data', 'Your MistWarp data')}</h2>
                            <p className={styles.lead}>{ct('settings.dataLead')}</p>
                            <div className={styles.dataAction}>
                                <div>
                                    <h3>{t('settings.analytics')}</h3>
                                    <p>{t('settings.analyticsHelp')}</p>
                                </div>
                                <Switch
                                    ariaLabel={t('settings.analytics')}
                                    checked={shareAnalytics}
                                    onChange={changeAnalytics}
                                />
                            </div>
                            {!user ? (
                                <Button className={styles.riskAction} onClick={login}>{t('home.signin')}</Button>
                            ) : (
                                <React.Fragment>
                                    <div className={styles.dataAction}>
                                        <div>
                                            <h3>{ct('settings.downloadData')}</h3>
                                            <p>{ct('settings.downloadDataHelp')}</p>
                                        </div>
                                        <Button
                                            busy={dataBusy === 'export'}
                                            busyLabel={ct('settings.preparing')}
                                            disabled={Boolean(dataBusy)}
                                            onClick={downloadData}
                                        >
                                            {ct('common.download')}
                                        </Button>
                                    </div>
                                    <div className={styles.dangerZone}>
                                        <h3>{ct('settings.deleteData')}</h3>
                                        <p>{ct('settings.deleteDataHelp')}</p>
                                        <label className={styles.field}>
                                            {ct('settings.typeToConfirm')} <strong>{user.username}</strong>
                                            <input
                                                className={styles.input}
                                                disabled={Boolean(dataBusy)}
                                                value={deleteConfirmation}
                                                onChange={event => setDeleteConfirmation(event.target.value)}
                                            />
                                        </label>
                                        <Button
                                            variant="danger"
                                            className={styles.deleteButton}
                                            disabled={Boolean(dataBusy) ||
                                                !matchesDeleteConfirmation(deleteConfirmation, user.username)}
                                            onClick={openDeleteModal}
                                        >
                                            {ct('settings.deleteDataButton')}
                                        </Button>
                                    </div>
                                </React.Fragment>
                            )}
                            {dataStatus && !deleteModalOpen ? <p className={styles.note} aria-live="polite">{dataStatus}</p> : null}
                            <p className={styles.note}>{ct('settings.privacyTerms')} <Link to="/trust">{ct('settings.privacyTermsLink')}</Link>, {ct('settings.manageRotur')} <a href="https://accounts.bilup.org/me" target="_blank" rel="noreferrer">{ct('settings.manageRoturLink')}</a>.</p>
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
            {deleteModalOpen && user ? (
                <Modal
                    icon={Trash2}
                    title={ct('settings.deleteModalTitle')}
                    onClose={closeDeleteModal}
                    dismissDisabled={dataBusy === 'delete'}
                    actions={(
                        <React.Fragment>
                            <Button
                                variant="danger"
                                className={styles.deleteButton}
                                busy={dataBusy === 'delete'}
                                busyLabel={ct('settings.deleting')}
                                onClick={deleteData}
                            >
                                {ct('settings.deletePermanently')}
                            </Button>
                            <Button
                                disabled={dataBusy === 'delete'}
                                onClick={closeDeleteModal}
                            >
                                {ct('common.cancel')}
                            </Button>
                        </React.Fragment>
                    )}
                >
                    <p className={styles.modalText}>
                        {ct('settings.deleteModalText1')} <strong>{user.username}</strong>.
                        {' '}{ct('settings.deleteModalText2')}
                    </p>
                    {dataStatus ? <p className={styles.note} aria-live="polite">{dataStatus}</p> : null}
                </Modal>
            ) : null}
        </main>
    );
};

export {settingsSection, settingsThemeTab, getProjectThemeMode, matchesDeleteConfirmation};
export default Settings;