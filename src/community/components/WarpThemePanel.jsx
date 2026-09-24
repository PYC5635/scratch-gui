/* eslint-disable react/jsx-no-bind, no-alert */
import PropTypes from 'prop-types';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from '../../lib/tw-use-intl.jsx';
import {
    ArrowLeft, BookmarkPlus, Check, Download, Edit3, Flag, Heart, LogIn,
    Palette, Search, Shield, Trash2, User, X
} from 'lucide-react';
import {useUser} from '../UserContext.jsx';
import {
    API, TOKEN_MANAGER, request, openSession, storeToken, gradientStyle
} from '../../lib/warptheme.js';
import {CustomTheme, customThemeManager} from '../../lib/themes/custom-themes.js';
import styles from './WarpThemePanel.module.css';

const TABS = [
    {key: 'browse', label: 'Browse', icon: Search}
];

const ThemeCard = ({onOpen, theme}) => (
    <button
        className={styles.themeCard}
        onClick={() => onOpen(theme)}
        type="button"
    >
        <span
            className={styles.themeHeader}
            style={gradientStyle(theme)}
        />
        <span className={styles.themeContent}>
            <strong className={styles.themeName}>{theme.name}</strong>
            <span className={styles.themeAuthor}>by {theme.authorUsername || theme.author}</span>
            <span className={styles.themeStats}>
                <span><Heart size={12} /> {theme.likes || 0}</span>
                <span><Download size={12} /> {theme.downloads || 0}</span>
                <span>{theme.platform}</span>
            </span>
        </span>
    </button>
);

ThemeCard.propTypes = {
    onOpen: PropTypes.func.isRequired,
    theme: PropTypes.object.isRequired
};

const WarpThemePanel = ({onThemeChange}) => {
    const intl = useIntl();
    const t = (id, defaultMessage, values) => intl.formatMessage({id, defaultMessage}, values);
    const {user, login} = useUser();
    const [account, setAccount] = useState(null);
    const [token, setToken] = useState(null);
    const [themes, setThemes] = useState([]);
    const [reports, setReports] = useState([]);
    const [tab, setTab] = useState('browse');
    const [selected, setSelected] = useState(null);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('newest');
    const [platform, setPlatform] = useState('all');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [permissionMissing, setPermissionMissing] = useState(false);
    const [sessionAttempt, setSessionAttempt] = useState(0);
    const [notice, setNotice] = useState('');
    const [editing, setEditing] = useState(null);
    const [reporting, setReporting] = useState(null);
    const [reportReason, setReportReason] = useState('');
    const [savedIds, setSavedIds] = useState(() => new Set());

    // Tracks whether the panel is still mounted so async callbacks (network
    // requests, modal close) do not call setState after unmount.
    const mountedRef = useRef(true);
    useEffect(() => () => {
        mountedRef.current = false;
    }, []);

    const username = user && user.username;

    // Resolve the BilupTheme account id defensively: the backend returns it at
    // the top level of /user, but also nests it inside user, so fall back if the
    // deployed backend omits one of the two shapes.
    const getUserId = useCallback(account => (
        (account && (account.userId || (account.user && account.user.userId))) || ''
    ), []);

    const loadThemes = useCallback(async sessionToken => {
        const data = await request('/themes', sessionToken);
        if (mountedRef.current) setThemes(data.themes || []);
    }, []);

    const loadReports = useCallback(async sessionToken => {
        const data = await request('/admin/reports?status=open', sessionToken);
        if (mountedRef.current) setReports(data.reports || []);
    }, []);

    useEffect(() => {
        let active = true;
        if (!username) {
            storeToken(null);
            setAccount(null);
            setToken(null);
            return;
        }
        setBusy(true);
        setError('');
        setPermissionMissing(false);
        openSession(username)
            .then(async session => {
                if (!active) return;
                setAccount(session);
                setToken(session.token);
                await Promise.all([
                    loadThemes(session.token),
                    session.isAdmin ? loadReports(session.token) : Promise.resolve()
                ]);
            })
            .catch(err => {
                if (!active) return;
                setPermissionMissing(err.code === 'validator-permission');
                setError(err.message);
            })
            .finally(() => active && setBusy(false));
        return () => {
            active = false;
        };
    }, [getUserId, loadReports, loadThemes, username, sessionAttempt]);

    const refresh = async () => {
        await Promise.all([
            loadThemes(token),
            account && account.isAdmin ? loadReports(token) : Promise.resolve()
        ]);
    };

    const visibleThemes = useMemo(() => {
        const query = search.trim().toLowerCase();
        return themes
            .filter(item => platform === 'all' || item.platform === platform)
            .filter(item => !query || [item.name, item.description, item.authorUsername]
                .some(value => String(value || '').toLowerCase()
                    .includes(query)))
            .sort((a, b) => {
                if (sort === 'likes') return (b.likes || 0) - (a.likes || 0);
                if (sort === 'name') return a.name.localeCompare(b.name);
                return Number(b.createdAt || 0) - Number(a.createdAt || 0);
            });
    }, [platform, search, sort, themes]);

    const run = async action => {
        setBusy(true);
        setError('');
        try {
            await action();
        } catch (err) {
            if (mountedRef.current) setError(err.message);
        } finally {
            if (mountedRef.current) setBusy(false);
        }
    };

    const fetchSelectedExport = async () => {
        // Use the raw /theme endpoint instead of /theme/export: the latter
        // flattens the theme and drops gui/blocks, which CustomTheme.import()
        // requires. /theme returns the stored record whose `.theme` field holds
        // the original editor/CustomTheme export. cache: no-store avoids a stale
        // 304 revalidation failing the request.
        const response = await fetch(
            `${API}/theme?uuid=${encodeURIComponent(selected.uuid)}`,
            {headers: {Authorization: `Bearer ${token}`}, cache: 'no-store'}
        );
        if (!response.ok) throw new Error('Failed to load this theme.');
        const payload = await response.json().catch(() => null);
        if (!payload || typeof payload !== 'object') throw new Error('Invalid theme data format');
        return (payload.theme && payload.theme.theme) || payload;
    };

    const applySelected = () => run(async () => {
        const data = await fetchSelectedExport();
        if (!data || typeof data !== 'object' || Array.isArray(data) ||
            !data.name || !data.gui || !data.blocks) {
            throw new Error('Invalid theme data format');
        }
        onThemeChange(CustomTheme.import(data));
        if (mountedRef.current) {
            setNotice(t('mw.community.biluptheme.applied', 'Applied "{name}".', {name: data.name}));
        }
    });

    const saveSelectedToLibrary = () => run(async () => {
        if (savedIds.has(selected.uuid)) return;
        const data = await fetchSelectedExport();
        const saved = customThemeManager.addFromExportData(data, {
            name: selected.name,
            description: selected.description || '',
            author: selected.authorUsername || selected.author || 'BilupTheme'
        });
        if (mountedRef.current) {
            setSavedIds(prev => new Set(prev).add(selected.uuid));
            setNotice(t('mw.community.biluptheme.addedToLibrary', '"{name}" added to your custom theme library.', {name: saved.name}));
        }
    });

    const saveEdit = () => run(async () => {
        await request('/theme/name', token, {
            method: 'PUT',
            body: JSON.stringify({uuid: editing.uuid, name: editing.name, description: editing.description})
        });
        if (mountedRef.current) {
            setEditing(null);
            setSelected(null);
        }
        await refresh();
    });

    const deleteTheme = item => {
        if (!window.confirm(t('mw.community.biluptheme.deleteConfirm', 'Delete "{name}"? This cannot be undone.', {name: item.name}))) return;
        run(async () => {
            await request(`/theme?uuid=${encodeURIComponent(item.uuid)}`, token, {method: 'DELETE'});
            if (mountedRef.current) setSelected(null);
            await refresh();
        });
    };

    const submitReport = () => run(async () => {
        await request('/report', token, {
            method: 'POST',
            body: JSON.stringify({uuid: reporting.uuid, reason: reportReason})
        });
        if (mountedRef.current) {
            setReporting(null);
            setReportReason('');
            setNotice(t('mw.community.biluptheme.reportSent', 'Report sent. Thanks for helping keep BilupTheme safe.'));
        }
    });

    const resolveReport = (report, action) => run(async () => {
        await request('/admin/report/resolve', token, {
            method: 'POST',
            body: JSON.stringify({id: report.id, action})
        });
        if (mountedRef.current && action === 'delete-theme') setSelected(null);
        await refresh();
    });

    const goToTab = nextTab => {
        setTab(nextTab);
        setSelected(null);
        setEditing(null);
        setReporting(null);
        setNotice('');
    };

    if (!username) {
        return (
            <div className={styles.gate}>
                <User size={26} />
                <h3>{t('mw.community.biluptheme.signInTitle', 'Sign in to BilupTheme')}</h3>
                <p>{t('mw.community.biluptheme.signInBody', 'The theme marketplace uses your Bilup Accounts account for uploads, reports, and ownership.')}</p>
                <button
                    className={styles.primaryButton}
                    onClick={login}
                    type="button"
                >
                    <LogIn size={15} /> {t('mw.community.biluptheme.signInWithRotur', 'Sign in with Bilup Accounts')}
                </button>
            </div>
        );
    }

    if (permissionMissing) {
        return (
            <div className={styles.gate}>
                <Shield size={26} />
                <h3>{t('mw.community.biluptheme.permissionTitle', 'BilupTheme needs one more permission')}</h3>
                <p>
                    {t('mw.community.biluptheme.permissionBody1', 'Edit your current token in Bilup Accounts Token Manager and enable')}
                    {' '}<strong>validators:generate</strong>. {t('mw.community.biluptheme.permissionBody2', 'Then return here and retry.')}
                </p>
                <div className={styles.gateActions}>
                    <a
                        className={styles.primaryButton}
                        href={TOKEN_MANAGER}
                        target="_blank"
                        rel="noreferrer"
                    >{t('mw.community.biluptheme.openTokenManager', 'Open Token Manager')}</a>
                    <button
                        className={styles.secondaryButton}
                        onClick={() => setSessionAttempt(value => value + 1)}
                        type="button"
                    >{t('mw.community.biluptheme.retry', 'Retry')}</button>
                </div>
            </div>
        );
    }

    if (!account) {
        return (
            <div className={styles.gate}>
                {busy ? (
                    <p>{t('mw.community.biluptheme.connecting', 'Connecting to BilupTheme…')}</p>
                ) : (
                    <React.Fragment>
                        <X size={26} />
                        <h3>{t('mw.community.biluptheme.couldNotConnect', 'Could not connect to BilupTheme')}</h3>
                        <p>{error}</p>
                        <button
                            className={styles.primaryButton}
                            onClick={() => setSessionAttempt(value => value + 1)}
                            type="button"
                        >{t('mw.community.biluptheme.retry', 'Retry')}</button>
                    </React.Fragment>
                )}
            </div>
        );
    }

    const tabLabel = (key, fallback) => t(`mw.community.biluptheme.tab.${key}`, fallback);
    const tabs = (account.isAdmin ? [...TABS, {key: 'admin', label: 'Reports', icon: Shield}] : TABS)
        .map(item => ({...item, label: tabLabel(item.key, item.label)}));

    const myUserId = getUserId(account);

    const detail = selected && (
        <div className={styles.detail}>
            <button
                className={styles.backButton}
                onClick={() => {
                    setSelected(null);
                    setEditing(null);
                    setReporting(null);
                    setNotice('');
                }}
                type="button"
            ><ArrowLeft size={15} /> {t('mw.community.biluptheme.back', 'Back')}</button>
            <div
                className={styles.detailBanner}
                style={gradientStyle(selected)}
            />
            <h3>{selected.name}</h3>
            <p className={styles.byline}>
                {t('mw.community.biluptheme.by', 'by {author} · {platform}', {
                    author: selected.authorUsername || selected.author,
                    platform: selected.platform
                })}
            </p>
            <p>{selected.description || t('mw.community.biluptheme.noDescription', 'No description provided.')}</p>
            <div className={styles.detailStats}>
                <span><Heart size={14} /> {selected.likes || 0}</span>
                <span><Download size={14} /> {selected.downloads || 0}</span>
            </div>
            <div className={styles.detailActions}>
                <button
                    className={styles.primaryButton}
                    disabled={busy}
                    onClick={applySelected}
                    type="button"
                ><Palette size={14} /> {t('mw.community.biluptheme.applyTheme', 'Apply theme')}</button>
                <button
                    className={styles.secondaryButton}
                    disabled={busy || savedIds.has(selected.uuid)}
                    onClick={saveSelectedToLibrary}
                    type="button"
                >
                    {savedIds.has(selected.uuid) ? (
                        <React.Fragment><Check size={14} /> {t('mw.community.biluptheme.inLibrary', 'In library')}</React.Fragment>
                    ) : (
                        <React.Fragment><BookmarkPlus size={14} /> {t('mw.community.biluptheme.addToLibrary', 'Add to library')}</React.Fragment>
                    )}
                </button>
                <button
                    className={styles.secondaryButton}
                    onClick={() => setReporting(selected)}
                    type="button"
                ><Flag size={14} /> {t('mw.community.biluptheme.report', 'Report')}</button>
                {myUserId && selected.author === myUserId && (
                    <button
                        className={styles.secondaryButton}
                        onClick={() => setEditing({...selected})}
                        type="button"
                    ><Edit3 size={14} /> {t('mw.community.biluptheme.edit', 'Edit')}</button>
                )}
                {((myUserId && selected.author === myUserId) || account.isAdmin) && (
                    <button
                        className={styles.dangerButton}
                        onClick={() => deleteTheme(selected)}
                        type="button"
                    ><Trash2 size={14} /> {t('mw.community.biluptheme.delete', 'Delete')}</button>
                )}
            </div>

            {editing && (
                <form
                    className={styles.inlineForm}
                    onSubmit={event => {
                        event.preventDefault();
                        saveEdit();
                    }}
                >
                    <label>{t('mw.community.biluptheme.name', 'Name')}<input
                        required
                        maxLength="100"
                        value={editing.name}
                        onChange={e => setEditing({...editing, name: e.target.value})}
                    /></label>
                    <label>{t('mw.community.biluptheme.description', 'Description')}<textarea
                        maxLength="500"
                        value={editing.description}
                        onChange={e => setEditing({...editing, description: e.target.value})}
                    /></label>
                    <div className={styles.formActions}>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => setEditing(null)}
                        >{t('mw.community.biluptheme.cancel', 'Cancel')}</button>
                        <button
                            className={styles.primaryButton}
                            disabled={busy}
                            type="submit"
                        ><Check size={14} /> {t('mw.community.biluptheme.save', 'Save')}</button>
                    </div>
                </form>
            )}

            {reporting && (
                <form
                    className={styles.inlineForm}
                    onSubmit={event => {
                        event.preventDefault();
                        submitReport();
                    }}
                >
                    <label>{t('mw.community.biluptheme.whatWrong', 'What is wrong with this theme?')}<textarea
                        required
                        maxLength="500"
                        value={reportReason}
                        onChange={e => setReportReason(e.target.value)}
                    /></label>
                    <div className={styles.formActions}>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => setReporting(null)}
                        >{t('mw.community.biluptheme.cancel', 'Cancel')}</button>
                        <button
                            className={styles.dangerButton}
                            disabled={busy || !reportReason.trim()}
                            type="submit"
                        ><Flag size={14} /> {t('mw.community.biluptheme.sendReport', 'Send report')}</button>
                    </div>
                </form>
            )}
        </div>
    );

    const browser = tab === 'browse' && !selected && (
        <React.Fragment>
            <div className={styles.toolbar}>
                <div className={styles.searchBox}>
                    <Search size={15} />
                    <input
                        aria-label={t('mw.community.biluptheme.searchThemes', 'Search themes')}
                        placeholder={t('mw.community.biluptheme.searchThemes', 'Search themes or creators')}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    aria-label={t('mw.community.biluptheme.sortThemes', 'Sort themes')}
                    value={sort}
                    onChange={e => setSort(e.target.value)}
                >
                    <option value="newest">{t('mw.community.biluptheme.sortNewest', 'Newest')}</option>
                    <option value="likes">{t('mw.community.biluptheme.sortLikes', 'Most liked')}</option>
                    <option value="name">{t('mw.community.biluptheme.sortName', 'Name')}</option>
                </select>
                <select
                    aria-label={t('mw.community.biluptheme.filterPlatform', 'Filter platform')}
                    value={platform}
                    onChange={e => setPlatform(e.target.value)}
                >
                    <option value="all">{t('mw.community.biluptheme.allPlatforms', 'All platforms')}</option>
                    <option value="bilup">Bilup</option>
                </select>
            </div>
            {visibleThemes.length === 0 ? (
                <div className={styles.empty}>
                    <Search size={24} />
                    <p>{t('mw.community.biluptheme.noThemes', 'No themes found.')}</p>
                </div>
            ) : (
                <div className={styles.grid}>
                    {visibleThemes.map(item => (
                        <ThemeCard
                            key={item.uuid}
                            theme={item}
                            onOpen={setSelected}
                        />
                    ))}
                </div>
            )}
        </React.Fragment>
    );

    const adminPage = tab === 'admin' && (
        <div className={styles.reportList}>
            {reports.length === 0 ? (
                <div className={styles.empty}>
                    <Shield size={24} />
                    <p>{t('mw.community.biluptheme.noReports', 'No open reports.')}</p>
                </div>
            ) : reports.map(report => (
                <article
                    className={styles.report}
                    key={report.id}
                >
                    <div>
                        <strong>{report.themeName}</strong>
                        <p>{report.reason}</p>
                        <small>{t('mw.community.biluptheme.reportedBy', 'Reported by {name}', {name: report.reporterName})}</small>
                    </div>
                    <div className={styles.formActions}>
                        <button
                            className={styles.secondaryButton}
                            onClick={() => resolveReport(report, 'dismiss')}
                            type="button"
                        ><Check size={14} /> {t('mw.community.biluptheme.dismiss', 'Dismiss')}</button>
                        <button
                            className={styles.dangerButton}
                            onClick={() => resolveReport(report, 'delete-theme')}
                            type="button"
                        ><Trash2 size={14} /> {t('mw.community.biluptheme.deleteTheme', 'Delete theme')}</button>
                    </div>
                </article>
            ))}
        </div>
    );

    return (
        <div className={styles.panel}>
            <div
                className={styles.tabs}
                role="tablist"
            >
                {tabs.map(item => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.key}
                            role="tab"
                            type="button"
                            aria-selected={tab === item.key}
                            className={tab === item.key ? styles.tabActive : styles.tab}
                            onClick={() => goToTab(item.key)}
                        >
                            <Icon size={15} />
                            <span>{item.label}</span>
                            {item.key === 'admin' && reports.length > 0 && (
                                <span className={styles.tabBadge}>{reports.length}</span>
                            )}
                        </button>
                    );
                })}
            </div>

                    {error && (
                        <div className={styles.error}>
                            {error}
                            <button
                                onClick={() => setError('')}
                                type="button"
                                aria-label={t('mw.community.biluptheme.dismissError', 'Dismiss error')}
                            ><X size={14} /></button>
                        </div>
                    )}
            {notice && !error && (
                <div className={styles.notice}>{notice}</div>
            )}

            {detail || browser || adminPage}
        </div>
    );
};

WarpThemePanel.propTypes = {
    onThemeChange: PropTypes.func.isRequired
};

export default WarpThemePanel;
