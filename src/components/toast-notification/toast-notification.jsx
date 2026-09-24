import {intlShape, injectIntl} from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import styles from './toast-notification.css';

// One glyph per level, so the corner toast reads at a glance: ❌ marks a
// failure (the git layer's only channel for errors — see A3), which is why the
// icon lives next to the message rather than being baked into its text.
const ICONS = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
};

const ToastNotificationComponent = props => {
    const {message, type = 'info', position = 'top-right', visible, onClose} = props;
    const intl = props.intl;

    const [closing, setClosing] = React.useState(false);

    const handleClose = React.useCallback(() => {
        setClosing(true);
    }, []);

    React.useEffect(() => {
        if (!visible || !message) {
            setClosing(false);
            return;
        }
        const timeout = setTimeout(() => {
            setClosing(true);
        }, 3000);
        return () => clearTimeout(timeout);
    }, [visible, message, type]);

    React.useEffect(() => {
        if (!closing) return () => {};
        const timeout = setTimeout(() => {
            onClose();
            setClosing(false);
        }, 300);
        return () => clearTimeout(timeout);
    }, [closing, onClose]);

    if (!visible || !message) return null;

    return (
        <div
            className={classNames(
                styles.toast,
                styles[type],
                position === 'bottom-right' ? styles.bottomRight : styles.topRight,
                closing ? styles.closing : null
            )}
            role="alert"
            aria-live="polite"
        >
            <span
                className={styles.icon}
                aria-hidden="true"
            >{ICONS[type] || ICONS.info}</span>
            <span className={styles.message}>
                {message}
            </span>
            <button
                className={styles.closeButton}
                onClick={handleClose}
                aria-label={intl.formatMessage({
                    defaultMessage: 'Close notification',
                    id: 'tw.toast.close'
                })}
            >
                {'×'}
            </button>
        </div>
    );
};

ToastNotificationComponent.propTypes = {
    intl: intlShape,
    message: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    type: PropTypes.oneOf(['success', 'error', 'info', 'warning']),
    position: PropTypes.oneOf(['top-right', 'bottom-right']),
    visible: PropTypes.bool,
    onClose: PropTypes.func.isRequired
};

export default injectIntl(ToastNotificationComponent);
