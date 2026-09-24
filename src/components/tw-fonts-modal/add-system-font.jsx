import React from 'react';
import PropTypes from 'prop-types';
import {FormattedMessage, injectIntl, intlShape} from 'react-intl';
import bindAll from 'lodash.bindall';
import classNames from 'classnames';
import FontPlayground from './font-playground.jsx';
import FontFallback from './font-fallback.jsx';
import AddButton from './add-button.jsx';
import styles from './fonts-modal.css';

class AddSystemFont extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleChangeSearch',
            'handleSelectFont',
            'handleChangeFallback',
            'handleFinish'
        ]);
        this.state = {
            search: '',
            localFonts: [],
            filteredFonts: [],
            selectedFont: null,
            fallback: FontFallback.DEFAULT,
            loading: true
        };
    }

    componentDidMount () {
        this.loadLocalFonts();
    }

    async loadLocalFonts () {
        // Chrome-only API: queryLocalFonts
        if (typeof queryLocalFonts === 'function') {
            try {
                // eslint-disable-next-line no-undef
                const fonts = await queryLocalFonts();
                const uniqueFamilies = [...new Set(fonts.map(i => i.family))].sort();
                this.setState({
                    localFonts: uniqueFamilies,
                    filteredFonts: uniqueFamilies,
                    loading: false
                });
            } catch (err) {
                // Permission denied or API unavailable
                console.warn('Could not query local fonts:', err);
                this.setState({loading: false});
            }
        } else {
            // queryLocalFonts not available (non-Chrome browser)
            this.setState({loading: false});
        }
    }

    handleChangeSearch (e) {
        const value = e.target.value;
        const filtered = this.state.localFonts.filter(family =>
            family.toLowerCase().includes(value.toLowerCase())
        );
        this.setState({
            search: value,
            filteredFonts: filtered
        });
    }

    handleSelectFont (family) {
        this.setState({
            selectedFont: family,
            search: family
        });
    }

    handleChangeFallback (fallback) {
        this.setState({
            fallback
        });
    }

    handleFinish () {
        this.props.fontManager.addSystemFont(this.state.selectedFont, this.state.fallback);
        this.props.onClose();
    }

    render () {
        const {intl} = this.props;
        const {selectedFont, search, filteredFonts, loading} = this.state;

        return (
            <React.Fragment>
                <p>
                    <FormattedMessage
                        defaultMessage="Select a font from your computer:"
                        description="Part of font management modal."
                        id="tw.fonts.system.select"
                    />
                </p>

                <div className={styles.fontInputOuter}>
                    <input
                        type="text"
                        className={styles.fontInput}
                        placeholder={intl.formatMessage({
                            defaultMessage: 'Search fonts...',
                            description: 'Search placeholder for system font list',
                            id: 'tw.fonts.searchPlaceholder'
                        })}
                        value={search}
                        onChange={this.handleChangeSearch}
                    />
                </div>

                {loading ? (
                    <p className={styles.loadingHint}>
                        <FormattedMessage
                            defaultMessage="Loading fonts..."
                            description="Loading fonts indicator"
                            id="tw.fonts.loading"
                        />
                    </p>
                ) : filteredFonts.length > 0 ? (
                    <div className={styles.systemFontList}>
                        {filteredFonts.map(family => (
                            <div
                                key={family}
                                className={classNames(styles.systemFontItem, {
                                    [styles.systemFontItemSelected]: selectedFont === family
                                })}
                                onClick={() => this.handleSelectFont(family)}
                                style={{fontFamily: family}}
                                role="button"
                                tabIndex={0}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') this.handleSelectFont(family);
                                }}
                            >
                                <span className={styles.systemFontName}>{family}</span>
                                {selectedFont === family && (
                                    <span className={styles.systemFontCheck}>{'✓'}</span>
                                )}
                            </div>
                        ))}
                    </div>
                ) : search ? (
                    <p className={styles.noResultsHint}>
                        <FormattedMessage
                            defaultMessage="No fonts found. Try a different search term."
                            description="No fonts match search"
                            id="tw.fonts.noResults"
                        />
                    </p>
                ) : (
                    <p className={styles.noResultsHint}>
                        <FormattedMessage
                            defaultMessage="Font list is not available in this browser. Try using Chrome."
                            description="Font list API not available"
                            id="tw.fonts.noApi"
                        />
                    </p>
                )}

                {selectedFont && (
                    <React.Fragment>
                        <FontPlayground family={`${selectedFont}, ${this.state.fallback}`} />

                        <FontFallback
                            fallback={this.state.fallback}
                            onChange={this.handleChangeFallback}
                        />
                    </React.Fragment>
                )}

                <AddButton
                    onClick={this.handleFinish}
                    disabled={!selectedFont}
                />
            </React.Fragment>
        );
    }
}

AddSystemFont.propTypes = {
    intl: intlShape,
    fontManager: PropTypes.shape({
        addSystemFont: PropTypes.func.isRequired,
        hasFont: PropTypes.func.isRequired
    }).isRequired,
    onClose: PropTypes.func.isRequired
};

export default injectIntl(AddSystemFont);