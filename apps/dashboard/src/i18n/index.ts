/**
 * i18n Module Exports
 * Re-exports all i18n utilities for convenient imports
 */

// Re-export next-intl hooks for client components
export { useTranslations, useLocale, useMessages, useNow, useTimeZone } from 'next-intl';

// Re-export configuration
export * from './config';

// Re-export navigation utilities
export * from './navigation';
