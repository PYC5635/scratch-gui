import React from 'react';
import PropTypes from 'prop-types';
import {FormattedMessage} from 'react-intl';
import {APP_NAME} from '../../lib/constants/brand';
import UserData from '../../playground/credits/users';
import styles from './Credits.module.css';

const User = ({image, text, href}) => (
    <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={styles.user}
    >
        {image ? (
            <img
                loading="lazy"
                className={styles.userImage}
                src={image}
                alt={text}
                width="60"
                height="60"
            />
        ) : (
            <span
                className={styles.userAvatar}
                aria-hidden="true"
            >
                {(text || '?').charAt(0).toUpperCase()}
            </span>
        )}
        <span className={styles.userInfo}>{text}</span>
    </a>
);
User.propTypes = {
    image: PropTypes.string,
    text: PropTypes.string.isRequired,
    href: PropTypes.string
};

const UserList = ({users}) => (
    <div className={styles.users}>
        {users.map((data, index) => (
            <User
                key={index}
                {...data}
            />
        ))}
    </div>
);
UserList.propTypes = {
    users: PropTypes.arrayOf(PropTypes.object)
};

const Credits = () => (
    <main className={styles.page}>
        <div className={styles.hero}>
            <h1>
                <FormattedMessage
                    defaultMessage="{APP_NAME} Credits"
                    description="Credits page title"
                    id="mw.community.credits.title"
                    values={{APP_NAME}}
                />
            </h1>
            <p className={styles.intro}>
                <FormattedMessage
                    defaultMessage="The {APP_NAME} project is made possible by the work of many volunteers."
                    description="Credits page intro"
                    id="mw.community.credits.intro"
                    values={{APP_NAME}}
                />
            </p>
        </div>

        {APP_NAME !== 'TurboWarp' && (
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>TurboWarp</h2>
                <p className={styles.body}>
                    <FormattedMessage
                        defaultMessage="{APP_NAME} is based on {turbowarpLink}."
                        description="Credits mention of TurboWarp"
                        id="mw.community.credits.turbowarp"
                        values={{
                            APP_NAME,
                            turbowarpLink: (
                                <a
                                    href="https://turbowarp.org/"
                                    target="_blank"
                                    rel="noreferrer"
                                >TurboWarp</a>
                            )
                        }}
                    />
                </p>
            </section>
        )}

        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Scratch</h2>
            <p className={styles.body}>
                <FormattedMessage
                    defaultMessage="{APP_NAME} is based on the work of the {scratchLink} but is not endorsed by Scratch in any way."
                    description="Credits mention of Scratch"
                    id="mw.community.credits.scratch"
                    values={{
                        APP_NAME,
                        scratchLink: (
                            <a
                                href="https://scratch.mit.edu/credits"
                                target="_blank"
                                rel="noreferrer"
                            >
                                <FormattedMessage
                                    defaultMessage="Scratch contributors"
                                    description="Link to Scratch credits"
                                    id="mw.community.credits.scratchContributors"
                                />
                            </a>
                        )
                    }}
                />
            </p>
            <p className={styles.body}>
                <a
                    href="https://scratch.mit.edu/donate"
                    target="_blank"
                    rel="noreferrer"
                >
                    <FormattedMessage
                        defaultMessage="Donate to support Scratch."
                        description="Link to donate to Scratch"
                        id="mw.community.credits.donate"
                    />
                </a>
            </p>
        </section>

        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
                <FormattedMessage
                    defaultMessage="Contributors"
                    description="Credits section title"
                    id="mw.community.credits.contributors"
                />
            </h2>
            <UserList users={UserData.contributors} />
        </section>

        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
                <FormattedMessage
                    defaultMessage="Addons"
                    description="Credits section title"
                    id="mw.community.credits.addons"
                />
            </h2>
            <UserList users={UserData.addonDevelopers} />
        </section>

        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
                <FormattedMessage
                    defaultMessage="Bilup Extension Gallery"
                    description="Credits section title"
                    id="mw.community.credits.extensionGallery"
                />
            </h2>
            <UserList users={UserData.extensionDevelopers} />
        </section>

        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
                <FormattedMessage
                    defaultMessage="Documentation"
                    description="Credits section title"
                    id="mw.community.credits.documentation"
                />
            </h2>
            <UserList users={UserData.docs} />
        </section>

        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
                <FormattedMessage
                    defaultMessage="Translators"
                    description="Credits section title"
                    id="mw.community.credits.translators"
                />
            </h2>
            <UserList users={UserData.translators} />
        </section>

        <p className={styles.footnote}>
            <FormattedMessage
                defaultMessage="Individual contributors and organizations are listed in no particular order. The order is randomized each visit."
                description="Credits page footnote"
                id="mw.community.credits.footnote"
            />
        </p>
    </main>
);

export default Credits;
