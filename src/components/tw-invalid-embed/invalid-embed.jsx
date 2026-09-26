import React from 'react';
import styles from './invalid-embed.css';
import {APP_NAME} from '../../lib/constants/brand';

// Note that when this component is used, the rest of scratch-gui is not being run, so don't
// use redux, themes, translations, etc. Instead we do a tiny localStorage/navigator check.

// We also can't be certain that the iframe sandbox will let us open up links, so make sure
// all the links can be manually visited if necessary.

const isChinese = () => {
    try {
        const stored = localStorage.getItem('tw:language');
        if (stored) return stored.toLowerCase().indexOf('zh') === 0;
    } catch (e) { /* ignore */ }
    return (navigator.language || '').toLowerCase().indexOf('zh') === 0;
};

const InvalidEmbed = () => {
    const zh = isChinese();
    return (
        <div className={styles.container}>
            <h1>{zh ? `无效的 ${APP_NAME} 嵌入 :(` : `Invalid ${APP_NAME} Embed :(`}</h1>
            <p>
                {zh ? '请参阅 ' : 'See '}
                <a
                    href="https://docs.pinewarp.org/advanced/embedding"
                    target="_blank"
                    rel="noreferrer"
                >
                    {'docs.pinewarp.org/advanced/embedding'}
                </a>
                {zh ? ' 了解更多信息。' : ' for more information.'}
            </p>
        </div>
    );
};

export default InvalidEmbed;