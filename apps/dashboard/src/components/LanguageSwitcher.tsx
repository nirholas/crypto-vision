'use client';

/**
 * Language Switcher Component
 * Allows users to change the application language
 */

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { locales, localeNames, type Locale } from '@/i18n/config';

interface LanguageSwitcherProps {
  /** Visual variant of the switcher */
  variant?: 'dropdown' | 'compact' | 'full';
  /** Additional CSS classes */
  className?: string;
}

export function LanguageSwitcher({ variant = 'dropdown', className = '' }: LanguageSwitcherProps) {
  const t = useTranslations('settings');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale as Locale });
  };

  if (variant === 'compact') {
    return (
      <button
        onClick={() => {
          // Cycle through locales
          const currentIndex = locales.indexOf(locale);
          const nextIndex = (currentIndex + 1) % locales.length;
          handleChange(locales[nextIndex]);
        }}
        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-muted hover:text-text-primary rounded-lg hover:bg-surface-hover transition-colors ${className}`}
        aria-label={t('selectLanguage')}
      >
        <span className="text-lg">🌐</span>
        <span className="uppercase">{locale}</span>
      </button>
    );
  }

  if (variant === 'full') {
    return (
      <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 ${className}`}>
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => handleChange(loc)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              loc === locale
                ? 'bg-primary text-white'
                : 'bg-surface-alt text-text-secondary hover:bg-surface-hover'
            }`}
          >
            {localeNames[loc]}
          </button>
        ))}
      </div>
    );
  }

  // Default dropdown variant
  return (
    <div className={`relative ${className}`}>
      <label htmlFor="language-select" className="sr-only">
        {t('selectLanguage')}
      </label>
      <div className="relative">
        <select
          id="language-select"
          value={locale}
          onChange={(e) => handleChange(e.target.value)}
          className="appearance-none bg-transparent border border-surface-border rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-text-secondary hover:border-surface-border transition-colors cursor-pointer"
        >
          {locales.map((loc) => (
            <option key={loc} value={loc} className="bg-surface">
              {localeNames[loc]}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg
            className="h-4 w-4 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default LanguageSwitcher;
