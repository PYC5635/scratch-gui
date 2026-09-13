import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';
import {Sparkles, Clock, Users, Heart, Star, Globe, GitFork, Megaphone, Github} from 'lucide-react';
import api, {editorUrl, projectUrl} from '../api';
import rotur from '../rotur';
import {useUser} from '../UserContext.jsx';
import Avatar from '../components/Avatar.jsx';
import Button from '../components/ui/Button.jsx';
import ProjectCard from '../components/ProjectCard.jsx';
import NewsItem from '../components/NewsItem.jsx';
import logo from '../assets/bilup-logo.svg';
import styles from './Home.module.css';

// Format a timestamp as "YYYY-MM-DD HH:mm" (e.g. 2026-08-07 14:30).
// Defined locally (rather than imported) to avoid depending on a newly-added
// named export in a shared chunk, which browsers may cache as an older version.
const formatDateTime = ms => {
    if (!ms) return '';
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const ACTIVITY_ICONS = {
    love: Heart,
    favorite: Star,
    share: Globe,
    remix: GitFork
};

const describeActivity = item => {
    switch (item.type) {
    case 'love': return (
        <FormattedMessage
            defaultMessage="loved {title}"
            id="mw.community.home.activity.loved"
            values={{title: <strong>{item.projectTitle}</strong>}}
        />
    );
    case 'favorite': return (
        <FormattedMessage
            defaultMessage="favorited {title}"
            id="mw.community.home.activity.favorited"
            values={{title: <strong>{item.projectTitle}</strong>}}
        />
    );
    case 'share': return (
        <FormattedMessage
            defaultMessage="shared {title}"
            id="mw.community.home.activity.shared"
            values={{title: <strong>{item.projectTitle}</strong>}}
        />
    );
    case 'remix': return (
        <FormattedMessage
            defaultMessage="remixed {title}"
            id="mw.community.home.activity.remixed"
            values={{title: <strong>{item.parentTitle || item.projectTitle}</strong>}}
        />
    );
    default: return (
        <FormattedMessage
            defaultMessage="did something"
            id="mw.community.home.activity.other"
        />
    );
    }
};

const Row = ({title, icon, action, projects, loading, failed, onRetry}) => {
    let body;
    if (loading) {
        body = (
            <div className={styles.grid}>
                {[0, 1, 2, 3].map(i => (
                    <div
                        key={i}
                        className={styles.skeleton}
                    />
                ))}
            </div>
        );
    } else if (failed) {
        body = (
            <div className={styles.empty}>
                <FormattedMessage
                    defaultMessage="Couldn't load projects."
                    id="mw.community.home.couldNotLoadProjects"
                />{' '}
                <Button onClick={onRetry}>
                    <FormattedMessage
                        defaultMessage="Try again"
                        id="mw.community.home.tryAgain"
                    />
                </Button>
            </div>
        );
    } else if (projects.length) {
        body = (
            <div className={styles.grid}>
                {projects.map(project => (
                    <ProjectCard
                        key={project.id}
                        project={project}
                    />
                ))}
            </div>
        );
    } else {
        body = (
            <div className={styles.empty}>
                <FormattedMessage
                    defaultMessage="Nothing here yet. Be the first to share a project."
                    id="mw.community.home.nothingHere"
                />
            </div>
        );
    }
    return (
        <section className={styles.row}>
            <div className={styles.rowHead}>
                <h2>{icon}{title}</h2>
                {action}
            </div>
            {body}
        </section>
    );
};

const ActivitySection = ({user, login}) => {
    const [items, setItems] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;
        if (!user) {
            setItems([]);
            setLoaded(true);
            return () => {};
        }
        setLoaded(false);
        setFailed(false);
        rotur.following(user.username)
            .then(data => {
                if (cancelled) return;
                const following = data.following || [];
                if (!following.length) {
                    return {activity: []};
                }
                return api.activity(following);
            })
            .then(data => {
                if (cancelled) return;
                setItems(data.activity || []);
            })
            .catch(() => {
                if (cancelled) return;
                setFailed(true);
            })
            .finally(() => {
                if (!cancelled) setLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, [user, attempt]);

    let body;
    if (!user) {
        body = (
            <div className={styles.feedMessage}>
                <span>
                    <FormattedMessage
                        defaultMessage="Log in to see your friends' activity."
                        id="mw.community.home.feedLogIn"
                    />
                </span>
                <button
                    className={styles.feedSignIn}
                    onClick={login}
                >
                    <FormattedMessage
                        defaultMessage="Sign in with Bilup Accounts"
                        id="mw.community.home.signInRotur"
                    />
                </button>
            </div>
        );
    } else if (!loaded) {
        body = (
            <div className={styles.feedMessage}>
                <FormattedMessage
                    defaultMessage="Loading…"
                    id="mw.community.home.loading"
                />
            </div>
        );
    } else if (failed) {
        body = (
            <div className={styles.feedMessage}>
                <FormattedMessage
                    defaultMessage="Couldn't load."
                    id="mw.community.home.couldNotLoad"
                />{' '}
                <Button onClick={() => setAttempt(a => a + 1)}>
                    <FormattedMessage
                        defaultMessage="Try again"
                        id="mw.community.home.tryAgain"
                    />
                </Button>
            </div>
        );
    } else if (!items.length) {
        body = (
            <div className={styles.feedMessage}>
                <FormattedMessage
                    defaultMessage="No recent activity from people you follow yet."
                    id="mw.community.home.noRecentActivity"
                />
            </div>
        );
    } else {
        body = (
            <div className={`${styles.activityList} ${styles.feedScroll}`}>
                {items.map((item, index) => {
                    const Icon = ACTIVITY_ICONS[item.type] || Heart;
                    return (
                        <div
                            key={`${item.actor}-${item.created}-${index}`}
                            className={styles.activityItem}
                        >
                            <Link to={`/users/${item.actor}`}>
                                <Avatar
                                    username={item.actor}
                                    size={34}
                                />
                            </Link>
                            <span className={styles.activityIcon}><Icon size={14} /></span>
                            <span className={styles.activityText}>
                                <Link
                                    to={`/users/${item.actor}`}
                                    className={styles.activityActor}
                                >{item.actor}</Link>
                                {' '}
                                {item.projectId ? (
                                    <Link to={projectUrl(item.projectId)}>{describeActivity(item)}</Link>
                                ) : describeActivity(item)}
                            </span>
                            <span className={styles.activityTime}>{formatDateTime(item.created)}</span>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <section className={styles.feedBox}>
            <div className={styles.rowHead}>
                <h2>
                    <Users
                        size={19}
                        className={styles.rowIcon}
                    />
                    <FormattedMessage
                        defaultMessage="From people you follow"
                        id="mw.community.home.feedFromFollowed"
                    />
                </h2>
            </div>
            {body}
        </section>
    );
};

const NewsSection = () => {
    const [items, setItems] = useState(null);
    const [failed, setFailed] = useState(false);

    const load = () => {
        setFailed(false);
        api.news()
            .then(data => setItems(data.news || []))
            .catch(() => setFailed(true));
    };

    useEffect(() => {
        let cancelled = false;
        setFailed(false);
        api.news()
            .then(data => {
                if (!cancelled) setItems(data.news || []);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (failed) {
        return (
            <section className={styles.feedBox}>
                <div className={styles.rowHead}>
                    <h2>
                        <Megaphone
                            size={19}
                            className={styles.rowIcon}
                        />
                        <FormattedMessage
                            defaultMessage="News"
                            id="mw.community.home.news"
                        />
                    </h2>
                </div>
                <div className={styles.feedMessage}>
                    <FormattedMessage
                        defaultMessage="Couldn't load news."
                        id="mw.community.home.couldNotLoadNews"
                    />
                </div>
            </section>
        );
    }
    if (!items) {
        return (
            <section className={styles.feedBox}>
                <div className={styles.rowHead}>
                    <h2>
                        <Megaphone
                            size={19}
                            className={styles.rowIcon}
                        />
                        <FormattedMessage
                            defaultMessage="News"
                            id="mw.community.home.news"
                        />
                    </h2>
                </div>
                <div className={styles.feedMessage}>
                    <FormattedMessage
                        defaultMessage="Loading…"
                        id="mw.community.home.loading"
                    />
                </div>
            </section>
        );
    }
    if (!items.length) {
        return null;
    }

    return (
        <section className={styles.feedBox}>
            <div className={styles.rowHead}>
                <h2>
                    <Megaphone
                        size={19}
                        className={styles.rowIcon}
                        />
                        <FormattedMessage
                            defaultMessage="News"
                            id="mw.community.home.news"
                        />
                    </h2>
                <Link
                    to="/news"
                    className={styles.seeAll}
                >
                    <FormattedMessage
                        defaultMessage="All updates"
                        id="mw.community.home.allUpdates"
                    />
                </Link>
            </div>
            <div className={`${styles.newsList} ${styles.feedScroll}`}>
                {items.map(item => (
                    <NewsItem
                        key={item.id}
                        item={item}
                        onChanged={load}
                    />
                ))}
            </div>
        </section>
    );
};

const Home = () => {
    const {user, login} = useUser();
    const [recent, setRecent] = useState([]);
    const [trending, setTrending] = useState([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState({trending: false, recent: false});
    const [attempt, setAttempt] = useState(0);
    const retry = () => setAttempt(a => a + 1);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setFailed({trending: false, recent: false});
        Promise.all([
            api.explore({sort: 'trending', limit: 8}).catch(() => null),
            api.explore({sort: 'recent', limit: 8}).catch(() => null)
        ]).then(([t, r]) => {
            if (cancelled) return;
            if (t) setTrending(t.projects || []);
            if (r) setRecent(r.projects || []);
            setFailed({trending: !t, recent: !r});
        }).finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [attempt]);

    return (
        <main className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroText}>
                    <h1>
                        <FormattedMessage
                            defaultMessage="Elevate your creation."
                            id="mw.community.home.heroTitle"
                        />
                    </h1>
                    <p>
                        <FormattedMessage
                            defaultMessage="A visual coding community on the Bilup editor, with version control, forking, and pull requests behind every project."
                            id="mw.community.home.heroDescription"
                        />
                    </p>
                    <div className={styles.heroActions}>
                        <a
                            className={styles.primaryButton}
                            href={editorUrl()}
                        >
                            <FormattedMessage
                                defaultMessage="Start creating"
                                id="mw.community.home.startCreating"
                            />
                        </a>
                        {user ? (
                            <Link
                                className={styles.secondaryButton}
                                to="/explore"
                            >
                                <FormattedMessage
                                    defaultMessage="Explore projects"
                                    id="mw.community.home.exploreProjects"
                                />
                            </Link>
                        ) : (
                            <button
                                className={styles.secondaryButton}
                                onClick={login}
                            >
                                <FormattedMessage
                                    defaultMessage="Sign in with Bilup Accounts"
                                    id="mw.community.home.signInRotur"
                                />
                            </button>
                        )}
                        <a
                            className={styles.secondaryButton}
                            href="https://github.com/bilup"
                            target="_blank"
                            rel="noreferrer"
                        >
                            <Github size={16} />
                            <FormattedMessage
                                defaultMessage="Follow on GitHub"
                                id="mw.community.home.followGitHub"
                            />
                        </a>
                    </div>
                </div>
                <div className={styles.heroArt}>
                    <img
                        src={logo}
                        alt=""
                        className={styles.heroLogo}
                    />
                </div>
            </section>

            <div className={styles.homeFeeds}>
                <NewsSection />
                <ActivitySection
                    user={user}
                    login={login}
                />
            </div>

            <Row
                title={<FormattedMessage
                    defaultMessage="Trending"
                    id="mw.community.home.trending"
                />}
                icon={<Sparkles
                    size={19}
                    className={styles.rowIcon}
                />}
                projects={trending}
                loading={loading}
                failed={failed.trending}
                onRetry={retry}
                action={<Link
                    to="/explore?sort=trending"
                    className={styles.seeAll}
                >
                    <FormattedMessage
                        defaultMessage="See all"
                        id="mw.community.home.seeAll"
                    />
                </Link>}
            />
            <Row
                title={<FormattedMessage
                    defaultMessage="Freshly shared"
                    id="mw.community.home.freshlyShared"
                />}
                icon={<Clock
                    size={19}
                    className={styles.rowIcon}
                />}
                projects={recent}
                loading={loading}
                failed={failed.recent}
                onRetry={retry}
                action={<Link
                    to="/explore?sort=recent"
                    className={styles.seeAll}
                >
                    <FormattedMessage
                        defaultMessage="See all"
                        id="mw.community.home.seeAll"
                    />
                </Link>}
            />
        </main>
    );
};

export default Home;
