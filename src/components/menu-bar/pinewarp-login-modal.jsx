import React, {useState} from 'react';
import PropTypes from 'prop-types';
import {defineMessages, FormattedMessage, injectIntl, intlShape} from 'react-intl';
import classNames from 'classnames';

import Modal from '../../containers/windowed-modal.jsx';
import Box from '../box/box.jsx';

import styles from './pinewarp-login-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Login PineWarp Accounts',
        id: 'pinewarp.loginModal.title',
        description: 'Title of the PineWarp Accounts login modal'
    },
    heading: {
        defaultMessage: 'Connect PineWarp to PineWarp Accounts',
        id: 'pinewarp.loginModal.heading',
        description: 'Heading of the PineWarp Accounts login modal'
    },
    description: {
        defaultMessage: 'Sign in to your PineWarp Accounts to access cloud sync, activity feeds, and more.',
        id: 'pinewarp.loginModal.description',
        description: 'Description text in the PineWarp Accounts login modal'
    },
    afterLoginLabel: {
        defaultMessage: 'After logging in to PINEWARP ACCOUNTS, you can:',
        id: 'pinewarp.loginModal.afterLoginLabel',
        description: 'Label introducing the features available after login'
    },
    featureShareTitle: {
        defaultMessage: 'Share editing status',
        id: 'pinewarp.loginModal.featureShareTitle',
        description: 'Title of the share editing status feature card'
    },
    featureShareDesc: {
        defaultMessage: 'Show your PineWarp activity on your PineWarp Accounts profile.',
        id: 'pinewarp.loginModal.featureShareDesc',
        description: 'Description of the share editing status feature'
    },
    featureCloudTitle: {
        defaultMessage: 'Cloud themes and settings',
        id: 'pinewarp.loginModal.featureCloudTitle',
        description: 'Title of the cloud themes and settings feature card'
    },
    featureCloudDesc: {
        defaultMessage: 'Sync your themes and settings across devices after signing in.',
        id: 'pinewarp.loginModal.featureCloudDesc',
        description: 'Description of the cloud themes and settings feature'
    },
    featureGitTitle: {
        defaultMessage: 'PineWarp Git in the Git window',
        id: 'pinewarp.loginModal.featureGitTitle',
        description: 'Title of the PineWarp Git feature card'
    },
    featureGitDesc: {
        defaultMessage: 'Create repositories, push projects, and clone others on git.pinewarp.org.',
        id: 'pinewarp.loginModal.featureGitDesc',
        description: 'Description of the PineWarp Git feature'
    },
    comingSoonLabel: {
        defaultMessage: 'Coming soon',
        id: 'pinewarp.loginModal.comingSoonLabel',
        description: 'Label for the coming soon section'
    },
    featureFriendsTitle: {
        defaultMessage: 'Friends and collaboration invites',
        id: 'pinewarp.loginModal.featureFriendsTitle',
        description: 'Title of the friends and collaboration feature card'
    },
    featureFriendsDesc: {
        defaultMessage: 'See online friends on PineWarp and send them collaboration invites.',
        id: 'pinewarp.loginModal.featureFriendsDesc',
        description: 'Description of the friends and collaboration feature'
    },
    laterButton: {
        defaultMessage: 'Not now',
        id: 'pinewarp.loginModal.laterButton',
        description: 'Button to dismiss the login modal without logging in'
    },
    continueButton: {
        defaultMessage: 'Continue to PineWarp Accounts',
        id: 'pinewarp.loginModal.continueButton',
        description: 'Button to proceed to login on PineWarp Accounts'
    },
    footerNote: {
        defaultMessage: 'Sign in securely at accounts.pinewarp.org. Your account supports online status, cloud sync, and PineWarp Git.',
        id: 'pinewarp.loginModal.footerNote',
        description: 'Footer note about PineWarp Accounts login'
    }
});

const PineWarpLoginModalComponent = props => {
    const {
        intl,
        visible,
        onCancel,
        onContinue
    } = props;

    // PineWarp 登录功能尚未开放：点击后仅显示"开发中……"提示，不做任何跳转
    const [comingSoon, setComingSoon] = useState(false);

    const handleContinue = () => {
        if (onContinue) {
            onContinue();
            return;
        }
        setComingSoon(true);
    };

    return (
        <Modal
            visible={visible}
            className={styles.modalContent}
            onRequestClose={onCancel}
            contentLabel={intl.formatMessage(messages.title)}
            id="pinewarpLoginModal"
            resizable={false}
            maximizable={false}
            width={520}
            height={560}
        >
            <Box className={styles.body}>
                <div className={styles.headerRow}>
                    <div className={styles.iconWrap}>
                        <svg
                            className={styles.headerIcon}
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M12 19l7-7 3 3-7 7-3-3z" />
                            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                            <path d="M2 2l7.586 7.586" />
                            <circle cx="11" cy="11" r="2" />
                        </svg>
                    </div>
                    <h2 className={styles.heading}>
                        <FormattedMessage {...messages.heading} />
                    </h2>
                </div>

                <p className={styles.description}>
                    <FormattedMessage {...messages.description} />
                </p>

                <p className={styles.afterLoginLabel}>
                    <FormattedMessage {...messages.afterLoginLabel} />
                </p>

                <div className={styles.featureList}>
                    <div className={styles.featureItem}>
                        <div className={classNames(styles.featureIcon, styles.featureIconShare)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="18" cy="5" r="3" />
                                <circle cx="6" cy="12" r="3" />
                                <circle cx="18" cy="19" r="3" />
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                            </svg>
                        </div>
                        <div className={styles.featureText}>
                            <div className={styles.featureTitle}>
                                <FormattedMessage {...messages.featureShareTitle} />
                            </div>
                            <div className={styles.featureDesc}>
                                <FormattedMessage {...messages.featureShareDesc} />
                            </div>
                        </div>
                    </div>

                    <div className={styles.featureItem}>
                        <div className={classNames(styles.featureIcon, styles.featureIconCloud)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                            </svg>
                        </div>
                        <div className={styles.featureText}>
                            <div className={styles.featureTitle}>
                                <FormattedMessage {...messages.featureCloudTitle} />
                            </div>
                            <div className={styles.featureDesc}>
                                <FormattedMessage {...messages.featureCloudDesc} />
                            </div>
                        </div>
                    </div>

                    <div className={styles.featureItem}>
                        <div className={classNames(styles.featureIcon, styles.featureIconGit)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <line x1="6" y1="3" x2="6" y2="15" />
                                <circle cx="18" cy="6" r="3" />
                                <circle cx="6" cy="18" r="3" />
                                <path d="M18 9a9 9 0 0 1-9 9" />
                            </svg>
                        </div>
                        <div className={styles.featureText}>
                            <div className={styles.featureTitle}>
                                <FormattedMessage {...messages.featureGitTitle} />
                            </div>
                            <div className={styles.featureDesc}>
                                <FormattedMessage {...messages.featureGitDesc} />
                            </div>
                        </div>
                    </div>
                </div>

                <p className={styles.comingSoonLabel}>
                    <FormattedMessage {...messages.comingSoonLabel} />
                </p>

                <div className={styles.featureList}>
                    <div className={styles.featureItem}>
                        <div className={classNames(styles.featureIcon, styles.featureIconFriends)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </div>
                        <div className={styles.featureText}>
                            <div className={styles.featureTitle}>
                                <FormattedMessage {...messages.featureFriendsTitle} />
                            </div>
                            <div className={styles.featureDesc}>
                                <FormattedMessage {...messages.featureFriendsDesc} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.buttonRow}>
                    <button
                        className={styles.laterButton}
                        onClick={onCancel}
                    >
                        <FormattedMessage {...messages.laterButton} />
                    </button>
                    <button
                        className={styles.continueButton}
                        disabled={comingSoon}
                        onClick={handleContinue}
                    >
                        {comingSoon ? '开发中……' : <FormattedMessage {...messages.continueButton} />}
                    </button>
                </div>

                {comingSoon ? (
                    <p className={styles.footerNote}>
                        开发中……（登录功能尚未开放，敬请期待）
                    </p>
                ) : (
                    <p className={styles.footerNote}>
                        <FormattedMessage {...messages.footerNote} />
                    </p>
                )}
            </Box>
        </Modal>
    );
};

PineWarpLoginModalComponent.propTypes = {
    intl: intlShape,
    visible: PropTypes.bool,
    onCancel: PropTypes.func,
    onContinue: PropTypes.func
};

PineWarpLoginModalComponent.defaultProps = {
    visible: false,
    onCancel: () => {},
    onContinue: null
};

const PineWarpLoginModal = injectIntl(PineWarpLoginModalComponent);

// 兼容两种使用方式：<PineWarpLoginModal visible={...} /> 或 <PineWarpLoginModal.WrappedComponent ... />
export default PineWarpLoginModal;
export {PineWarpLoginModalComponent};