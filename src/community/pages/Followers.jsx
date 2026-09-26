import React, {useEffect, useState} from 'react';
import {useParams, Link} from 'react-router-dom';
import {useIntl} from '../../lib/tw-use-intl.jsx';
import {ArrowLeft} from 'lucide-react';
import rotur from '../rotur';
import Avatar from '../components/Avatar.jsx';
import setPageMeta from '../page-meta.js';
import useLatest from '../use-latest.js';
import styles from './Followers.module.css';

const Followers = () => {
    const {name} = useParams();
    const intl = useIntl();
    const [followers, setFollowers] = useState(null);
    const beginLoad = useLatest();

    useEffect(() => {
        setPageMeta({
            title: intl.formatMessage({
                id: 'mw.community.followers.title',
                defaultMessage: '{name}\'s followers'
            }, {name}),
            image: rotur.avatar(name, 256),
            card: 'summary'
        });
    }, [name, intl]);

    useEffect(() => {
        const fresh = beginLoad();
        setFollowers(null);
        rotur.followers(name)
            .then(fresh(data => setFollowers(data.followers || [])))
            .catch(fresh(() => setFollowers([])));
    }, [name, beginLoad]);

    return (
        <main className={styles.page}>
            <Link
                to={`/users/${name}`}
                className={styles.backLink}
            >
                <ArrowLeft size={14} />
                {name}
            </Link>
            <h1>{intl.formatMessage({
                id: 'mw.community.followers.title',
                defaultMessage: '{name}\'s followers'
            }, {name})}</h1>
            {followers === null ? (
                <p className={styles.status}>{intl.formatMessage({
                    id: 'mw.community.followers.loading',
                    defaultMessage: 'Loading…'
                })}</p>
            ) : followers.length ? (
                <div className={styles.grid}>
                    {followers.map(follower => (
                        <Link
                            key={follower}
                            to={`/users/${follower}`}
                            className={styles.cell}
                        >
                            <Avatar
                                username={follower}
                                size={72}
                            />
                            <span>{follower}</span>
                        </Link>
                    ))}
                </div>
            ) : (
                <p className={styles.status}>{intl.formatMessage({
                    id: 'mw.community.followers.empty',
                    defaultMessage: 'No followers yet.'
                })}</p>
            )}
        </main>
    );
};

export default Followers;
