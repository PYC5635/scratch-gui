import './import-first';

import React from 'react';
import {IntlProvider, addLocaleData} from 'react-intl';
import {BrowserRouter} from 'react-router-dom';

import editorMessages from '@bilup/scratch-l10n/locales/editor-msgs';
import {localeData} from '@bilup/scratch-l10n';
import addAdditionalTranslations from '../lib/tw-translations/index.js';
import communityTranslations from '../community/translations/zh-cn.json';
import IntlBridge from '../lib/tw-use-intl.jsx';
import {detectLocale} from '../lib/utils/detect-locale.js';

import App from '../community/App.jsx';
import {applyThemeVisuals, detectTheme, onSystemPreferenceChange} from '../lib/themes/themePersistance.js';
import render from './app-target.js';
import '!!style-loader!css-loader!../community/styles/tokens.css';

// The dev server rewrites /<id>/embed to the embed player, but in production
// that path falls through to this community bundle. Bounce it to the embed
// player's hash form, which works everywhere. Numeric ids are Scratch projects;
// everything else (e.g. p1784...) is a MistWarp community project.
const embedMatch = typeof location !== 'undefined' &&
    location.pathname.match(/^\/(\d+|p[A-Za-z0-9]+)\/embed\/?$/);
// The bare /project path (no id) is the "direct project link" entry, e.g.
// /project?project_url=... . It also falls through to this community bundle,
// where there is no matching route (only /project/:id exists). Bounce it to
// the editor with a one-shot fullscreen flag so the project opens fullscreen
// and exiting fullscreen lands in the editor.
const projectEntryMatch = typeof location !== 'undefined' &&
    (location.pathname === '/project' || location.pathname === '/project/');
if (projectEntryMatch) {
    const params = new URLSearchParams(location.search);
    params.set('startFullscreen', '1');
    const query = params.toString();
    location.replace(`/editor${query ? `?${query}` : ''}${location.hash}`);
} else if (embedMatch) {
    const id = embedMatch[1];
    location.replace(`/embed${location.search}#${/^\d+$/.test(id) ? id : `mw-${id}`}`);
} else {
    applyThemeVisuals(detectTheme());
    onSystemPreferenceChange(() => applyThemeVisuals(detectTheme()));

    // Register locale data (required for react-intl to format numbers/dates in zh-cn).
    addLocaleData(localeData);

    // Merge TW/Bilup extra translations and community site translations.
    addAdditionalTranslations(editorMessages);
    for (const locale of Object.keys(editorMessages)) {
        const toMixIn = communityTranslations[locale.toLowerCase()];
        if (toMixIn) {
            Object.assign(editorMessages[locale], toMixIn);
        }
    }
    const supportedLocales = Object.keys(editorMessages);
    const locale = detectLocale(supportedLocales);

    render(
        <IntlProvider
            locale={locale}
            messages={editorMessages[locale]}
        >
            <IntlBridge>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </IntlBridge>
        </IntlProvider>
    );
}
