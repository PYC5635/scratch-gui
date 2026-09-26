import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import {FormattedMessage} from 'react-intl';
import {AlertTriangle, Check, X} from 'lucide-react';

import Modal from '../../containers/windowed-modal.jsx';
import Button from '../button/button.jsx';

import styles from './shortcut-manager.css';

const ConflictWarning = ({
    conflictInfo,
    onConfirm,
    onCancel
}) => {
    if (!conflictInfo) return null;

    const {shortcutId, newKey, conflicts} = conflictInfo;

    return (
        <Modal
            visible
            onRequestClose={onCancel}
            width={500}
            height={300}
            showCloseButton={false}
        >
            <div className={styles.conflictWarning}>
                <div className={styles.conflictHeader}>
                    <AlertTriangle
                        size={24}
                        className={styles.conflictIcon}
                    />
                    <h3>
                        <FormattedMessage
                            defaultMessage="Shortcut Conflict"
                            id="shortcut-manager.conflictTitle"
                        />
                    </h3>
                </div>

                <div className={styles.conflictMessage}>
                    <p>
                        <FormattedMessage
                            defaultMessage="This combination is already used by:"
                            id="shortcut-manager.conflictUsedBy"
                        />
                    </p>
                    <ul className={styles.conflictList}>
                        {conflicts.map(conflict => (
                            <li
                                key={conflict.id}
                                className={styles.conflictItem}
                            >
                                <strong>{conflict.label}</strong>
                            </li>
                        ))}
                    </ul>
                    <p className={styles.conflictQuestion}>
                        <FormattedMessage
                            defaultMessage="Do you want to replace it?"
                            id="shortcut-manager.conflictReplaceQuestion"
                        />
                    </p>
                </div>

                <div className={styles.conflictButtons}>
                    <Button
                        onClick={onCancel}
                        className={styles.conflictButton}
                    >
                        <X size={16} />
                        <FormattedMessage
                            defaultMessage="Keep Existing"
                            id="shortcut-manager.conflictKeep"
                        />
                    </Button>
                    <Button
                        onClick={onConfirm}
                        className={classNames(styles.conflictButton, styles.confirmButton)}
                    >
                        <Check size={16} />
                        <FormattedMessage
                            defaultMessage="Replace"
                            id="shortcut-manager.conflictReplace"
                        />
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

ConflictWarning.propTypes = {
    conflictInfo: PropTypes.shape({
        shortcutId: PropTypes.string,
        newKey: PropTypes.string,
        conflicts: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.string,
            label: PropTypes.string
        }))
    }),
    onConfirm: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
};

export default ConflictWarning;
