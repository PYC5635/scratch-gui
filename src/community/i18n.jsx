/* eslint-disable max-len */
import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {IntlProvider} from 'react-intl';
import enMessages from './i18n-messages-en.js';
import zhMessages from './i18n-messages-zh-cn.js';
import communityTranslations from './translations/zh-cn.json';

const LOCALE_KEY = 'mw:community-locale';
export const LOCALES = [
    {value: 'auto', label: 'Use browser language'},
    {value: 'zh-cn', label: '简体中文'},
    {value: 'en', label: 'English'},
    {value: 'es', label: 'Español'}
];

const messages = {
    en: enMessages,
    'zh-cn': zhMessages,
    es: {
        'a11y.skip': 'Saltar al contenido',
        'nav.main': 'Navegación principal',
        'nav.create': 'Crear',
        'nav.explore': 'Explorar',
        'nav.spaces': 'Espacios',
        'nav.search': 'Buscar proyectos, personas y espacios',
        'home.title': 'Crea un proyecto. Deja que alguien lo mejore.',
        'home.lead': 'MistWarp añade ramas, historial y contribuciones a la programación visual sin obligarte a aprender Git primero.',
        'home.start': 'Empezar a crear',
        'home.explore': 'Explorar proyectos',
        'home.signin': 'Iniciar sesión con PineWarp Accounts',
        'home.github': 'Seguir en GitHub',
        'status.title': 'Estado del servicio',
        'status.lead': 'Las comprobaciones se ejecutan fuera del despliegue principal de MistWarp cada cinco minutos.',
        'status.retry': 'Comprobar de nuevo',
        'status.loading': 'Cargando datos de estado independientes…',
        'status.failed': 'Los datos de estado independientes no están disponibles.',
        'status.operational': 'Operativo',
        'status.degraded': 'Rendimiento reducido',
        'status.unavailable': 'No disponible',
        'status.unknown': 'Sin datos',
        'status.incidents': 'Historial de incidentes',
        'status.noIncidents': 'No se han comunicado incidentes.',
        'status.history': 'Disponibilidad de siete días',
        'settings.language': 'Idioma',
        'settings.languageHelp': 'Cambia el idioma del sitio de la comunidad de MistWarp. Más páginas usarán este sistema a medida que cambie su texto.',
        'settings.analytics': 'Análisis anónimo del producto',
        'settings.analyticsHelp': 'Registra seis hitos de creación durante 31 días. MistWarp no envía nombres de usuario, identificadores de proyecto, URLs, direcciones IP ni datos del navegador.'
    }
};

// Merge the community translations JSON into the messages for each locale so that
// `FormattedMessage` calls inside the community can find `mw.community.*` keys
// without depending on the editor-side `editorMessages` merge.
for (const locale of Object.keys(communityTranslations)) {
    const toMixIn = communityTranslations[locale];
    if (toMixIn && messages[locale]) {
        messages[locale] = {...messages[locale], ...toMixIn};
    }
}

const getPreference = () => {
    try {
        return localStorage.getItem(LOCALE_KEY) || 'auto';
    } catch (e) {
        return 'auto';
    }
};

const resolveLocale = preference => {
    if (preference !== 'auto') return messages[preference] ? preference : 'en';
    const browserLocale = typeof navigator === 'undefined' ? 'en' : navigator.language.toLowerCase();
    if (browserLocale.startsWith('zh')) return 'zh-cn';
    const short = browserLocale.split('-')[0];
    return messages[short] ? short : 'en';
};

const CommunityI18nContext = createContext({locale: 'en', preference: 'auto', setPreference: () => {}, t: key => messages.en[key] || key});

export const CommunityIntlProvider = ({children}) => {
    const [preference, setPreferenceState] = useState(getPreference);
    const locale = resolveLocale(preference);
    const setPreference = value => {
        const next = LOCALES.some(option => option.value === value) ? value : 'auto';
        try {
            localStorage.setItem(LOCALE_KEY, next);
        } catch (e) {
            // keep the in-memory setting when storage is unavailable
        }
        setPreferenceState(next);
    };
    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);
    const value = useMemo(() => ({
        locale,
        preference,
        setPreference,
        t: key => messages[locale][key] || messages.en[key] || key
    }), [locale, preference]);
    return (
        <CommunityI18nContext.Provider value={value}>
            <IntlProvider locale={locale} messages={messages[locale] || messages.en}>
                {children}
            </IntlProvider>
        </CommunityI18nContext.Provider>
    );
};

export const useCommunityIntl = () => useContext(CommunityI18nContext);
