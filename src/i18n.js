/**
 * Lightweight i18n module for Bokbad
 * - t(key, params) — translate a key with optional {{param}} interpolation
 * - setLocale(locale) — switch language + re-translate static HTML
 * - getLocale() — current locale string
 * - initI18n() — boot: load saved locale or detect browser language
 */

let currentLocale = 'no';
let translations = {};

const SUPPORTED_LOCALES = ['en', 'no'];
const STORAGE_KEY = 'bokbad-locale';

/**
 * Translate a key like "home.readingNow"
 * Supports {{param}} interpolation: t('goal.booksOf', { read: 5, target: 24 })
 */
export function t(key, params = {}) {
    const keys = key.split('.');
    let val = translations;
    for (const k of keys) {
        if (val && typeof val === 'object' && k in val) {
            val = val[k];
        } else {
            // Fallback: return the key itself so untranslated keys are visible
            return key;
        }
    }
    // Return non-string values (arrays, numbers) as-is
    if (typeof val !== 'string') return val;

    // Interpolate {{param}} placeholders
    return val.replace(/\{\{(\w+)\}\}/g, (_, p) => {
        return params[p] !== undefined ? params[p] : `{{${p}}}`;
    });
}

/** Current locale string (e.g. 'en', 'no') */
export function getLocale() {
    return currentLocale;
}

/** Load a locale JSON and apply to all data-i18n elements */
export async function setLocale(locale) {
    if (!SUPPORTED_LOCALES.includes(locale)) locale = 'no';
    try {
        const module = await import(`./locales/${locale}.json`);
        translations = module.default || module;
        currentLocale = locale;
        localStorage.setItem(STORAGE_KEY, locale);
        document.documentElement.lang = locale === 'no' ? 'nb' : locale;
        translateDOM();
    } catch (e) {
        console.error(`Failed to load locale "${locale}":`, e);
    }
}

/** Translate all elements with data-i18n attributes */
function translateDOM() {
    // textContent
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translated = t(key);
        if (translated !== key) el.textContent = translated;
    });
    // placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const translated = t(key);
        if (translated !== key) el.placeholder = translated;
    });
    // title / aria-label
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const translated = t(key);
        if (translated !== key) {
            el.title = translated;
            el.setAttribute('aria-label', translated);
        }
    });
    // innerHTML (for elements that contain emoji + text)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        const translated = t(key);
        if (translated !== key) el.innerHTML = translated;
    });
}

/** Initialize i18n: detect language, load translations */
export async function initI18n() {
    // Priority: saved preference → browser language → fallback 'no'
    const saved = localStorage.getItem(STORAGE_KEY);
    let locale = 'no';

    if (saved && SUPPORTED_LOCALES.includes(saved)) {
        locale = saved;
    } else {
        // Detect browser language
        const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
        if (browserLang.startsWith('en')) {
            locale = 'en';
        } else {
            locale = 'no'; // Default for nb, nn, or anything else
        }
    }

    await setLocale(locale);
}

export default { t, getLocale, setLocale, initI18n };
