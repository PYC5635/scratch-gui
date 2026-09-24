import React, {useState} from 'react';
import {Trash2} from 'lucide-react';
import {FormattedMessage} from 'react-intl';
import {useIntl} from '../../lib/tw-use-intl.jsx';
import api from '../api';
import {useUser} from '../UserContext.jsx';
import ReactionButtons from './ReactionButtons.jsx';
import RichText from './RichText.jsx';
import styles from './NewsItem.module.css';

// Format a timestamp as "YYYY-MM-DD HH:mm" (e.g. 2026-08-07 14:30).
const formatDateTime = ms => {
    if (!ms) return '';
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const NewsItem = ({item, onChanged}) => {
    const {user} = useUser();
    const intl = useIntl();
    const canDelete = Boolean(user && user.isAdmin);
    const [error, setError] = useState('');

    const react = async type => {
        setError('');
        try {
            await api.reactNews(item.id, type);
            onChanged();
        } catch (e) {
            setError(e.message || intl.formatMessage({
                id: 'mw.community.newsItem.couldNotReact',
                defaultMessage: 'Could not react.'
            }));
        }
    };

    const remove = async () => {
        if (!window.confirm(intl.formatMessage({
            id: 'mw.community.newsItem.deleteConfirm',
            defaultMessage: 'Delete this update?'
        }))) return;
        setError('');
        try {
            await api.deleteNews(item.id);
            onChanged();
        } catch (e) {
            setError(e.message || intl.formatMessage({
                id: 'mw.community.newsItem.couldNotDelete',
                defaultMessage: 'Could not delete update.'
            }));
        }
    };

    return (
        <article className={styles.item}>
            <div className={styles.head}>
                <h3>{item.title}</h3>
                <span className={styles.date}>{formatDateTime(item.created)}</span>
                {canDelete ? (
                    <button
                        className={styles.delete}
                        title={intl.formatMessage({
                            id: 'mw.community.newsItem.deleteUpdate',
                            defaultMessage: 'Delete update'
                        })}
                        onClick={remove}
                    >
                        <Trash2 size={14} />
                    </button>
                ) : null}
            </div>
            <p className={styles.body}><RichText text={item.body} /></p>
            <div className={styles.footer}>
                <ReactionButtons
                    reactions={item.reactions}
                    onReact={react}
                />
                {item.author ? (
                    <span className={styles.author}>
                        <FormattedMessage
                            defaultMessage="posted by {author}"
                            description="News item author"
                            id="mw.community.newsItem.postedBy"
                            values={{author: item.author}}
                        />
                    </span>
                ) : null}
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
        </article>
    );
};

export default NewsItem;
