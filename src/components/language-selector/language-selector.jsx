import PropTypes from 'prop-types';
import React from 'react';

import locales from '@bilup/scratch-l10n';
import styles from './language-selector.css';
import {PINE_EXTRAS} from '../../lib/pine-editor-i18n.js';

// supported languages to exclude from the menu, but allow as a URL option
const ignore = [];

const LanguageSelector = ({currentLocale, label, onChange}) => (
    <select
        aria-label={label}
        className={styles.languageSelect}
        value={currentLocale}
        onChange={onChange}
    >
        {
            Object.keys(locales)
                .filter(l => !ignore.includes(l))
                .map(locale => (
                    <option
                        key={locale}
                        value={locale}
                    >
                        {locales[locale].name}
                    </option>
                ))
        }
        {
            PINE_EXTRAS.filter(x => !locales[x.locale]).map(x => (
                <option
                    key={x.locale}
                    value={x.locale}
                >
                    {x.name}
                </option>
            ))
        }
    </select>
);

LanguageSelector.propTypes = {
    currentLocale: PropTypes.string,
    label: PropTypes.string,
    onChange: PropTypes.func
};

export default LanguageSelector;
