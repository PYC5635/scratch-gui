import React from 'react';
import PropTypes from 'prop-types';
import {injectIntl, intlShape, defineMessages, FormattedMessage} from 'react-intl';
import styles from './fonts-modal.css';
import bindAll from 'lodash.bindall';
import classNames from 'classnames';

const FALLBACK_FONTS = [
    'Sans Serif',
    'Serif',
    'Handwriting',
    'Marker',
    'Curly',
    'Pixel',
    'Scratch'
];

const messages = defineMessages({
    'Sans Serif': {
        defaultMessage: 'Sans Serif',
        description: 'Name of the Sans Serif fallback font',
        id: 'tw.fonts.fallback.sansSerif'
    },
    'Serif': {
        defaultMessage: 'Serif',
        description: 'Name of the Serif fallback font',
        id: 'tw.fonts.fallback.serif'
    },
    'Handwriting': {
        defaultMessage: 'Handwriting',
        description: 'Name of the Handwriting fallback font',
        id: 'tw.fonts.fallback.handwriting'
    },
    'Marker': {
        defaultMessage: 'Marker',
        description: 'Name of the Marker fallback font',
        id: 'tw.fonts.fallback.marker'
    },
    'Curly': {
        defaultMessage: 'Curly',
        description: 'Name of the Curly fallback font',
        id: 'tw.fonts.fallback.curly'
    },
    'Pixel': {
        defaultMessage: 'Pixel',
        description: 'Name of the Pixel fallback font',
        id: 'tw.fonts.fallback.pixel'
    },
    'Scratch': {
        defaultMessage: 'Scratch',
        description: 'Name of the Scratch fallback font',
        id: 'tw.fonts.fallback.scratch'
    }
});

class FontFallback extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleClick'
        ]);
    }

    handleClick (family) {
        this.props.onChange(family);
    }

    render () {
        const {intl} = this.props;
        return (
            <div className={styles.fallbackContainer}>
                <div className={styles.fallbackLabel}>
                    <FormattedMessage
                        defaultMessage="Choose a fallback font to use if the font fails to load or is deleted:"
                        description="Part of font management modal."
                        id="tw.fonts.fallback"
                    />
                </div>

                <div className={styles.fallbackList}>
                    {FALLBACK_FONTS.map(family => (
                        <div
                            key={family}
                            className={classNames(styles.fallbackItem, {
                                [styles.fallbackItemSelected]: this.props.fallback === family
                            })}
                            onClick={() => this.handleClick(family)}
                            style={{fontFamily: family}}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => {
                                if (e.key === 'Enter') this.handleClick(family);
                            }}
                        >
                            <span>{intl.formatMessage(messages[family])}</span>
                            {this.props.fallback === family && (
                                <span className={styles.fallbackCheckmark}>{'✓'}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }
}

FontFallback.DEFAULT = 'Sans Serif';

FontFallback.propTypes = {
    intl: intlShape,
    fallback: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired
};

export default injectIntl(FontFallback);