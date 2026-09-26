import React, {useEffect, useState, useCallback} from 'react';
import {Link} from 'react-router-dom';
import {useIntl} from '../../lib/tw-use-intl.jsx';
import {Flag, User, FolderOpen, Ban, ShieldCheck, BarChart3, AlertTriangle, Puzzle} from 'lucide-react';
import api, {projectUrl, embedUrl} from '../api';
import {useUser} from '../UserContext.jsx';
import Avatar from '../components/Avatar.jsx';
import {formatDateTime, formatBytes} from '../format';
import useLatest from '../use-latest.js';
import styles from './Admin.module.css';

const STANDING_LEVELS = ['good', 'warning', 'suspended', 'banned'];

const SECTIONS = [
    {key: 'overview', labelKey: 'mw.community.admin.section.overview', labelDefault: 'Overview', icon: BarChart3},
    {key: 'reports', labelKey: 'mw.community.admin.section.reports', labelDefault: 'Reports', icon: Flag},
    {key: 'users', labelKey: 'mw.community.admin.section.users', labelDefault: 'Users', icon: User},
    {key: 'projects', labelKey: 'mw.community.admin.section.projects', labelDefault: 'Projects', icon: FolderOpen},
    {key: 'extensions', labelKey: 'mw.community.admin.section.extensions', labelDefault: 'Extensions', icon: Puzzle},
    {key: 'bans', labelKey: 'mw.community.admin.section.bans', labelDefault: 'Bans', icon: Ban},
    {key: 'admins', labelKey: 'mw.community.admin.section.admins', labelDefault: 'Admins', icon: ShieldCheck}
];

const dayLabel = dayNumber => {
    const d = new Date(dayNumber * 86400000);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};

const buildSeries = (byDay, days) => {
    const today = Math.floor(Date.now() / 86400000);
    return Array.from({length: days}, (unused, idx) => {
        const dayNumber = today - (days - 1 - idx);
        return {label: dayLabel(dayNumber), value: (byDay && byDay[String(dayNumber)]) || 0};
    });
};

const StatTile = ({label, value}) => (
    <div className={styles.statTile}>
        <span className={styles.statValue}>{value}</span>
        <span className={styles.statLabel}>{label}</span>
    </div>
);

const MiniChart = ({title, series}) => {
    const max = series.reduce((m, point) => Math.max(m, point.value), 0);
    return (
        <div className={styles.chart}>
            <h3 className={styles.chartTitle}>{title}</h3>
            <div className={styles.chartBars}>
                {series.map((point, idx) => (
                    <div
                        key={idx}
                        className={styles.chartCol}
                        title={`${point.label}: ${point.value}`}
                    >
                        <div
                            className={styles.chartBar}
                            style={{height: `${max ? (point.value / max) * 100 : 0}%`}}
                        />
                        <span className={styles.chartLabel}>{point.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const QuotaTile = ({quota}) => {
    const intl = useIntl();
    const t = (id, defaultMessage, values) => intl.formatMessage({id, defaultMessage}, values);
    const pct = (quota.used / quota.limit) * 100;
    return (
        <div className={styles.statTile}>
            <span className={styles.statValue}>{formatBytes(quota.used)}</span>
            <span className={styles.statLabel}>{t('mw.community.admin.ofUsed', 'of {limit} used', {limit: formatBytes(quota.limit)})}</span>
            <div className={styles.quotaBarBg}>
                <div
                    className={styles.quotaBarFill}
                    style={{width: `${Math.min(100, pct)}%`}}
                />
            </div>
            <span className={pct >= 80 ? styles.quotaWarnText : styles.quotaPctText}>
                {pct >= 80 ? <AlertTriangle size={14} /> : null}{t('mw.community.admin.percentFull', '{percent}% full', {percent: Math.round(pct)})}
            </span>
        </div>
    );
};

const num = v => Number(v || 0).toLocaleString();

const StatsOverview = () => {
    const intl = useIntl();
    const t = (id, defaultMessage, values) => intl.formatMessage({id, defaultMessage}, values);
    const [stats, setStats] = useState(null);
    const [quota, setQuota] = useState(null);
    const [error, setError] = useState('');
    const [payoutBusy, setPayoutBusy] = useState(false);
    const [payoutNote, setPayoutNote] = useState('');

    useEffect(() => {
        api.admin.stats()
            .then(setStats)
            .catch(e => setError(e.message || t('mw.community.admin.couldNotLoadStats', 'Could not load stats.')));
        api.quota()
            .then(setQuota)
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const retryPayouts = async () => {
        if (payoutBusy) return;
        setPayoutBusy(true);
        setPayoutNote('');
        try {
            const result = await api.admin.retryPayouts();
            setPayoutNote(t('mw.community.admin.paidNote', 'Paid {paid}, {remaining} still pending.', {
                paid: result.paid,
                remaining: result.remaining
            }));
            const fresh = await api.admin.stats();
            setStats(fresh);
        } catch (e) {
            setPayoutNote(e.message || t('mw.community.admin.couldNotRetry', 'Could not retry payouts.'));
        } finally {
            setPayoutBusy(false);
        }
    };

    if (error) {
        return <div><h2>{t('mw.community.admin.overview', 'Overview')}</h2><p className={styles.error}>{error}</p></div>;
    }
    if (!stats) {
        return <div><h2>{t('mw.community.admin.overview', 'Overview')}</h2><p className={styles.status}>{t('mw.community.admin.loading', 'Loading…')}</p></div>;
    }
    return (
        <div>
            <h2>{t('mw.community.admin.overview', 'Overview')}</h2>

            {stats.pendingPayouts > 0 ? (
                <div className={styles.quotaWarning}>
                    <AlertTriangle size={14} /> {t('mw.community.admin.pendingPayouts',
                        '{count} creator payouts failed and are owed ({amount} credits total).', {
                            count: stats.pendingPayouts,
                            amount: Math.round((stats.pendingPayoutAmount || 0) * 100) / 100
                        })}{' '}
                    <button
                        className={styles.secondary}
                        onClick={retryPayouts}
                        disabled={payoutBusy}
                    >{payoutBusy ?
                        t('mw.community.admin.retrying', 'Retrying…') :
                        t('mw.community.admin.retryNow', 'Retry now')}</button>
                    {payoutNote ? <span>{` ${payoutNote}`}</span> : null}
                </div>
            ) : null}

            {quota && (quota.used / quota.limit) * 100 >= 80 ? (
                <p className={styles.quotaWarning}>
                    <AlertTriangle size={14} /> {t('mw.community.admin.quotaWarning',
                        'You\'ve used {used} of your {limit} upload quota ({percent}%).', {
                            used: formatBytes(quota.used),
                            limit: formatBytes(quota.limit),
                            percent: Math.round((quota.used / quota.limit) * 100)
                        })}{' '}
                    {quota.used >= quota.limit ?
                        t('mw.community.admin.quotaWarningFull', 'You cannot upload new projects until usage drops.') :
                        t('mw.community.admin.quotaWarningManage', 'Consider managing your projects to free up space.')}
                </p>
            ) : null}

            <div className={styles.statGrid}>
                <StatTile label={t('mw.community.admin.projects', 'Projects')} value={num(stats.totalProjects)} />
                <StatTile label={t('mw.community.admin.shared', 'Shared')} value={num(stats.sharedProjects)} />
                <StatTile label={t('mw.community.admin.unshared', 'Unshared')} value={num(stats.unsharedProjects)} />
                <StatTile label={t('mw.community.admin.users', 'Users')} value={num(stats.totalUsers)} />
                <StatTile label={t('mw.community.admin.storageUsed', 'Storage used')} value={formatBytes(stats.totalBytes)} />
                <StatTile label={t('mw.community.admin.totalViews', 'Total views')} value={num(stats.totalViews)} />
                <StatTile label={t('mw.community.admin.totalLoves', 'Total loves')} value={num(stats.totalLoves)} />
                <StatTile label={t('mw.community.admin.activeSessions', 'Active sessions')} value={num(stats.activeSessions)} />
                <StatTile label={t('mw.community.admin.openReports', 'Open reports')} value={num(stats.openReports)} />
                <StatTile label={t('mw.community.admin.bannedUsers', 'Banned users')} value={num(stats.bannedUsers)} />
                <StatTile label={t('mw.community.admin.newsPosts', 'News posts')} value={num(stats.newsPosts)} />
                {quota ? <QuotaTile quota={quota} /> : null}
            </div>
            <div className={styles.charts}>
                <MiniChart
                    title={t('mw.community.admin.projectsChart', 'Projects uploaded (14 days)')}
                    series={buildSeries(stats.projectsByDay, 14)}
                />
                <MiniChart
                    title={t('mw.community.admin.loginsChart', 'Logins (7 days)')}
                    series={buildSeries(stats.loginsByDay, 7)}
                />
            </div>
        </div>
    );
};

const ProjectManager = () => {
    const intl = useIntl();
    const t = (id, defaultMessage, values) => intl.formatMessage({id, defaultMessage}, values);
    const [query, setQuery] = useState('');
    const [projects, setProjects] = useState(null);
    const [error, setError] = useState('');
    const [note, setNote] = useState('');

    const search = useCallback(async q => {
        setError('');
        setNote('');
        try {
            const data = await api.admin.searchProjects(q || '');
            setProjects(data.projects || []);
        } catch (e) {
            setError(e.message || t('mw.community.admin.couldNotLoadProjects', 'Could not load projects.'));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        search('');
    }, [search]);

    const unshare = async id => {
        try {
            setError('');
            await api.unpublish(id);
            setNote(t('mw.community.admin.projectUnshared', 'Project unshared.'));
            search(query);
        } catch (e) {
            setError(e.message || t('mw.community.admin.couldNotUnshare', 'Could not unshare that project.'));
        }
    };

    const remove = async id => {
        if (!window.confirm(t('mw.community.admin.deleteConfirm', 'Delete this project? This cannot be undone.'))) return;
        try {
            setError('');
            await api.deleteProject(id);
            setNote(t('mw.community.admin.projectDeleted', 'Project deleted.'));
            search(query);
        } catch (e) {
            setError(e.message || t('mw.community.admin.couldNotDelete', 'Could not delete that project.'));
        }
    };

    return (
        <div>
            <h2>{t('mw.community.admin.projects', 'Projects')}</h2>
            <div className={styles.addAdmin}>
                <input
                    className={styles.input}
                    placeholder={t('mw.community.admin.searchProjectsPlaceholder', 'Search title, owner, or id')}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') search(query);
                    }}
                />
                <button
                    className={styles.secondary}
                    onClick={() => search(query)}
                >{t('mw.community.admin.search', 'Search')}</button>
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
            {note ? <p className={styles.status}>{note}</p> : null}
            {projects === null ? (
                <p className={styles.status}>{t('mw.community.admin.loading', 'Loading…')}</p>
            ) : projects.length ? (
                <div className={styles.list}>
                    {projects.map(project => (
                        <div
                            key={project.id}
                            className={styles.row}
                        >
                            <div className={styles.rowInfo}>
                                <span className={styles.rowTitle}>
                                    <Link to={projectUrl(project.id)}>{project.title || project.id}</Link>
                                </span>
                                <span className={styles.rowMeta}>
                                    {t('mw.community.admin.byOwnerShared', 'by @{owner} · {shared}', {
                                        owner: project.owner,
                                        shared: project.shared ?
                                            t('mw.community.admin.shared', 'Shared') :
                                            t('mw.community.admin.unshared', 'Unshared')
                                    })}
                                </span>
                            </div>
                            <div className={styles.rowActions}>
                                {project.shared ? (
                                    <button
                                        className={styles.secondary}
                                        onClick={() => unshare(project.id)}
                                    >{t('mw.community.admin.unshare', 'Unshare')}</button>
                                ) : null}
                                <button
                                    className={styles.danger}
                                    onClick={() => remove(project.id)}
                                >{t('mw.community.admin.delete', 'Delete')}</button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className={styles.status}>{t('mw.community.admin.noProjectsFound', 'No projects found.')}</p>
            )}
        </div>
    );
};

const UserDetailCard = ({username, onBack}) => {
    const intl = useIntl();
    const t = (id, defaultMessage, values) => intl.formatMessage({id, defaultMessage}, values);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [note, setNote] = useState('');
    const [level, setLevel] = useState('good');
    const [reasonText, setReasonText] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!username) return;
        setError('');
        setNote('');
        api.admin.getUser(username)
            .then(result => {
                setData(result);
                setLevel((result.standing && result.standing.level) || 'good');
                setReasonText('');
                setMessage('');
            })
            .catch(e => {
                setData(null);
                setError(e.message || t('mw.community.admin.couldNotLoadUser', 'Could not load that user.'));
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username]);

    const refresh = () => {
        if (!data) return;
        api.admin.getUser(data.username).then(setData).catch(() => {});
    };

    const applyStanding = async () => {
        if (!data) return;
        setError('');
        setNote('');
        try {
            await api.admin.setStanding(data.username, level, reasonText.trim());
            setNote(t('mw.community.admin.standingUpdated', 'Standing updated.'));
            refresh();
        } catch (e) {
            setError(e.message || t('mw.community.admin.actionFailed', 'Action failed.'));
        }
    };

    const sendMessage = async () => {
        if (!data || !message.trim()) return;
        setError('');
        setNote('');
        try {
            await api.admin.messageUser(data.username, message.trim());
            setNote(t('mw.community.admin.messageSent', 'Message sent.'));
            setMessage('');
        } catch (e) {
            setError(e.message || t('mw.community.admin.actionFailed', 'Action failed.'));
        }
    };

    const toggleComments = async () => {
        if (!data) return;
        setError('');
        setNote('');
        try {
            await api.admin.updateUserProfile(data.username, {commentsOff: !data.commentsOff});
            refresh();
        } catch (e) {
            setError(e.message || t('mw.community.admin.actionFailed', 'Action failed.'));
        }
    };

    const unshareProject = async pid => {
        try {
            await api.unpublish(pid);
            setNote(t('mw.community.admin.projectUnshared', 'Project unshared.'));
            refresh();
        } catch (e) {
            setError(e.message || t('mw.community.admin.couldNotUnshare', 'Could not unshare.'));
        }
    };

    const deleteProject = async pid => {
        if (!window.confirm(t('mw.community.admin.deleteConfirm', 'Delete this project? This cannot be undone.'))) return;
        try {
            await api.deleteProject(pid);
            setNote(t('mw.community.admin.projectDeleted', 'Project deleted.'));
            refresh();
        } catch (e) {
            setError(e.message || t('mw.community.admin.couldNotDelete', 'Could not delete.'));
        }
    };

    if (error) {
        return (
            <div>
                <p className={styles.error}>{error}</p>
                <button className={styles.secondary} onClick={onBack}>{t('mw.community.admin.backToList', 'Back to list')}</button>
            </div>
        );
    }
    if (!data) return <p className={styles.status}>{t('mw.community.admin.loadingUser', 'Loading user details…')}</p>;

    return (
        <div>
            <button className={styles.secondary} onClick={onBack} style={{marginBottom: 10}}>{t('mw.community.admin.backToList', '← Back to list')}</button>
            <div className={styles.userCard}>
                <div className={styles.userHead}>
                    <Avatar username={data.username} size={44} />
                    <div className={styles.rowInfo}>
                        <span className={styles.rowTitle}>
                            <Link to={`/users/${data.username}`}>{`@${data.username}`}</Link>
                            {data.admin ? <span className={styles.badge}>{t('mw.community.admin.adminBadge', 'admin')}</span> : null}
                            <span className={styles.badge}>{(data.standing && data.standing.level) || 'good'}</span>
                        </span>
                        <span className={styles.rowMeta}>
                            {t('mw.community.admin.followersFollowing', '{followers} followers · {following} following', {
                                followers: data.followerCount || 0,
                                following: data.followingCount || 0
                            })}
                        </span>
                    </div>
                </div>

                <label className={styles.fieldLabel}>{t('mw.community.admin.accountStanding', 'Account standing')}</label>
                <div className={styles.field}>
                    <select className={styles.select} value={level} onChange={e => setLevel(e.target.value)}>
                        {STANDING_LEVELS.map(l => (
                            <option key={l} value={l}>{l}</option>
                        ))}
                    </select>
                    <input
                        className={styles.input}
                        placeholder={t('mw.community.admin.reasonPlaceholder', 'Reason (shown to the user)')}
                        value={reasonText}
                        onChange={e => setReasonText(e.target.value)}
                    />
                    <button className={styles.secondary} onClick={applyStanding}>{t('mw.community.admin.apply', 'Apply')}</button>
                </div>

                <label className={styles.fieldLabel}>{t('mw.community.admin.sendMessageLabel', 'Send a message to their notifications')}</label>
                <div className={styles.field}>
                    <input
                        className={styles.input}
                        placeholder={t('mw.community.admin.messagePlaceholder', 'Message')}
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                    />
                    <button className={styles.secondary} disabled={!message.trim()} onClick={sendMessage}>{t('mw.community.admin.send', 'Send')}</button>
                </div>

                <button className={styles.secondary} onClick={toggleComments}>
                    {data.commentsOff ?
                        t('mw.community.admin.enableProfileComments', 'Enable profile comments') :
                        t('mw.community.admin.disableProfileComments', 'Disable profile comments')}
                </button>

                {data.quota ? (
                    <div className={styles.quota}>
                        <span className={styles.fieldLabel}>{t('mw.community.admin.uploadQuota', 'Upload quota')}</span>
                        <span className={styles.quotaBar}>
                            <span className={styles.quotaFillBg}>
                                <span
                                    className={styles.quotaFill}
                                    style={{width: `${Math.min(100, (data.quota.used / data.quota.limit) * 100)}%`}}
                                />
                            </span>
                            <span className={styles.quotaText}>
                                {t('mw.community.admin.quotaText', '{used} of {limit}', {
                                    used: formatBytes(data.quota.used),
                                    limit: formatBytes(data.quota.limit)
                                })}
                            </span>
                        </span>
                    </div>
                ) : null}

                {(data.projects || []).length ? (
                    <div className={styles.list}>
                        {data.projects.map(project => (
                            <div key={project.id} className={styles.row}>
                                <div className={styles.rowInfo}>
                                    <span className={styles.rowTitle}>
                                        <Link to={projectUrl(project.id)}>{project.title || project.id}</Link>
                                    </span>
                                    <span className={styles.rowMeta}>
                                        {project.shared ?
                                            t('mw.community.admin.shared', 'Shared') :
                                            t('mw.community.admin.notShared', 'Not shared')}
                                    </span>
                                </div>
                                <div className={styles.rowActions}>
                                    {project.shared ? (
                                        <button
                                            className={styles.secondary}
                                            onClick={() => unshareProject(project.id)}
                                        >{t('mw.community.admin.unshare', 'Unshare')}</button>
                                    ) : null}
                                    <button
                                        className={styles.danger}
                                        onClick={() => deleteProject(project.id)}
                                    >{t('mw.community.admin.delete', 'Delete')}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}

                {note ? <p className={styles.status} style={{marginTop: 8}}>{note}</p> : null}
            </div>
        </div>
    );
};

const UserManager = () => {
    const intl = useIntl();
    const t = (id, defaultMessage, values) => intl.formatMessage({id, defaultMessage}, values);
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        setLoading(true);
        setError('');
        api.admin.users()
            .then(data => {
                setUsers(data.users || []);
                setLoading(false);
            })
            .catch(e => {
                setError(e.message || t('mw.community.admin.couldNotLoadUsers', 'Could not load users.'));
                setLoading(false);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = query.trim() ?
        users.filter(u => u.username.toLowerCase().includes(query.toLowerCase())) :
        users;

    if (selected) {
        return (
            <div>
                <h2>{t('mw.community.admin.users', 'Users')}</h2>
                <UserDetailCard username={selected} onBack={() => setSelected(null)} />
            </div>
        );
    }

    return (
        <div>
            <h2>{t('mw.community.admin.users', 'Users')}</h2>
            <div className={styles.addAdmin}>
                <input
                    className={styles.input}
                    placeholder={t('mw.community.admin.filterPlaceholder', 'Filter by username…')}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                />
                <span className={styles.status} style={{fontSize: 13, alignSelf: 'center'}}>
                    {t('mw.community.admin.totalCount', '{count} total', {count: users.length})}
                </span>
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
            {loading ? (
                <p className={styles.status}>{t('mw.community.admin.loadingUsers', 'Loading users…')}</p>
            ) : filtered.length ? (
                <div className={styles.list}>
                    {filtered.map(user => {
                        const pct = user.quotaLimit > 0 ? (user.quotaUsed / user.quotaLimit) * 100 : 0;
                        return (
                            <div
                                key={user.username}
                                className={styles.row}
                                style={{cursor: 'pointer'}}
                                onClick={() => setSelected(user.username)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') setSelected(user.username);
                                }}
                            >
                                <Avatar username={user.username} size={32} />
                                <div className={styles.rowInfo}>
                                    <span className={styles.rowTitle}>
                                        {`@${user.username}`}
                                        {user.banned ? (
                                            <span
                                                className={styles.badge}
                                                style={{borderColor: '#e25555', color: '#e25555'}}
                                            >{t('mw.community.admin.banned', 'banned')}</span>
                                        ) : null}
                                    </span>
                                    <span className={styles.rowMeta}>
                                        {t('mw.community.admin.followersProjects', '{followers} followers · {projects} projects', {
                                            followers: user.followerCount,
                                            projects: user.projectCount
                                        })}
                                    </span>
                                </div>
                                <div className={styles.resetInfo}>
                                    <div className={styles.quotaBar}>
                                        <span className={styles.quotaFillBg} style={{width: 100}}>
                                            <span
                                                className={styles.quotaFill}
                                                style={{width: `${Math.min(100, pct)}%`}}
                                            />
                                        </span>
                                        <span className={styles.quotaText}>
                                            {formatBytes(user.quotaUsed)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className={styles.status}>{t('mw.community.admin.noMatch', 'No users match that filter.')}</p>
            )}
        </div>
    );
};

const EvidenceDetails = ({data}) => {
    const intl = useIntl();
    const t = (id, defaultMessage, values) => intl.formatMessage({id, defaultMessage}, values);
    const config = data.config || {};
    const buyers = config.buyers || [];
    const visibility = config.visibility || (config.shared ? 'public' : 'private');
    return (
        <div className={styles.evidenceBody}>
            <ul className={styles.evidenceMeta}>
                <li><strong>{t('mw.community.admin.evidenceTitle', 'Title')}:</strong> {` ${config.title || ''}`}</li>
                <li><strong>{t('mw.community.admin.evidenceOwner', 'Owner')}:</strong> {` @${config.owner || ''}`}</li>
                <li><strong>{t('mw.community.admin.evidencePrice', 'Price')}:</strong> {` ${config.price || 0} ${t('mw.community.admin.credits', 'credits')}`}</li>
                <li><strong>{t('mw.community.admin.evidenceVisibility', 'Visibility')}:</strong> {` ${visibility}`}</li>
                {config.revenue ? <li><strong>{t('mw.community.admin.evidenceRevenue', 'Revenue')}:</strong> {` ${config.revenue} ${t('mw.community.admin.credits', 'credits')}`}</li> : null}
                {buyers.length ? <li><strong>{t('mw.community.admin.evidenceBuyers', 'Buyers')}:</strong> {` ${buyers.length}`}</li> : null}
                {config.snapshotAt ? (
                    <li><strong>{t('mw.community.admin.evidenceCaptured', 'Captured')}:</strong> {` ${new Date(config.snapshotAt).toLocaleString()}`}</li>
                ) : null}
            </ul>
            {config.description ? <p className={styles.evidenceText}>{config.description}</p> : null}
            {config.instructions ? <p className={styles.evidenceText}>{config.instructions}</p> : null}
            <iframe
                className={styles.evidenceStage}
                src={embedUrl({projectJsonUrl: data.projectJsonUrl, assetsBase: data.assetsBase})}
                title="Reported project copy"
                sandbox="allow-scripts allow-pointer-lock"
            />
        </div>
    );
};

const EvidencePanel = ({target}) => {
    const intl = useIntl();
    const t = (id, defaultMessage, values) => intl.formatMessage({id, defaultMessage}, values);
    const [open, setOpen] = useState(false);
    const [state, setState] = useState({status: 'idle', data: null});
    const toggle = async () => {
        setOpen(value => !value);
        if (state.status !== 'idle') return;
        setState({status: 'loading', data: null});
        try {
            const result = await api.admin.reportEvidence(target);
            setState(result.exists ? {status: 'ready', data: result} : {status: 'none', data: null});
        } catch (e) {
            setState({status: 'none', data: null});
        }
    };
    return (
        <div className={styles.evidence}>
            <button
                className={styles.secondary}
                onClick={toggle}
            >{open ?
                t('mw.community.admin.hideCopy', 'Hide reported copy') :
                t('mw.community.admin.viewCopy', 'View reported copy')}</button>
            {open && state.status === 'loading' ? (
                <p className={styles.status}>{t('mw.community.admin.loading', 'Loading…')}</p>
            ) : null}
            {open && state.status === 'none' ? (
                <p className={styles.status}>{t('mw.community.admin.noCopy', 'No preserved copy for this report.')}</p>
            ) : null}
            {open && state.status === 'ready' ? (
                <EvidenceDetails data={state.data} />
            ) : null}
        </div>
    );
};

const ExtensionManager = () => {
    const intl = useIntl();
    const t = (id, defaultMessage, values) => intl.formatMessage({id, defaultMessage}, values);
    const [data, setData] = useState(null);
    const [tab, setTab] = useState('untrusted');
    const [error, setError] = useState('');
    const [note, setNote] = useState('');
    const [source, setSource] = useState(null);
    const [blockedUrl, setBlockedUrl] = useState('');
    const [query, setQuery] = useState('');

    const load = useCallback(() => {
        setError('');
        return api.admin.extensions()
            .then(setData)
            .catch(e => setError(e.message || t('mw.community.admin.couldNotLoadExtensions', 'Could not load extensions.')));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const setPolicy = async (hash, status) => {
        if (status === 'blocked' && !window.confirm(t('mw.community.admin.blockConfirm', 'Block this extension and unshare every project using it?'))) {
            return;
        }
        try {
            const result = await api.admin.setExtensionPolicy(hash, status);
            setNote(result.affected ?
                t('mw.community.admin.affectedNote', 'Made {count} affected projects private and notified their owners.', {count: result.affected}) :
                t('mw.community.admin.policyUpdated', 'Extension policy updated.'));
            setSource(null);
            setData(current => ({
                ...current,
                extensions: (current.extensions || []).map(extension => {
                    if (extension.hash === hash) return {...extension, status};
                    return extension;
                })
            }));
        } catch (e) {
            setError(e.message || t('mw.community.admin.couldNotUpdatePolicy', 'Could not update extension policy.'));
        }
    };

    const setUrlPolicy = async (url, blocked) => {
        if (blocked && !window.confirm(t('mw.community.admin.blockUrlConfirm', 'Block this URL and unshare every project using it?'))) return;
        try {
            const result = await api.admin.setExtensionUrlPolicy(url, blocked);
            setNote(result.affected ?
                t('mw.community.admin.affectedNote', 'Made {count} affected projects private and notified their owners.', {count: result.affected}) :
                t('mw.community.admin.urlUpdated', 'URL policy updated.'));
            setBlockedUrl('');
            setData(current => ({
                ...current,
                blockedUrls: blocked ?
                    [...new Set([...(current.blockedUrls || []), url])] :
                    (current.blockedUrls || []).filter(blockedEntry => blockedEntry !== url)
            }));
        } catch (e) {
            setError(e.message || t('mw.community.admin.couldNotUpdateUrl', 'Could not update URL policy.'));
        }
    };

    const viewSource = async hash => {
        try {
            setError('');
            setSource({hash, text: t('mw.community.admin.loading', 'Loading…')});
            setSource({hash, text: await api.admin.extensionSource(hash)});
        } catch (e) {
            setSource(null);
            setError(e.message || t('mw.community.admin.couldNotLoadSource', 'Could not load extension source.'));
        }
    };

    if (!data) {
        return (
            <div>
                <h2>{t('mw.community.admin.extensions', 'Extensions')}</h2>
                <p className={error ? styles.error : styles.status}>{error || t('mw.community.admin.loading', 'Loading…')}</p>
            </div>
        );
    }

    const allExtensions = data.extensions || [];
    const search = query.trim().toLowerCase();
    const extensions = allExtensions.filter(extension => {
        if (extension.status !== tab) return false;
        if (!search) return true;
        const metadata = extension.metadata || {};
        return [
            extension.hash,
            ...(extension.urls || []),
            metadata.name,
            metadata.id,
            metadata.description,
            metadata.author,
            metadata.license
        ].some(value => typeof value === 'string' && value.toLowerCase().includes(search));
    });
    const tabs = [
        {status: 'untrusted', label: t('mw.community.admin.tab.untrusted', 'To be verified')},
        {status: 'ignored', label: t('mw.community.admin.tab.ignored', 'Ignored')},
        {status: 'trusted', label: t('mw.community.admin.tab.trusted', 'Trusted')},
        {status: 'blocked', label: t('mw.community.admin.tab.blocked', 'Blocked')}
    ];

    return (
        <div>
            <h2>{t('mw.community.admin.extensions', 'Extensions')}</h2>
            <input
                type="search"
                className={`${styles.input} ${styles.extensionSearch}`}
                placeholder={t('mw.community.admin.searchExtensions', 'Search extensions')}
                aria-label={t('mw.community.admin.searchExtensions', 'Search extensions')}
                value={query}
                onChange={e => setQuery(e.target.value)}
            />
            <div className={styles.extensionTabs}>
                {tabs.map(item => (
                    <button
                        key={item.status}
                        className={tab === item.status ? styles.extensionTabActive : styles.extensionTab}
                        onClick={() => setTab(item.status)}
                    >
                        {`${item.label} (${
                            allExtensions.filter(extension => extension.status === item.status).length
                        })`}
                    </button>
                ))}
            </div>
            <div className={styles.addAdmin}>
                <input
                    className={styles.input}
                    placeholder={t('mw.community.admin.blockUrlPlaceholder', 'Block an extension URL')}
                    value={blockedUrl}
                    onChange={e => setBlockedUrl(e.target.value)}
                />
                <button
                    className={styles.danger}
                    onClick={() => blockedUrl.trim() && setUrlPolicy(blockedUrl.trim(), true)}
                >{t('mw.community.admin.blockUrl', 'Block URL')}</button>
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
            {note ? <p className={styles.status}>{note}</p> : null}
            {extensions.length ? (
                <div className={styles.list}>
                    {extensions.map(extension => (
                        <div
                            key={extension.hash}
                            className={styles.extensionRow}
                        >
                            <div className={styles.row}>
                                <div className={styles.rowInfo}>
                                    {extension.metadata && extension.metadata.name ? (
                                        <span className={styles.rowTitle}>{extension.metadata.name}</span>
                                    ) : null}
                                    {extension.metadata && extension.metadata.id ? (
                                        <span className={styles.rowMeta}>{t('mw.community.admin.extensionId', 'ID: {id}', {id: extension.metadata.id})}</span>
                                    ) : null}
                                    {extension.metadata && extension.metadata.description ? (
                                        <span className={styles.rowMeta}>{extension.metadata.description}</span>
                                    ) : null}
                                    {extension.metadata && extension.metadata.author ? (
                                        <span className={styles.rowMeta}>{t('mw.community.admin.extensionBy', 'By: {author}', {author: extension.metadata.author})}</span>
                                    ) : null}
                                    {extension.metadata && extension.metadata.license ? (
                                        <span className={styles.rowMeta}>
                                            {t('mw.community.admin.extensionLicense', 'License: {license}', {license: extension.metadata.license})}
                                        </span>
                                    ) : null}
                                    <span className={styles.extensionHash}>{extension.hash}</span>
                                    <span className={styles.rowMeta}>
                                        {t('mw.community.admin.usedIn', 'Used in {count} projects', {count: extension.projectCount})}
                                    </span>
                                    {extension.urls.map(url => (
                                        <span
                                            key={url}
                                            className={styles.extensionUrl}
                                        >
                                            {url}
                                            {!extension.gallery && /^https?:\/\//.test(url) ? (
                                                <button
                                                    className={styles.linkButton}
                                                    onClick={() => setUrlPolicy(url, true)}
                                                >{t('mw.community.admin.blockUrl', 'Block URL')}</button>
                                            ) : null}
                                        </span>
                                    ))}
                                </div>
                                <div className={styles.rowActions}>
                                    {extension.sourceAvailable ? (
                                        <button
                                            className={styles.secondary}
                                            onClick={() => viewSource(extension.hash)}
                                        >{t('mw.community.admin.viewSource', 'View source')}</button>
                                    ) : null}
                                    {!extension.gallery && tab !== 'trusted' ? (
                                        <button
                                            className={styles.secondary}
                                            onClick={() => setPolicy(extension.hash, 'trusted')}
                                        >{t('mw.community.admin.trust', 'Trust')}</button>
                                    ) : !extension.gallery ? (
                                        <button
                                            className={styles.secondary}
                                            onClick={() => setPolicy(extension.hash, 'untrusted')}
                                        >{t('mw.community.admin.untrust', 'Untrust')}</button>
                                    ) : null}
                                    {tab === 'untrusted' ? (
                                        <button
                                            className={styles.secondary}
                                            onClick={() => setPolicy(extension.hash, 'ignored')}
                                        >{t('mw.community.admin.ignore', 'Ignore')}</button>
                                    ) : tab === 'ignored' ? (
                                        <button
                                            className={styles.secondary}
                                            onClick={() => setPolicy(extension.hash, 'untrusted')}
                                        >{t('mw.community.admin.reviewAgain', 'Review again')}</button>
                                    ) : null}
                                    {!extension.gallery && tab !== 'blocked' ? (
                                        <button
                                            className={styles.danger}
                                            onClick={() => setPolicy(extension.hash, 'blocked')}
                                        >{t('mw.community.admin.blockHash', 'Block hash')}</button>
                                    ) : !extension.gallery ? (
                                        <button
                                            className={styles.secondary}
                                            onClick={() => setPolicy(extension.hash, 'untrusted')}
                                        >{t('mw.community.admin.unblock', 'Unblock')}</button>
                                    ) : null}
                                </div>
                            </div>
                            {source && source.hash === extension.hash ? (
                                <pre className={styles.extensionSource}>{source.text}</pre>
                            ) : null}
                        </div>
                    ))}
                </div>
            ) : (
                <p className={styles.status}>
                    {search ?
                        t('mw.community.admin.noMatching', 'No matching extensions.') :
                        (tab === 'untrusted' ?
                            t('mw.community.admin.noToVerify', 'No extensions to verify.') :
                            t('mw.community.admin.noTabHashes', 'No {tab} extension hashes.', {tab}))}
                </p>
            )}
            {tab === 'blocked' && data.blockedUrls && data.blockedUrls.length ? (
                <div className={styles.list}>
                    {data.blockedUrls.map(url => (
                        <div
                            key={url}
                            className={styles.row}
                        >
                            <span className={styles.extensionUrl}>{url}</span>
                            <button
                                className={styles.secondary}
                                onClick={() => setUrlPolicy(url, false)}
                            >{t('mw.community.admin.unblockUrl', 'Unblock URL')}</button>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
};

const Admin = () => {
    const intl = useIntl();
    const t = (id, defaultMessage, values) => intl.formatMessage({id, defaultMessage}, values);
    const {user, loading} = useUser();
    const [reports, setReports] = useState(null);
    const [bans, setBans] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [error, setError] = useState('');
    const [newAdmin, setNewAdmin] = useState('');
    const [active, setActive] = useState('overview');
    const beginLoad = useLatest();

    const load = useCallback(() => {
        const fresh = beginLoad();
        api.admin.reports()
            .then(fresh(data => setReports((data.reports || []).filter(report => !report.resolved))))
            .catch(fresh(e => setError(e.message || t('mw.community.admin.couldNotLoadReports', 'Could not load reports.'))));
        api.admin.bans()
            .then(fresh(data => setBans(data.bans || [])))
            .catch(() => {});
        api.admin.admins()
            .then(fresh(data => setAdmins(data.admins || [])))
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [beginLoad]);

    useEffect(() => {
        if (user && user.isAdmin) load();
    }, [user, load]);

    const act = async (id, action, reason) => {
        try {
            setError('');
            await api.admin.reportAction(id, action, reason);
            window.dispatchEvent(new Event('mw:reports-updated'));
            load();
        } catch (e) {
            setError(e.message || t('mw.community.admin.actionFailed', 'Action failed.'));
        }
    };

    const warnFromReport = report => {
        const reason = window.prompt(t('mw.community.admin.warnPrompt', 'Reason for the warning (shown to the user):'));
        if (reason === null) return; // cancelled
        act(report.id, 'warn_user', reason.trim());
    };

    const banFromReport = report => {
        const who = report.type === 'project' ?
            t('mw.community.admin.ownerOfProject', 'the owner of this project') :
            `@${report.target}`;
        if (!window.confirm(t('mw.community.admin.banWhoConfirm', 'Ban {who}? They will be locked out of Bilup until unbanned.', {who}))) return;
        act(report.id, 'ban_user');
    };

    const banByName = async () => {
        const username = window.prompt(t('mw.community.admin.banWhichUser', 'Ban which user?'));
        if (!username) return;
        const reason = window.prompt(t('mw.community.admin.banReason', 'Reason for the ban?')) || '';
        try {
            setError('');
            await api.admin.ban(username.trim(), reason.trim());
            load();
        } catch (e) {
            setError(e.message || t('mw.community.admin.couldNotBan', 'Could not ban that user.'));
        }
    };

    const unban = async username => {
        try {
            setError('');
            await api.admin.unban(username);
            load();
        } catch (e) {
            setError(e.message || t('mw.community.admin.couldNotUnban', 'Could not unban that user.'));
        }
    };

    const addAdmin = async () => {
        const name = newAdmin.trim();
        if (!name) return;
        try {
            setError('');
            await api.admin.addAdmin(name);
            setNewAdmin('');
            load();
        } catch (e) {
            setError(e.message || t('mw.community.admin.couldNotAddAdmin', 'Could not add that admin.'));
        }
    };

    const removeAdmin = async username => {
        try {
            setError('');
            await api.admin.removeAdmin(username);
            load();
        } catch (e) {
            setError(e.message || t('mw.community.admin.couldNotRemoveAdmin', 'Could not remove that admin.'));
        }
    };

    if (loading) {
        return <main className={styles.page}><p className={styles.status}>{t('mw.community.admin.loading', 'Loading…')}</p></main>;
    }
    if (!user || !user.isAdmin) {
        return <main className={styles.page}><p className={styles.status}>{t('mw.community.admin.adminsOnly', 'This page is for admins.')}</p></main>;
    }

    const openCount = reports ? reports.length : 0;
    const sections = SECTIONS.map(section => ({
        ...section,
        label: t(section.labelKey, section.labelDefault)
    }));

    return (
        <main className={styles.page}>
            <h1>{t('mw.community.admin.admin', 'Admin')}</h1>
            {error ? <p className={styles.error}>{error}</p> : null}

            <div className={styles.layout}>
                <nav
                    className={styles.sidebar}
                    aria-label={t('mw.community.admin.ariaLabel', 'Admin sections')}
                >
                    {sections.map(section => {
                        const Icon = section.icon;
                        const count = section.key === 'reports' ? openCount : 0;
                        return (
                            <button
                                key={section.key}
                                type="button"
                                className={active === section.key ? styles.sidebarActive : styles.sidebarItem}
                                onClick={() => setActive(section.key)}
                            >
                                <Icon size={18} />
                                <span className={styles.sidebarLabel}>{section.label}</span>
                                {count > 0 ? (
                                    <span className={styles.sidebarCount}>{count > 99 ? '99+' : count}</span>
                                ) : null}
                            </button>
                        );
                    })}
                </nav>

                <div className={styles.content}>
                    {active === 'overview' ? (
                        <section className={styles.card}>
                            <StatsOverview />
                        </section>
                    ) : null}

                    {active === 'reports' ? (
                        <section className={styles.card}>
                            <h2>{t('mw.community.admin.openReports', 'Open reports')}</h2>
                            {reports === null ? (
                                <p className={styles.status}>{t('mw.community.admin.loading', 'Loading…')}</p>
                            ) : reports.length ? (
                                <div className={styles.list}>
                                    {reports.map(report => (
                                        <div
                                            key={report.id}
                                            className={styles.row}
                                        >
                                            <div className={styles.rowInfo}>
                                                <span className={styles.rowTitle}>
                                                    {report.type === 'project' ? (
                                                        <Link
                                                            to={projectUrl(report.target)}
                                                        >{t('mw.community.admin.reportProject', 'Project {id}', {id: report.target})}</Link>
                                                    ) : report.type === 'user' ? (
                                                        <Link
                                                            to={`/users/${report.target}`}
                                                        >{`@${report.target}`}</Link>
                                                    ) : report.type === 'comment' && report.context ? (
                                                        (() => {
                                                            const ctx = report.context;
                                                            const target = report.target;
                                                            if (ctx.startsWith('project ')) {
                                                                const pid = ctx.slice(8);
                                                                return (
                                                                    <Link
                                                                        to={`${projectUrl(pid)}#comment-id-${target}`}
                                                                    >{t('mw.community.admin.reportComment', 'Comment {id}', {id: target})}</Link>
                                                                );
                                                            }
                                                            if (ctx.startsWith('profile ')) {
                                                                const uname = ctx.slice(8);
                                                                return (
                                                                    <Link
                                                                        to={`/users/${uname}#comment-id-${target}`}
                                                                    >{t('mw.community.admin.reportComment', 'Comment {id}', {id: target})}</Link>
                                                                );
                                                            }
                                                            return t('mw.community.admin.reportComment', 'Comment {id}', {id: target});
                                                        })()
                                                    ) : (
                                                        t('mw.community.admin.reportComment', 'Comment {id}', {id: report.target})
                                                    )}
                                                </span>
                                                <span className={styles.rowMeta}>
                                                    {t('mw.community.admin.reportedBy', 'Reported by @{reporter} · {time}', {
                                                        reporter: report.reporter,
                                                        time: formatDateTime(report.created)
                                                    })}
                                                    {report.context ? ` · ${t('mw.community.admin.inContext', 'in {context}', {context: report.context})}` : ''}
                                                </span>
                                                <span className={styles.reason}>{report.reason}</span>
                                                {report.type === 'project' ? (
                                                    <EvidencePanel target={report.target} />
                                                ) : null}
                                            </div>
                                            <div className={styles.rowActions}>
                                                {report.type === 'project' ? (
                                                    <button
                                                        className={styles.secondary}
                                                        onClick={() => act(report.id, 'unshare_project')}
                                                    >{t('mw.community.admin.unshare', 'Unshare')}</button>
                                                ) : null}
                                                <button
                                                    className={styles.secondary}
                                                    onClick={() => warnFromReport(report)}
                                                >{report.type === 'project' ?
                                                    t('mw.community.admin.warnOwner', 'Warn owner') :
                                                    t('mw.community.admin.warnUser', 'Warn user')}</button>
                                                <button
                                                    className={styles.danger}
                                                    onClick={() => banFromReport(report)}
                                                >{report.type === 'project' ?
                                                    t('mw.community.admin.banOwner', 'Ban owner') :
                                                    t('mw.community.admin.banUser', 'Ban user')}</button>
                                                <button
                                                    className={styles.secondary}
                                                    onClick={() => act(report.id, 'dismiss')}
                                                >{t('mw.community.admin.dismiss', 'Dismiss')}</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className={styles.status}>{t('mw.community.admin.noOpenReports', 'No open reports.')}</p>
                            )}
                        </section>
                    ) : null}

                    {active === 'users' ? (
                        <section className={styles.card}>
                            <UserManager />
                        </section>
                    ) : null}

                    {active === 'projects' ? (
                        <section className={styles.card}>
                            <ProjectManager />
                        </section>
                    ) : null}

                    {active === 'extensions' ? (
                        <section className={styles.card}>
                            <ExtensionManager />
                        </section>
                    ) : null}

                    {active === 'bans' ? (
                        <section className={styles.card}>
                            <h2>{t('mw.community.admin.bans', 'Bans')}</h2>
                            <button
                                className={styles.secondary}
                                onClick={banByName}
                            >{t('mw.community.admin.banAUser', 'Ban a user…')}</button>
                            {bans.length ? (
                                <div className={styles.list}>
                                    {bans.map(ban => (
                                        <div
                                            key={ban.username}
                                            className={styles.row}
                                        >
                                            <Avatar
                                                username={ban.username}
                                                size={28}
                                            />
                                            <div className={styles.rowInfo}>
                                                <span className={styles.rowTitle}>{`@${ban.username}`}</span>
                                                <span className={styles.rowMeta}>
                                                    {t('mw.community.admin.bannedBy', 'Banned by @{by} · {time}', {
                                                        by: ban.by,
                                                        time: formatDateTime(ban.created)
                                                    })}
                                                    {ban.reason ? ` · ${ban.reason}` : ''}
                                                </span>
                                            </div>
                                            <div className={styles.rowActions}>
                                                <button
                                                    className={styles.secondary}
                                                    onClick={() => unban(ban.username)}
                                                >{t('mw.community.admin.unban', 'Unban')}</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className={styles.status}>{t('mw.community.admin.nobodyBanned', 'Nobody is banned.')}</p>
                            )}
                        </section>
                    ) : null}

                    {active === 'admins' ? (
                        <section className={styles.card}>
                            <h2>{t('mw.community.admin.admins', 'Admins')}</h2>
                            <div className={styles.addAdmin}>
                                <input
                                    className={styles.input}
                                    placeholder={t('mw.community.admin.usernamePlaceholder', 'username')}
                                    value={newAdmin}
                                    onChange={e => setNewAdmin(e.target.value)}
                                />
                                <button
                                    className={styles.secondary}
                                    onClick={addAdmin}
                                >{t('mw.community.admin.addAdmin', 'Add admin')}</button>
                            </div>
                            <div className={styles.list}>
                                {admins.map(admin => (
                                    <div
                                        key={admin.username}
                                        className={styles.row}
                                    >
                                        <Avatar
                                            username={admin.username}
                                            size={28}
                                        />
                                        <div className={styles.rowInfo}>
                                            <span className={styles.rowTitle}>{`@${admin.username}`}</span>
                                            <span className={styles.rowMeta}>
                                                {admin.super ?
                                                    t('mw.community.admin.superAdmin', 'Super admin') :
                                                    t('mw.community.admin.adminRole', 'Admin')}
                                            </span>
                                        </div>
                                        <div className={styles.rowActions}>
                                            {admin.super ? null : (
                                                <button
                                                    className={styles.secondary}
                                                    onClick={() => removeAdmin(admin.username)}
                                                >{t('mw.community.admin.remove', 'Remove')}</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : null}
                </div>
            </div>
        </main>
    );
};

export default Admin;
