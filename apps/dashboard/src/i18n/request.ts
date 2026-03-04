/**
 * i18n Request Configuration
 * Server-side locale and messages configuration for next-intl
 */

import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, locales, type Locale } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically comes from the middleware
  let locale = await requestLocale;

  // Ensure that the incoming locale is valid
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
