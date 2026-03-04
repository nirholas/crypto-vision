/**
 * i18n Configuration
 * Defines supported locales and default locale for next-intl
 */

export const locales = [
  'en',
  'es',
  'fr',
  'de',
  'pt',
  'ja',
  'zh-CN',
  'zh-TW',
  'ko',
  'ar',
  'ru',
  'it',
  'nl',
  'pl',
  'tr',
  'vi',
  'th',
  'id',
] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  ja: '日本語',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ko: '한국어',
  ar: 'العربية',
  ru: 'Русский',
  it: 'Italiano',
  nl: 'Nederlands',
  pl: 'Polski',
  tr: 'Türkçe',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  id: 'Bahasa Indonesia',
};

// RTL languages
export const rtlLocales: Locale[] = ['ar'];

export function isRtlLocale(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}

// Locale detection
export function getLocaleFromPath(pathname: string): Locale {
  const segments = pathname.split('/').filter(Boolean);
  const potentialLocale = segments[0] as Locale;

  if (locales.includes(potentialLocale)) {
    return potentialLocale;
  }

  return defaultLocale;
}
