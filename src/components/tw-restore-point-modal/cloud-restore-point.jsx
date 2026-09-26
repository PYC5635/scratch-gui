import React from 'react';
import PropTypes from 'prop-types';
import {defineMessages, FormattedDate, FormattedTime, FormattedRelative, injectIntl, intlShape} from 'react-intl';
import styles from './restore-point-modal.css';
import {Trash, Link, ExternalLink, Edit} from 'lucide-react';

const messages = defineMessages({
    openInEditor: {
        defaultMessage: 'Open in editor',
        description: 'Button to open a restore point in the editor',
        id: 'tw.restorePoints.openInEditor'
    },
    openInGitHub: {
        defaultMessage: 'Open in GitHub',
        description: 'Button to open a restore point on GitHub',
        id: 'tw.restorePoints.openInGitHub'
    },
    copyDownloadLink: {
        defaultMessage: 'Copy download link',
        description: 'Button to copy a restore point download link',
        id: 'tw.restorePoints.copyDownloadLink'
    },
    delete: {
        defaultMessage: 'Delete',
        description: 'Button to delete a restore point',
        id: 'tw.restorePoints.delete'
    }
});

const relativeTimeSupported = () => typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat !== 'undefined';

const CloudRestorePoint = props => {
    const {intl} = props;
    const createdDate = new Date(props.created * 1000);

    const handleClickDelete = e => {
        e.stopPropagation();
        props.onClickDelete(props.id, props.filename);
    };

    const handleClickCopyLink = e => {
        e.stopPropagation();
        props.onClickCopyLink(props.id, props.filename);
    };

    const handleClickGitHub = e => {
        e.stopPropagation();
        if (props.downloadUrl) {
            window.open(props.downloadUrl, '_blank', 'noopener,noreferrer');
        }
    };

    const handleClickOpenInEditor = e => {
        e.stopPropagation();
        props.onClickOpenInEditor(props.id);
    };

    return (
        <div className={styles.cloudRestorePoint}>
            <div className={styles.cloudRestorePointInfo}>
                <a
                    href={props.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.cloudRestorePointTitle}
                    title={props.downloadUrl}
                >
                    {props.title}
                </a>

                <div>
                    {relativeTimeSupported() && (
                        <span>
                            <FormattedRelative value={createdDate} />
                            {' ('}
                        </span>
                    )}
                    <FormattedDate value={createdDate} />
                    {', '}
                    <FormattedTime value={createdDate} />
                    {relativeTimeSupported() && ')'}
                </div>

                {props.hash && (
                    <div className={styles.cloudRestorePointVersion}>
                        Hash: {props.hash.substring(0, 7)}
                    </div>
                )}
            </div>

            <div className={styles.cloudRestorePointButtons}>
                <button
                    className={styles.cloudRestorePointButton}
                    onClick={handleClickOpenInEditor}
                    title={intl.formatMessage(messages.openInEditor)}
                    disabled={!props.downloadUrl}
                >
                    <Edit size={16} />
                </button>

                <button
                    className={styles.cloudRestorePointButton}
                    onClick={handleClickGitHub}
                    title={intl.formatMessage(messages.openInGitHub)}
                >
                    <ExternalLink size={16} />
                </button>

                <button
                    className={styles.cloudRestorePointButton}
                    onClick={handleClickCopyLink}
                    title={intl.formatMessage(messages.copyDownloadLink)}
                >
                    <Link size={16} />
                </button>

                <button
                    className={styles.cloudRestorePointButton}
                    onClick={handleClickDelete}
                    title={intl.formatMessage(messages.delete)}
                >
                    <Trash size={16} />
                </button>
            </div>
        </div>
    );
};

CloudRestorePoint.propTypes = {
    intl: intlShape.isRequired,
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    created: PropTypes.number.isRequired,
    filename: PropTypes.string,
    hash: PropTypes.string,
    downloadUrl: PropTypes.string,
    onClickDelete: PropTypes.func.isRequired,
    onClickCopyLink: PropTypes.func.isRequired,
    onClickOpenInEditor: PropTypes.func.isRequired
};

export default injectIntl(CloudRestorePoint);
