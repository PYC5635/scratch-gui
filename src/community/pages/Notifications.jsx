import PropTypes from 'prop-types';
import React, {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {FormattedMessage} from 'react-intl';
import {useIntl} from '../../lib/tw-use-intl.jsx';
import {
    AppWindow, AtSign, Coins, Flag, GitFork, Heart, Megaphone,
    MessageCircle, Reply, ShieldAlert, UserPlus
} from 'lucide-react';
import {projectUrl} from '../api';
import Avatar from '../components/Avatar.jsx';
import Button from '../components/ui/Button.jsx';
import {useUser} from '../UserContext.jsx';
import {fetchNotifications, markNotificationsRead, subscribeNotifications} from '../../lib/rotur/client.js';
import {timeAgo} from '../format';
import styles from './Notifications.module.css';

const ICONS = {
    love: Heart,
    comment: MessageCircle,
    profile_comment: MessageCircle,
    reply: Reply,
    remix: GitFork,
    follow: UserPlus,
    mention: AtSign,
    like: Heart,
    repost: GitFork,
    group_invite: UserPlus,
    group_request_accepted: UserPlus,
    group_request_declined: UserPlus,
    group_kicked: ShieldAlert,
    group_banned: ShieldAlert,
    group_ownership_transferred: ShieldAlert,
    cosmetic_gift: Coins,
    item_received: Coins,
    item_sold: Coins,
    item_purchased: Coins,
    purchase: Coins,
    donation: Coins,
    standing: ShieldAlert,
    moderation: ShieldAlert,
    news: Megaphone,
    report_update: Flag,
    notification: AppWindow
};

const SYSTEM_TYPES = ['standing', 'moderation', 'news', 'report_update'];

const GROUP_TYPES = [
    'group_invite',
    'group_request_accepted',
    'group_request_declined',
    'group_kicked',
    'group_banned',
    'group_ownership_transferred'
];

// Rotur / usernames follow this shape; titles that don't match are app
// messages rather than account names.
const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$/;

const commentAnchor = n => (n.commentId ? `#comment-id-${n.commentId}` : '');

const groupUrl = n => (n.group_tag ? `https://rotur.dev/groups/${encodeURIComponent(n.group_tag)}` : null);

const REPORT_OUTCOMES = {
    dismiss: 'mw.community.notifications.outcome.dismiss',
    warn_user: 'mw.community.notifications.outcome.warnUser',
    ban_user: 'mw.community.notifications.outcome.banUser',
    unshare_project: 'mw.community.notifications.outcome.unshareProject'
};

const escapeRegex = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Split text into plain segments and clickable URL segments.
const linkify = text => {
    const parts = String(text || '').split(/(https?:\/\/[^\s]+)/g);
    return parts.map((part, i) => (
        /^https?:\/\//.test(part) ? (
            <a key={i} href={part} target="_blank" rel="noreferrer" className={styles.link}>{part}</a>
        ) : part
    ));
};

// Generic notifications carry the sender in `title` (MistWarp posts
// title = actor) and the full sentence in `body`; drop the duplicated
// prefix so "shima" + "shima commented on your project" reads cleanly.
const stripSender = (sender, text) => {
    if (!sender || !text) {
        return text;
    }
    return text.replace(new RegExp(`^${escapeRegex(sender)}[\\s:.,\\u2014-]*`, 'i'), '');
};

// Prefer a username-shaped title (real actor) over the app account that
// posted the notification ("MistWarp"). Returns null when no actor is known.
const actorFor = n => {
    const title = typeof n.title === 'string' ? n.title : '';
    if (title && USERNAME_RE.test(title) && title.toLowerCase() !== 'mistwarp') {
        return title;
    }
    return n.actor || n.from || title || null;
};

const describe = (n, intl) => {
    switch (n.type) {
    case 'love': return n.projectTitle ?
        <FormattedMessage
            id="mw.community.notifications.love"
            defaultMessage="loved {title}"
            values={{title: <strong>{n.projectTitle}</strong>}}
        /> :
        <span>loved your project</span>;
    case 'comment': return n.projectTitle ?
        <FormattedMessage
            id="mw.community.notifications.comment"
            defaultMessage="commented on {title}"
            values={{title: <strong>{n.projectTitle}</strong>}}
        /> :
        <span>commented on your project</span>;
    case 'profile_comment': return <FormattedMessage
        id="mw.community.notifications.profileComment"
        defaultMessage="commented on your profile"
    />;
    case 'reply': return n.post_id ?
        <FormattedMessage
            id="mw.community.notifications.replyPost"
            defaultMessage="replied to your post"
        /> :
        n.projectTitle ?
            <FormattedMessage
                id="mw.community.notifications.replyOn"
                defaultMessage="replied to your comment on {title}"
                values={{title: <strong>{n.projectTitle}</strong>}}
            /> :
            <FormattedMessage
                id="mw.community.notifications.reply"
                defaultMessage="replied to your comment"
            />;
    case 'purchase': return (
        <FormattedMessage
            id="mw.community.notifications.purchase"
            defaultMessage="bought {title} for {amount} credits"
            values={{title: <strong>{n.projectTitle || 'your project'}</strong>, amount: n.amount}}
        />
    );
    case 'donation': return (
        <FormattedMessage
            id="mw.community.notifications.donation"
            defaultMessage="donated {amount} credits to you"
            values={{amount: n.amount}}
        />
    );
    case 'remix': return n.projectTitle ?
        <FormattedMessage
            id="mw.community.notifications.remix"
            defaultMessage="remixed {title}"
            values={{title: <strong>{n.projectTitle}</strong>}}
        /> :
        <span>remixed your project</span>;
    case 'follow': return <FormattedMessage
        id="mw.community.notifications.follow"
        defaultMessage="followed you"
    />;
    case 'mention': return n.post_id ?
        <FormattedMessage
            id="mw.community.notifications.mentionPost"
            defaultMessage="mentioned you in a post"
        /> :
        n.projectTitle ?
            <FormattedMessage
                id="mw.community.notifications.mentionOn"
                defaultMessage="mentioned you on {title}"
                values={{title: <strong>{n.projectTitle}</strong>}}
            /> :
            <FormattedMessage
                id="mw.community.notifications.mention"
                defaultMessage="mentioned you in a comment"
            />;
    case 'like': return <FormattedMessage
        id="mw.community.notifications.like"
        defaultMessage="liked your post"
    />;
    case 'repost': return <FormattedMessage
        id="mw.community.notifications.repost"
        defaultMessage="reposted your post"
    />;
    case 'group_invite': return <FormattedMessage
        id="mw.community.notifications.groupInvite"
        defaultMessage="invited you to join {group}"
        values={{group: <strong>{n.group_name}</strong>}}
    />;
    case 'group_request_accepted': return <FormattedMessage
        id="mw.community.notifications.groupRequestAccepted"
        defaultMessage="accepted your request to join {group}"
        values={{group: <strong>{n.group_name}</strong>}}
    />;
    case 'group_request_declined': return <FormattedMessage
        id="mw.community.notifications.groupRequestDeclined"
        defaultMessage="declined your request to join {group}"
        values={{group: <strong>{n.group_name}</strong>}}
    />;
    case 'group_kicked': return <FormattedMessage
        id="mw.community.notifications.groupKicked"
        defaultMessage="removed you from {group}"
        values={{group: <strong>{n.group_name}</strong>}}
    />;
    case 'group_banned': return <FormattedMessage
        id="mw.community.notifications.groupBanned"
        defaultMessage="banned you from {group}"
        values={{group: <strong>{n.group_name}</strong>}}
    />;
    case 'group_ownership_transferred': return <FormattedMessage
        id="mw.community.notifications.groupOwnershipTransferred"
        defaultMessage="transferred {group} to you"
        values={{group: <strong>{n.group_name}</strong>}}
    />;
    case 'cosmetic_gift': return <FormattedMessage
        id="mw.community.notifications.cosmeticGift"
        defaultMessage="sent you {cosmetic}"
        values={{cosmetic: <strong>{n.cosmetic_name}</strong>}}
    />;
    case 'item_received': return <FormattedMessage
        id="mw.community.notifications.itemReceived"
        defaultMessage="sent you {item}"
        values={{item: <strong>{n.item_name}</strong>}}
    />;
    case 'item_sold': return <FormattedMessage
        id="mw.community.notifications.itemSold"
        defaultMessage="bought {item} from you"
        values={{item: <strong>{n.item_name}</strong>}}
    />;
    case 'item_purchased': return <FormattedMessage
        id="mw.community.notifications.itemPurchased"
        defaultMessage="you bought {item}"
        values={{item: <strong>{n.item_name}</strong>}}
    />;
    case 'standing': return n.reason ?
        <FormattedMessage
            id="mw.community.notifications.standingReason"
            defaultMessage="Your account standing is now {level}: {reason}"
            values={{level: <strong>{n.level}</strong>, reason: n.reason}}
        /> :
        <FormattedMessage
            id="mw.community.notifications.standing"
            defaultMessage="Your account standing is now {level}."
            values={{level: <strong>{n.level}</strong>}}
        />;
    case 'moderation': return <FormattedMessage
        id="mw.community.notifications.moderatorMessage"
        defaultMessage="A moderator sent you a message."
    />;
    case 'news': return <FormattedMessage
        id="mw.community.notifications.news"
        defaultMessage="New announcement: {title}"
        values={{title: <strong>{n.title}</strong>}}
    />;
    case 'report_update': return <FormattedMessage
        id="mw.community.notifications.reportOutcome"
        defaultMessage="Your report was {outcome}."
        values={{outcome: intl.formatMessage({
            id: (n.action && REPORT_OUTCOMES[n.action]) || 'mw.community.notifications.outcome.dismiss',
            defaultMessage: 'reviewed; no action was taken'
        })}}
    />;
    default: return <FormattedMessage
        id="mw.community.notifications.didSomething"
        defaultMessage="did something"
    />;
    }
};

// Generic Rotur notifications (any app's /v2/notify/ push) arrive as
// type "notification" with title/body/from/source. Title holds the sender
// for MistWarp; other apps may put an app name or message summary there.
const GenericNotification = ({n}) => {
    const sender = n.title || n.from || n.actor || '';
    const isUser = Boolean(sender) && USERNAME_RE.test(sender) &&
        sender.toLowerCase() !== 'mistwarp' &&
        sender.toLowerCase() !== String(n.source || '').toLowerCase();
    const raw = n.body || n.content || '';
    if (!isUser && !sender && !raw) {
        return null;
    }
    const text = isUser ? stripSender(sender, raw) : raw;
    const showTitle = !isUser && Boolean(sender) && sender !== text;
    const channel = n.channelName ? ` in #${n.channelName}` : '';
    const target = n.projectId ? `${projectUrl(n.projectId)}${commentAnchor(n)}` : null;
    const sourceLink = typeof n.source === 'string' && /^https?:\/\//.test(n.source);
    const showSource = Boolean(n.source) && n.source !== 'mistwarp' && !sourceLink;

    let content;
    if (showTitle) {
        content = (
            <>
                <span className={styles.senderTitle}>{sender}</span>
                {linkify(text)}{channel}
            </>
        );
    } else {
        content = <>{linkify(text || sender)}{channel}</>;
    }
    if (target) {
        content = <Link to={target} className={styles.body}>{content}</Link>;
    } else if (sourceLink) {
        content = <a href={n.source} target="_blank" rel="noreferrer" className={styles.body}>{content}</a>;
    } else {
        content = <span className={styles.body}>{content}</span>;
    }

    if (isUser) {
        return (
            <>
                <span className={styles.avatarWrap}>
                    <Link to={`/users/${sender}`}>
                        <Avatar username={sender} size={40} />
                    </Link>
                    <span className={styles.iconBadge}><AtSign size={12} /></span>
                </span>
                <div className={styles.text}>
                    <Link to={`/users/${sender}`} className={styles.actor}>{sender}</Link>
                    {' '}
                    {content}
                </div>
            </>
        );
    }
    return (
        <>
            <span className={styles.sysAvatar}><AppWindow size={20} /></span>
            <div className={styles.text}>
                {content}
                {showSource ? <span className={styles.sourceTag}>{n.source}</span> : null}
            </div>
        </>
    );
};

GenericNotification.propTypes = {
    n: PropTypes.object.isRequired
};

const Notifications = ({hideHeading}) => {
    const intl = useIntl();
    const {user, loading} = useUser();
    const [items, setItems] = useState(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!user) {
            return () => {};
        }
        return subscribeNotifications(notification => {
            setItems(prev => {
                if (!prev || prev.some(item => item.id === notification.id)) {
                    return prev;
                }
                return [notification, ...prev];
            });
        });
    }, [user]);

    useEffect(() => {
        const onRemoved = event => {
            const id = event.detail && event.detail.id;
            if (typeof id !== 'string') {
                return;
            }
            setItems(prev => (prev ? prev.filter(item => item.id !== id) : prev));
        };
        window.addEventListener('mw:notifications-removed', onRemoved);
        return () => window.removeEventListener('mw:notifications-removed', onRemoved);
    }, []);

    useEffect(() => {
        if (!user) {
            return;
        }
        setFailed(false);
        fetchNotifications()
            .then(list => {
                setItems(list);
                markNotificationsRead()
                    .then(() => window.dispatchEvent(new Event('mw:notifications-read')))
                    .catch(() => {});
            })
            .catch(() => setFailed(true));
    }, [user, attempt]);

    if (loading) {
        return <main className={styles.page}><p className={styles.status}>{intl.formatMessage({id: 'mw.community.notifications.loading', defaultMessage: 'Loading…'})}</p></main>;
    }
    if (!user) {
        return <main className={styles.page}><p className={styles.status}>{intl.formatMessage({id: 'mw.community.notifications.signIn', defaultMessage: 'Sign in to see your notifications.'})}</p></main>;
    }

    return (
        <main className={styles.page}>
            {hideHeading ? null : <h1>{intl.formatMessage({id: 'mw.community.notifications.title', defaultMessage: 'Notifications'})}</h1>}
            {failed ? (
                <p className={styles.status}>
                    {intl.formatMessage({id: 'mw.community.notifications.couldNotLoad', defaultMessage: 'Couldn\'t load.'})}{' '}
                    <Button onClick={() => setAttempt(a => a + 1)}>{intl.formatMessage({id: 'mw.community.notifications.tryAgain', defaultMessage: 'Try again'})}</Button>
                </p>
            ) : items === null ? (
                <p className={styles.status}>{intl.formatMessage({id: 'mw.community.notifications.loading', defaultMessage: 'Loading…'})}</p>
            ) : items.length ? (
                <div className={styles.list}>
                    {items.map(n => {
                        const Icon = ICONS[n.type] || Heart;
                        const ts = n.created || n.timestamp;
                        const time = timeAgo(ts);

                        if (n.type === 'notification') {
                            return (
                                <div key={n.id} className={n.read ? styles.item : styles.itemUnread}>
                                    <GenericNotification n={n} />
                                    <span className={styles.time}>{time}</span>
                                </div>
                            );
                        }

                        if (SYSTEM_TYPES.includes(n.type)) {
                            return (
                                <div key={n.id} className={n.read ? styles.item : styles.itemUnread}>
                                    <span className={styles.sysAvatar}><Icon size={20} /></span>
                                    <div className={styles.text}>
                                        {n.type === 'news' && n.newsId ? (
                                            <Link to="/news" className={styles.body}>{describe(n, intl)}</Link>
                                        ) : (
                                            <span className={styles.body}>{describe(n, intl)}</span>
                                        )}
                                    </div>
                                    <span className={styles.time}>{time}</span>
                                </div>
                            );
                        }

                        const actor = actorFor(n);
                        if (!actor) {
                            return null;
                        }
                        const groupLink = GROUP_TYPES.includes(n.type) ? groupUrl(n) : null;
                        const body = groupLink ? (
                            <a href={groupLink} target="_blank" rel="noreferrer" className={styles.body}>
                                {describe(n, intl)}
                            </a>
                        ) : describe(n, intl);
                        return (
                            <div key={n.id} className={n.read ? styles.item : styles.itemUnread}>
                                <span className={styles.avatarWrap}>
                                    <Link to={`/users/${actor}`}>
                                        <Avatar username={actor} size={40} />
                                    </Link>
                                    <span className={styles.iconBadge}><Icon size={12} /></span>
                                </span>
                                <div className={styles.text}>
                                    <Link to={`/users/${actor}`} className={styles.actor}>{actor}</Link>
                                    {' '}
                                    {n.projectId ? (
                                        <Link
                                            to={`${projectUrl(n.projectId)}${commentAnchor(n)}`}
                                            className={styles.body}
                                        >{body}</Link>
                                    ) : (n.type === 'profile_comment' || n.profile) ? (
                                        <Link
                                            to={`/users/${n.profile || user.username}${commentAnchor(n)}`}
                                            className={styles.body}
                                        >{body}</Link>
                                    ) : body}
                                </div>
                                <span className={styles.time}>{time}</span>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className={styles.status}>{intl.formatMessage({id: 'mw.community.notifications.empty', defaultMessage: 'Nothing yet. Activity on your projects shows up here.'})}</p>
            )}
        </main>
    );
};

Notifications.propTypes = {
    hideHeading: PropTypes.bool
};

export default Notifications;
