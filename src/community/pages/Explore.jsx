import React, {useEffect, useState} from 'react';
import {useSearchParams, Link} from 'react-router-dom';
import {FormattedMessage} from 'react-intl';
import {useIntl} from '../../lib/tw-use-intl.jsx';
import api from '../api';
import useLatest from '../use-latest.js';
import ProjectCard from '../components/ProjectCard.jsx';
import Avatar from '../components/Avatar.jsx';
import Button from '../components/ui/Button.jsx';
import styles from './Explore.module.css';

const SORT_KEYS = [
    {key: 'trending', id: 'mw.community.explore.trending', default: 'Trending'},
    {key: 'recent', id: 'mw.community.explore.recent', default: 'Recent'},
    {key: 'loved', id: 'mw.community.explore.mostLoved', default: 'Most loved'}
];

const Explore = () => {
    const intl = useIntl();
    const [params, setParams] = useSearchParams();
    const sort = params.get('sort') || 'trending';
    const q = params.get('q') || '';
    const [projects, setProjects] = useState([]);
    const [people, setPeople] = useState([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);

    const beginLoad = useLatest();

    useEffect(() => {
        const fresh = beginLoad();
        setLoading(true);
        setFailed(false);
        api.explore({sort, q, limit: 48})
            .then(fresh(data => setProjects(data.projects || [])))
            .catch(fresh(() => setFailed(true)))
            .finally(fresh(() => setLoading(false)));
        if (q.trim()) {
            api.searchUsers(q.trim())
                .then(fresh(data => setPeople((data.users || []).slice(0, 5))))
                .catch(fresh(() => setPeople([])));
        } else {
            setPeople([]);
        }
    }, [sort, q, beginLoad, attempt]);

    const setSort = key => {
        const next = new URLSearchParams(params);
        next.set('sort', key);
        setParams(next);
    };

    const sorts = SORT_KEYS.map(option => ({
        key: option.key,
        label: intl.formatMessage({id: option.id, defaultMessage: option.default})
    }));

    return (
        <main className={styles.page}>
            <div className={styles.head}>
                <h1>
                    {q ?
                        intl.formatMessage({
                            id: 'mw.community.explore.resultsFor',
                            defaultMessage: 'Results for "{q}"'
                        }, {q}) :
                        intl.formatMessage({
                            id: 'mw.community.explore.title',
                            defaultMessage: 'Explore'
                        })}
                </h1>
                <div className={styles.tabs}>
                    {sorts.map(option => (
                        <button
                            key={option.key}
                            className={option.key === sort ? styles.tabActive : styles.tab}
                            onClick={() => setSort(option.key)}
                        >{option.label}</button>
                    ))}
                </div>
            </div>
            {people.length ? (
                <div className={styles.people}>
                    {people.map(person => (
                        <Link
                            key={person.username}
                            to={`/users/${person.username}`}
                            className={styles.person}
                        >
                            <Avatar
                                username={person.username}
                                size={44}
                            />
                            <div className={styles.personInfo}>
                                <span className={styles.personName}>{person.username}</span>
                                <span className={styles.personMeta}>
                                    <FormattedMessage
                                        defaultMessage="{count} followers"
                                        description="User follower count on the explore page"
                                        id="mw.community.explore.followers"
                                        values={{count: person.followers ?? 0}}
                                    />
                                    <br />
                                    <FormattedMessage
                                        defaultMessage="{count} projects"
                                        description="User project count on the explore page"
                                        id="mw.community.explore.projects"
                                        values={{count: person.projects}}
                                    />
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : null}
            {loading ? (
                <p className={styles.status}>
                    <FormattedMessage
                        defaultMessage="Loading…"
                        description="Explore page loading state"
                        id="mw.community.explore.loading"
                    />
                </p>
            ) : failed ? (
                <p className={styles.status}>
                    <FormattedMessage
                        defaultMessage="Couldn't load."
                        description="Explore page load failure"
                        id="mw.community.explore.failed"
                    />{' '}
                    <Button onClick={() => setAttempt(a => a + 1)}>
                        <FormattedMessage
                            defaultMessage="Try again"
                            description="Retry button on the explore page"
                            id="mw.community.explore.tryAgain"
                        />
                    </Button>
                </p>
            ) : projects.length ? (
                <div className={styles.grid}>
                    {projects.map(project => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                        />
                    ))}
                </div>
            ) : (
                <p className={styles.status}>
                    <FormattedMessage
                        defaultMessage="No projects found."
                        description="Explore page empty state"
                        id="mw.community.explore.noProjects"
                    />
                </p>
            )}
        </main>
    );
};

export default Explore;
