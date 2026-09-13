import {getRotur, ensureScopes} from './rotur/client.js';
import {getItem as getStorageItem} from './utils/safe-storage.js';

const API = 'https://theme.bilup.org/api';
const TOKEN_KEY = 'mw:warptheme-token';
const TOKEN_MANAGER = 'https://accounts.bilup.org/token-manager';
// Must match the key the BilupTheme backend uses for generate_validator.
const VALIDATOR_KEY = 'BilupTheme';
const VALIDATOR_SCOPE = 'validators:generate';

const needsValidatorPermission = (status, data = {}) => (
    status === 401 ||
    status === 403 ||
    /validators:generate|permission|scope/i.test(String(data.error || data.message || ''))
);

const readToken = () => {
    try {
        return getStorageItem(TOKEN_KEY);
    } catch (_) {
        return null;
    }
};

const storeToken = token => {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    } catch (_) {
        // Storage can be unavailable in private mode.
    }
};

const request = async (path, token, options = {}) => {
    const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            ...(options.body ? {'Content-Type': 'application/json'} : {}),
            ...(token ? {Authorization: `Bearer ${token}`} : {}),
            ...options.headers
        }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
        const error = new Error(data.error || `BilupTheme request failed (${response.status})`);
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
};

const openSession = async expectedUsername => {
    let token = readToken();
    if (token) {
        try {
            const account = await request('/user', token);
            const cachedName = account.user && account.user.username;
            if (cachedName && cachedName.toLowerCase() === expectedUsername.toLowerCase()) {
                return {token, ...account};
            }
        } catch (error) {
            // Only discard the cached session on an explicit auth failure; a
            // transient network error should not force a fresh login.
            if (error && (error.status === 401 || error.status === 403)) {
                storeToken(null);
            }
        }
    }

    const rotur = getRotur();
    if (!rotur.loggedIn || !rotur.token) throw new Error('Sign in with Bilup Accounts first.');

    // The BilupTheme backend (Bilup/BilupTheme) signs you in with a Bilup
    // Accounts token: it exchanges the token for a validator, verifies it, and
    // creates a session. The session id is returned and used as a bearer token
    // for the rest of the API (the backend must return it as `token`).
    //
    // Pre-check the validator with the SDK first: a missing validators:generate
    // permission is otherwise reported by the backend as a generic 502 and the
    // user just sees "could not connect". Detecting it here lets us refresh the
    // token with the required scope automatically (or guide the user to the
    // Token Manager when re-authorization is impossible).
    const generateValidator = async () => {
        const result = await rotur.validators.generate(VALIDATOR_KEY);
        return Boolean(result && result.validator);
    };
    try {
        await generateValidator();
    } catch (error) {
        if (needsValidatorPermission(error && error.status, error && error.data)) {
            const permissionError = new Error(
                'Your Bilup Accounts token needs the validators:generate permission before it can access BilupTheme.'
            );
            try {
                await ensureScopes([VALIDATOR_SCOPE]);
                await generateValidator();
            } catch (_) {
                permissionError.code = 'validator-permission';
                throw permissionError;
            }
        }
        // Non-permission failures fall through; the request below will surface
        // the backend's exact error.
    }

    const auth = await request('/auth/login', null, {
        method: 'POST',
        body: JSON.stringify({token: rotur.token})
    });
    if (!auth || !auth.token) {
        const error = new Error((auth && auth.error) || 'Bilup Accounts could not authorize BilupTheme.');
        if (needsValidatorPermission(502, auth || {})) {
            error.code = 'validator-permission';
        }
        throw error;
    }
    token = auth.token;
    storeToken(token);
    const account = await request('/user', token);
    return {token, ...account};
};

const gradientStyle = theme => {
    if (!theme) return {};
    const colors = (theme.colors && theme.colors.gradient) ||
        (theme.accent && theme.accent.colors);
    if (!Array.isArray(colors) || colors.length < 1) return {};
    const direction = (theme.colors && theme.colors.gradientDirection) ||
        (theme.accent && theme.accent.direction) ||
        135;
    const stops = [...colors]
        .sort((a, b) => Number(a.position) - Number(b.position))
        .map(color => `${color.color} ${color.position}%`)
        .join(', ');
    return {background: `linear-gradient(${direction}deg, ${stops})`};
};

const exportCurrentTheme = theme => {
    // CustomTheme (or anything with a full export): keep it lossless — the
    // gui/blocks names plus a full gradient accent round-trip through import().
    const exported = theme && typeof theme.export === 'function' ? theme.export() : null;
    if (exported && exported.accent && Array.isArray(exported.accent.colors) &&
        exported.gui && exported.blocks) {
        return exported;
    }
    // Standard tw Theme (or a CustomTheme with a standard accent): export the
    // accent *name* plus the gui/blocks names. Previously a two-colour gradient
    // was built here, which collapsed the accent to just two stops and made the
    // uploaded theme look different after re-import.
    const accent = (theme && theme.accent) || (exported && exported.accent);
    return {
        ...(exported || {}),
        name: (exported && exported.name) || (theme && theme.name) || 'My Bilup Theme',
        description: (exported && exported.description) || (theme && theme.description) || '',
        accent: accent && (typeof accent === 'string' ||
            (typeof accent === 'object' && Array.isArray(accent.colors))) ?
            accent :
            {colors: [{color: '#4c97ff', position: 0}, {color: '#9966ff', position: 100}], direction: 135},
        gui: (exported && exported.gui) || (theme && theme.gui) || 'light',
        blocks: (exported && exported.blocks) || (theme && theme.blocks) || 'three',
        menuBarAlign: (exported && exported.menuBarAlign) || (theme && theme.menuBarAlign) || 'center',
        wallpaper: (exported && exported.wallpaper) || (theme && theme.wallpaper) ||
            {url: '', opacity: 0.3, darkness: 0, gridVisible: true, history: []},
        fonts: (exported && exported.fonts) || (theme && theme.fonts) || {system: [], google: [], history: []}
    };
};

export {
    API,
    TOKEN_MANAGER,
    readToken,
    storeToken,
    request,
    openSession,
    gradientStyle,
    exportCurrentTheme,
    needsValidatorPermission
};
