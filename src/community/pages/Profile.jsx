import React, {useEffect, useState, useCallback, useMemo} from 'react';
import {useParams, Link} from 'react-router-dom';
import {useIntl} from '../../lib/tw-use-intl.jsx';
import {
    UserPlus, UserCheck, Calendar, MessageSquare, MessageSquareOff, ChevronRight, Pencil, Flag, Coins, X
} from 'lucide-react';
import api from '../api';
import rotur from '../rotur';
import {payUser} from '../../lib/rotur/client.js';
import {isInsufficientFunds, openCreditCheckout, CREDIT_PACKS} from '../credits';
import {useUser} from '../UserContext.jsx';
import ProjectCard from '../components/ProjectCard.jsx';
import CommentThread from '../components/CommentThread.jsx';
import ReportModal from '../components/ReportModal.jsx';
import Avatar from '../components/Avatar.jsx';
import RichText from '../components/RichText.jsx';
import ActivityCard from '../components/ActivityCard.jsx';
import FeaturedProject from '../components/FeaturedProject.jsx';
import useLatest from '../use-latest.js';
import useEscape from '../use-escape.js';
import setPageMeta from '../page-meta.js';
import safeIconSvg from '../safe-icon.js';
import styles from './Profile.module.css';

const FOLLOWER_STRIP_COUNT = 16;

const joinYear = ms => {
    if (!ms) return null;
    try {
        return new Date(ms).getFullYear();
    } catch (e) {
        return null;
    }
};

const Profile = () => {
    const {name} = useParams();
    const intl = useIntl();
    const t = useCallback((id, defaultMessage, values) =>
        intl.formatMessage({id, defaultMessage}, values), [intl]);
    const {user} = useUser();
    const [profile, setProfile] = useState(null);
    const [mwUser, setMwUser] = useState(null);
    const [followers, setFollowers] = useState([]);
    const [error, setError] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [followBusy, setFollowBusy] = useState(false);
    const [commentsBusy, setCommentsBusy] = useState(false);
    const [reporting, setReporting] = useState(false);
    const [adminProjects, setAdminProjects] = useState([]);
    const [presence, setPresence] = useState(null);
    const [donating, setDonating] = useState(false);

    const beginLoad = useLatest();

    const load = useCallback(() => {
        const fresh = beginLoad();
        rotur.profile(name, {includePosts: false})
            .then(fresh(setProfile))
            .catch(fresh(() => setError(t('mw.community.profile.notFound',
                'This user does not exist on Bilup Accounts.'))));
        api.getUser(name)
            .then(fresh(setMwUser))
            .catch(fresh(() => setMwUser(null)));
        rotur.followers(name)
            .then(fresh(data => setFollowers(data.followers || [])))
            .catch(fresh(() => setFollowers([])));
    }, [name, beginLoad]);

    useEffect(() => {
        setProfile(null);
        setMwUser(null);
        setFollowers([]);
        setError(null);
        setReporting(false);
        load();
    }, [name, load]);

    useEffect(() => {
        setPresence(null);
        let active = true;
        rotur.status(name)
            .then(data => active && setPresence(data))
            .catch(() => active && setPresence(null));
        return () => {
            active = false;
        };
    }, [name]);

    useEffect(() => {
        if (!user || !user.isAdmin) {
            setAdminProjects([]);
            return () => {};
        }
        let active = true;
        api.myProjects(name)
            .then(data => active && setAdminProjects(data.projects || []))
            .catch(() => active && setAdminProjects([]));
        return () => {
            active = false;
        };
    }, [name, user]);

    useEffect(() => {
        if (!profile) return;
        setPageMeta({
            title: profile.username || name,
            description: profile.bio,
            image: rotur.avatar(name, 256),
            card: 'summary'
        });
    }, [profile, name]);

    // Scroll to a comment anchor after the comments section renders
    useEffect(() => {
        const hash = window.location.hash;
        if (!hash) return;
        const id = hash.replace('#', '');
        const tryScroll = (attempts = 0) => {
            const el = document.getElementById(id);
            if (el) {
                el.scrollIntoView({behavior: 'smooth', block: 'center'});
                return;
            }
            if (attempts < 20) {
                setTimeout(() => tryScroll(attempts + 1), 300);
            }
        };
        tryScroll();
    }, [profile, mwUser]);

    const toggleFollow = async () => {
        if (!user || !profile || followBusy) return;
        setFollowBusy(true);
        setActionError(null);
        try {
            const me = user.username;
            if (profile.followed) {
                await rotur.unfollow(name);
                setProfile(p => ({...p, followed: false, followers: Math.max(0, (p.followers || 1) - 1)}));
                setFollowers(fs => fs.filter(f => f.toLowerCase() !== me.toLowerCase()));
            } else {
                await rotur.follow(name);
                setProfile(p => ({...p, followed: true, followers: (p.followers || 0) + 1}));
                setFollowers(fs => [me, ...fs.filter(f => f.toLowerCase() !== me.toLowerCase())]);
            }
        } catch (e) {
            setActionError(e.message || t('mw.community.profile.followFailed', 'Could not update follow.'));
        } finally {
            setFollowBusy(false);
        }
    };

    const isSelf = Boolean(user && user.username && user.username.toLowerCase() === name.toLowerCase());
    const commentsOff = Boolean(mwUser && mwUser.commentsOff);

    const toggleComments = async () => {
        if (commentsBusy) return;
        setCommentsBusy(true);
        setActionError(null);
        try {
            await api.updateProfile({commentsOff: !commentsOff});
            load();
        } catch (e) {
            setActionError(e.message || t('mw.community.profile.commentsFailed', 'Could not update comments.'));
        } finally {
            setCommentsBusy(false);
        }
    };

    const commentSource = useMemo(() => ({
        list: () => api.getProfileComments(name),
        add: (content, parent) => api.addProfileComment(name, content, parent),
        remove: commentId => api.deleteProfileComment(name, commentId),
        react: (commentId, type) => api.reactProfileComment(name, commentId, type)
    }), [name]);

    if (error) {
        return <main className={styles.page}><p className={styles.status}>{error}</p></main>;
    }
    if (!profile) {
        return <main className={styles.page}><p className={styles.status}>{t('mw.community.profile.loading', 'Loading…')}</p></main>;
    }

    const projects = (mwUser && mwUser.projects) || [];
    const featuredProject = mwUser ? projects.find(project => project.id === mwUser.featuredProject) : null;
    const otherProjects = featuredProject ? projects.filter(project => project.id !== featuredProject.id) : projects;
    const unsharedProjects = adminProjects.filter(project => !project.shared);
    const onMistWarp = !mwUser || mwUser.exists !== false;
    const year = joinYear(profile.created);
    const isOnline = Boolean(presence && presence.presence && presence.presence !== 'offline');
    const statusDotClass = isOnline ? styles.onlineDot : styles.offlineDot;
    const statusText = presence ? (presence.status || presence.presence) : '';
    const activities = presence && Array.isArray(presence.activities) ? presence.activities : [];
    const badges = Array.isArray(profile.badges) ? profile.badges.slice(0, 6) : [];

    return (
        <main className={styles.page}>
            {reporting ? (
                <ReportModal
                    type="user"
                    target={name}
                    onClose={() => setReporting(false)}
                />
            ) : null}
            {donating ? (
                <DonateModal
                    recipient={profile.username || name}
                    onClose={() => setDonating(false)}
                />
            ) : null}
            <div className={styles.layout}>
                <div className={styles.mainColumn}>
                    {actionError ? <p className={styles.status}>{actionError}</p> : null}

                    {!onMistWarp ? (
                        <div className={styles.notOnMistwarp}>
                            {t('mw.community.profile.notOnBilup',
                                'Not on Bilup yet. This is {name}\'s Bilup Accounts profile.', {
                                    name: profile.username || name
                                })}
                        </div>
                    ) : null}

                    {featuredProject ? (
                        <section className={styles.section}>
                            <FeaturedProject project={featuredProject} />
                        </section>
                    ) : null}

                    {otherProjects.length ? (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>{t('mw.community.profile.projects', 'Projects')}</h2>
                            <div className={styles.grid}>
                                {otherProjects.map(project => (
                                    <ProjectCard
                                        key={project.id}
                                        project={project}
                                    />
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {user && user.isAdmin && unsharedProjects.length ? (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>{t('mw.community.profile.unsharedAdmin', 'Unshared projects (admin only)')}</h2>
                            <div className={styles.grid}>
                                {unsharedProjects.map(project => (
                                    <ProjectCard
                                        key={project.id}
                                        project={project}
                                    />
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <section className={styles.section}>
                        <div className={styles.sectionHead}>
                            <h2 className={styles.sectionTitle}>
                                {t('mw.community.profile.followersHeading', 'Followers - {count}', {
                                    count: profile.followers || followers.length
                                })}
                            </h2>
                            {followers.length ? (
                                <Link
                                    to={`/users/${name}/followers`}
                                    className={styles.seeAll}
                                >
                                    {t('mw.community.profile.seeAll', 'See all')}
                                    <ChevronRight size={14} />
                                </Link>
                            ) : null}
                        </div>
                        {followers.length ? (
                            <div className={styles.followersRow}>
                                {followers.slice(0, FOLLOWER_STRIP_COUNT).map(follower => (
                                    <Link
                                        key={follower}
                                        to={`/users/${follower}`}
                                        className={styles.followerChip}
                                    >
                                        <Avatar
                                            username={follower}
                                            size={56}
                                        />
                                        <span>{follower}</span>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <p className={styles.sectionEmpty}>{t('mw.community.profile.noFollowers', 'No followers yet.')}</p>
                        )}
                    </section>

                    {onMistWarp ? (
                        <section className={styles.section}>
                            <div className={styles.sectionHead}>
                                <h2 className={styles.sectionTitle}>{t('mw.community.profile.comments', 'Comments')}</h2>
                                {isSelf ? (
                                    <button
                                        className={styles.commentsToggle}
                                        onClick={toggleComments}
                                        disabled={commentsBusy}
                                    >
                                        {commentsOff ? <MessageSquare size={14} /> : <MessageSquareOff size={14} />}
                                        {commentsOff ?
                                            t('mw.community.profile.turnOnComments', 'Turn on comments') :
                                            t('mw.community.profile.turnOffComments', 'Turn off comments')}
                                    </button>
                                ) : null}
                            </div>
                            <div className={styles.feed}>
                                <CommentThread
                                    source={commentSource}
                                    canModerate={isSelf}
                                    disabled={commentsOff}
                                    reportContext={`profile ${name}`}
                                />
                            </div>
                        </section>
                    ) : null}
                </div>
                <aside className={styles.profileRail}>
                    <section className={styles.profileCard}>
                        {profile.profile_video ? (
                            <video
                                className={styles.profileVideo}
                                src={profile.profile_video}
                                autoPlay
                                muted
                                loop
                                playsInline
                            />
                        ) : null}
                        <div
                            className={styles.banner}
                            style={{backgroundImage: `url(${rotur.banner(name)})`}}
                        />
                        <div className={styles.profileBody}>
                            <Avatar username={name} size={88} className={styles.avatar} />
                            <div className={styles.nameRow}>
                                <h1>{profile.username || name}</h1>
                                {profile.pronouns ? <span className={styles.pronouns}>{profile.pronouns}</span> : null}
                            </div>
                            {presence ? (
                                <span className={styles.userStatus}>
                                    <span className={statusDotClass} />
                                    <RichText text={statusText || (isOnline ?
                                        t('mw.community.profile.online', 'Online') :
                                        t('mw.community.profile.offline', 'Offline'))} />
                                </span>
                            ) : null}
                            {badges.length ? (
                                <div className={styles.badges}>
                                    {badges.map((badge, index) => {
                                        const badgeData = typeof badge === 'string' ? {name: badge} : badge;
                                        if (!badgeData.icon) return null;
                                        return (
                                            <span
                                                key={`${badgeData.name}-${index}`}
                                                className={styles.badge}
                                                title={badgeData.description || badgeData.name}
                                                aria-label={badgeData.name}
                                                // eslint-disable-next-line react/no-danger
                                                dangerouslySetInnerHTML={{
                                                    __html: safeIconSvg(badgeData.icon, {size: 2, viewSize: 20})
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            ) : null}
                            <div className={styles.profileStats}>
                                <div><strong>{profile.followers || 0}</strong><span>{t('mw.community.profile.followers', 'followers')}</span></div>
                                <div><strong>{profile.following || 0}</strong><span>{t('mw.community.profile.followingCount', 'following')}</span></div>
                                <div><strong>{profile.currency || 0}</strong><span>{t('mw.community.profile.credits', 'credits')}</span></div>
                            </div>
                            <div className={styles.actions}>
                                {user && !isSelf ? (
                                    <button
                                        className={profile.followed ? styles.followingButton : styles.followButton}
                                        disabled={followBusy}
                                        onClick={toggleFollow}
                                    >
                                        {profile.followed ? <UserCheck size={16} /> : <UserPlus size={16} />}
                                        {profile.followed ?
                                            t('mw.community.profile.following', 'Following') :
                                            t('mw.community.profile.follow', 'Follow')}
                                    </button>
                                ) : null}
                                {user && !isSelf ? (
                                    <button
                                        className={styles.followButton}
                                        title={t('mw.community.profile.sendCreditsTo', 'Send credits to {name}', {
                                            name: profile.username || name
                                        })}
                                        onClick={() => setDonating(true)}
                                    >
                                        <Coins size={15} />
                                        {t('mw.community.profile.donate', 'Donate')}
                                    </button>
                                ) : null}
                                {user && !isSelf ? (
                                    <button
                                        className={styles.iconButton}
                                        title={t('mw.community.profile.reportUser', 'Report this user')}
                                        aria-label={t('mw.community.profile.reportUser', 'Report this user')}
                                        onClick={() => setReporting(true)}
                                    >
                                        <Flag size={15} />
                                    </button>
                                ) : null}
                                {isSelf ? (
                                    <a
                                        className={styles.followButton}
                                        href="https://accounts.bilup.org/me"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <Pencil size={15} />
                                        {t('mw.community.profile.editProfile', 'Edit profile')}
                                    </a>
                                ) : null}
                            </div>
                            <div className={styles.railSection}>
                                <h2>{t('mw.community.profile.aboutMe', 'About me')}</h2>
                                <div className={styles.bio}>
                                    {profile.bio ? <RichText text={profile.bio} /> : t('mw.community.profile.noBio', 'No bio yet.')}
                                </div>
                            </div>
                            <div className={styles.accountMeta}>
                                {year ? (
                                    <span><Calendar size={14} />{t('mw.community.profile.joined', 'Joined {year}', {year})}</span>
                                ) : null}
                                {typeof profile.index === 'number' ? <span>{t('mw.community.profile.accountNumber', 'Account #{index}', {index: profile.index})}</span> : null}
                                <a
                                    className={styles.bilupAccountsLink}
                                    href={`https://accounts.bilup.org/profile/${encodeURIComponent(profile.username || name)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {t('mw.community.profile.bilupAccountsProfile', '跳转到Bilup Accounts主页')}
                                </a>
                            </div>
                            {activities.length ? (
                                <div className={styles.railSection}>
                                    <h2>{t('mw.community.profile.activityTitle', 'Activity')}</h2>
                                    <div className={styles.activityList}>
                                        {activities.slice(0, 3).map((activity, index) => (
                                            <ActivityCard key={activity.id || index} activity={activity} />
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </section>
                </aside>
            </div>
        </main>
    );
};

const DonateModal = ({recipient, onClose}) => {
    const intl = useIntl();
    const [amount, setAmount] = useState('');
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState(null);
    const [sent, setSent] = useState(0);
    const [insufficient, setInsufficient] = useState(false);
    useEscape(onClose);

    const send = async () => {
        const value = Math.round((Number(amount) || 0) * 100) / 100;
        if (!value || value <= 0) {
            setStatus(intl.formatMessage({
                id: 'mw.community.profile.enterAmount',
                defaultMessage: 'Enter an amount greater than 0.'
            }));
            return;
        }
        setBusy(true);
        setStatus(null);
        setInsufficient(false);
        try {
            await payUser(recipient, value, intl.formatMessage({
                id: 'mw.community.profile.donationMemo',
                defaultMessage: 'Bilup donation to {recipient}'
            }, {recipient}));
            setSent(value);
        } catch (e) {
            if (isInsufficientFunds(e)) {
                setInsufficient(true);
            } else {
                setStatus(e.needsReauth ?
                    intl.formatMessage({
                        id: 'mw.community.profile.reauthNeeded',
                        defaultMessage: 'Your current login cannot send credits. Log out and back in, then try again.'
                    }) :
                    (e.message || intl.formatMessage({
                        id: 'mw.community.profile.sendFailed',
                        defaultMessage: 'Could not send credits.'
                    })));
            }
        } finally {
            setBusy(false);
        }
    };

    const buyCredits = async () => {
        if (busy) return;
        setBusy(true);
        setStatus(null);
        try {
            await openCreditCheckout(CREDIT_PACKS[1]);
        } catch (e) {
            setStatus(e.needsReauth ?
                'Your current login cannot buy credits. Log out and back in, then try again.' :
                (e.message || 'Could not open checkout.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className={styles.donateOverlay}
            onClick={onClose}
        >
            <div
                className={styles.donateModal}
                onClick={event => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className={styles.donateHead}>
                    <span className={styles.donateHeadTitle}>
                        <Coins size={17} />
                        {intl.formatMessage({
                            id: 'mw.community.profile.donateTo',
                            defaultMessage: 'Donate to {recipient}'
                        }, {recipient})}
                    </span>
                    <button
                        className={styles.donateClose}
                        onClick={onClose}
                        aria-label={intl.formatMessage({
                            id: 'mw.community.profile.close',
                            defaultMessage: 'Close'
                        })}
                    >
                        <X size={18} />
                    </button>
                </div>
                {sent ? (
                    <div className={styles.donateDone}>
                        <span className={styles.donateDoneIcon}><Coins size={28} /></span>
                        <p>{intl.formatMessage({
                            id: 'mw.community.profile.sentCredits',
                            defaultMessage: 'Sent {amount} credits to {recipient}.'
                        }, {amount: sent, recipient})}</p>
                        <button
                            className={styles.donateSend}
                            onClick={onClose}
                        >{intl.formatMessage({
                            id: 'mw.community.profile.done',
                            defaultMessage: 'Done'
                        })}</button>
                    </div>
                ) : (
                    <div className={styles.donateBody}>
                        <p className={styles.donateText}>
                            {intl.formatMessage({
                                id: 'mw.community.profile.donateText',
                                defaultMessage: 'Send Bilup Accounts credits straight to {recipient}. This transfers directly from your account.'
                            }, {recipient})}
                        </p>
                        <input
                            className={styles.donateInput}
                            type="number"
                            min="1"
                            step="1"
                            placeholder={intl.formatMessage({
                                id: 'mw.community.profile.amountPlaceholder',
                                defaultMessage: 'Amount in credits'
                            })}
                            value={amount}
                            onChange={event => setAmount(event.target.value)}
                        />
                        {status ? <p className={styles.donateStatus}>{status}</p> : null}
                        {insufficient ? (
                            <p className={styles.donateStatus}>
                                Not enough credits in your balance. Top up through Stripe, then send again.
                            </p>
                        ) : null}
                        <button
                            className={styles.donateSend}
                            onClick={insufficient ? buyCredits : send}
                            disabled={busy}
                        >
                            <Coins size={16} />
                            {busy ?
                                intl.formatMessage({id: 'mw.community.profile.sending', defaultMessage: 'Sending…'}) :
                                insufficient ?
                                    intl.formatMessage({id: 'mw.community.profile.buyCredits', defaultMessage: 'Buy credits'}) :
                                    intl.formatMessage({id: 'mw.community.profile.sendCredits', defaultMessage: 'Send credits'})}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Profile;