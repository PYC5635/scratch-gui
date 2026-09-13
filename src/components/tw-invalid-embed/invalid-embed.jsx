import React from 'react';
import styles from './invalid-embed.css';
import {APP_NAME, FEEDBACK_URL} from '../../lib/constants/brand';

// Note that when this component is used, the rest of scratch-gui is not being run, so don't
// use redux, themes, translations, etc.

// We also can't be certain that the iframe sandbox will let us open up links, so make sure
// all the links can be manually visited if necessary.

const InvalidEmbed = () => (
    <div className={styles.container}>
        <h1>{`Invalid ${APP_NAME} Embed :(`}</h1>
        <p>
            {'See '}
            <a
                href="https://docs.bilup.org/advanced/embedding"
                target="_blank"
                rel="noreferrer"
            >
                {'docs.bilup.org/advanced/embedding'}
            </a>
            {/* eslint-disable-next-line max-len */}
            {' for more information.'}
        </p>
    </div>
);

export default InvalidEmbed;
