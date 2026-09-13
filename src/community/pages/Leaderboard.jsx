import React, {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {useIntl} from '../../lib/tw-use-intl.jsx';
import {Users, Trophy, Heart, Play} from 'lucide-react';
import rotur from '../rotur';
import api from '../api';
import useLatest from '../use-latest.js';
import Avatar from '../components/Avatar.jsx';
import styles from './Leaderboard.module.css';

const PODIUM_CLASSES = [styles.podium1, styles.podium2, styles.podium3];

const Stat = ({board, person}) => {
    const intl = useIntl();
    if (board === 'loves') {
        return (
            <span className={styles.stat}>
                <Heart size={16} />
                {intl.formatMessage({
                    id: 'mw.community.leaderboard.loves',
                    defaultMessage: '{count} loves'
                }, {count: (person.loves || 0).toLocaleString()})}
            </span>
        );
    }
    if (board === 'views') {
        return (
            <span className={styles.stat}>
                <Play size={16} />
                {intl.formatMessage({
                    id: 'mw.community.leaderboard.views',
                    defaultMessage: '{count} views'
                }, {count: (person.views || 0).toLocaleString()})}
            </span>
        );
    }
    return (
        <span className={styles.stat}>
            <Users size={16} />
            {intl.formatMessage({
                id: 'mw.community.leaderboard.followers',
                defaultMessage: '{count} followers'
            }, {count: (person.follower_count || 0).toLocaleString()})}
        </span>
    );
};

const BOARDS = [
    {
        key: 'followers',
        labelKey: 'mw.community.leaderboard.board.followers',
        labelDefault: 'Followers',
        titleKey: 'mw.community.leaderboard.title.followers',
        titleDefault: 'Most followed users',
        leadKey: 'mw.community.leaderboard.lead.followers',
        leadDefault: 'The most followed public Bilup Accounts accounts.'
    },
    {
        key: 'loves',
        labelKey: 'mw.community.leaderboard.board.loves',
        labelDefault: 'Loves',
        titleKey: 'mw.community.leaderboard.title.loves',
        titleDefault: 'Most loved creators',
        leadKey: 'mw.community.leaderboard.lead.loves',
        leadDefault: 'Creators with the most loves across all their shared projects.'
    },
    {
        key: 'views',
        labelKey: 'mw.community.leaderboard.board.views',
        labelDefault: 'Views',
        titleKey: 'mw.community.leaderboard.title.views',
        titleDefault: 'Most viewed creators',
        leadKey: 'mw.community.leaderboard.lead.views',
        leadDefault: 'Creators with the most views across all their shared projects.'
    }
];

const Leaderboard = () => {
    const intl = useIntl();
    const [board, setBoard] = useState('followers');
    const [users, setUsers] = useState(null);
    const [error, setError] = useState('');
    const beginLoad = useLatest();
    const active = BOARDS.find(item => item.key === board);
    const boardLabel = item => intl.formatMessage({id: item.labelKey, defaultMessage: item.labelDefault});

    useEffect(() => {
        const fresh = beginLoad();
        setUsers(null);
        setError('');
        const load = board === 'followers' ?
            rotur.followerLeaderboard() :
            api.leaderboard(board).then(data => data.users || []);
        load
            .then(fresh(setUsers))
            .catch(fresh(() => {
                setUsers([]);
                setError(intl.formatMessage({
                    id: 'mw.community.leaderboard.loadFailed',
                    defaultMessage: 'Could not load the leaderboard.'
                }));
            }));
    }, [board, intl]);

    return (
        <main className={styles.page}>
            <h1>{intl.formatMessage({id: active.titleKey, defaultMessage: active.titleDefault})}</h1>
            <p className={styles.lead}>{intl.formatMessage({id: active.leadKey, defaultMessage: active.leadDefault})}</p>
            <div className={styles.tabs}>
                {BOARDS.map(item => (
                    <button
                        key={item.key}
                        className={item.key === board ? styles.tabActive : styles.tab}
                        onClick={() => setBoard(item.key)}
                    >
                        {boardLabel(item)}
                    </button>
                ))}
            </div>
            {users === null ? (
                <p className={styles.status}>{intl.formatMessage({
                    id: 'mw.community.leaderboard.loading',
                    defaultMessage: 'Loading…'
                })}</p>
            ) : error ? (
                <p className={styles.status}>{error}</p>
            ) : !users.length ? (
                <p className={styles.status}>{intl.formatMessage({
                    id: 'mw.community.leaderboard.empty',
                    defaultMessage: 'No one on this leaderboard yet.'
                })}</p>
            ) : (
                <ol className={styles.list}>
                    {users.map((person, position) => (
                        <li key={person.username}>
                            <Link
                                to={`/users/${person.username}`}
                                className={styles.row}
                            >
                                <span className={`${styles.rank} ${PODIUM_CLASSES[position] || ''}`}>
                                    {position < 3 ? <Trophy size={22} /> : position + 1}
                                </span>
                                <Avatar
                                    username={person.username}
                                    size={52}
                                />
                                <span className={styles.identity}>
                                    <strong>{person.username}</strong>
                                    {board === 'followers' ? (
                                        <span>{typeof person.index === 'number' ?
                                            intl.formatMessage({
                                                id: 'mw.community.leaderboard.accountNumber',
                                                defaultMessage: 'Account #{index}'
                                            }, {index: person.index}) :
                                            intl.formatMessage({
                                                id: 'mw.community.leaderboard.accountUnavailable',
                                                defaultMessage: 'Account number unavailable'
                                            })}</span>
                                    ) : (
                                        <span>{intl.formatMessage({
                                            id: 'mw.community.leaderboard.sharedProjects',
                                            defaultMessage: '{count} shared {count, plural, one {project} other {projects}}'
                                        }, {count: person.projects || 0})}</span>
                                    )}
                                    {board === 'followers' && person.status ? (
                                        <span>{person.status.status || person.status.presence}</span>
                                    ) : null}
                                </span>
                                <Stat
                                    board={board}
                                    person={person}
                                />
                            </Link>
                        </li>
                    ))}
                </ol>
            )}
        </main>
    );
};

export default Leaderboard;
