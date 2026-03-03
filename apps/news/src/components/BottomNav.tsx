'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  activeIcon?: React.ReactNode;
}

const HomeIcon = ({ active }: { active?: boolean }) => (
  <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const MarketsIcon = ({ active }: { active?: boolean }) => (
  <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const TrendingIcon = ({ active }: { active?: boolean }) => (
  <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
  </svg>
);

const SearchIcon = ({ active }: { active?: boolean }) => (
  <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const MoreIcon = ({ active }: { active?: boolean }) => (
  <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  
  // Remove locale prefix from pathname for matching
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(-[A-Z]{2})?/, '') || '/';

  const navItems: NavItem[] = [
    { href: '/', icon: <HomeIcon />, activeIcon: <HomeIcon active />, label: t('home') },
    { href: '/markets', icon: <MarketsIcon />, activeIcon: <MarketsIcon active />, label: t('markets') },
    { href: '/trending', icon: <TrendingIcon />, activeIcon: <TrendingIcon active />, label: t('trending') },
    { href: '/search', icon: <SearchIcon />, activeIcon: <SearchIcon active />, label: t('search') },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathWithoutLocale === '/' || pathWithoutLocale === '';
    return pathWithoutLocale.startsWith(href);
  };

  return (
    <nav 
      className="bottom-nav"
      role="navigation"
      aria-label="Mobile navigation"
    >
      {navItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`
              flex flex-col items-center justify-center
              px-3 py-2 min-w-[64px]
              transition-colors duration-200
              no-tap-highlight haptic-tap
              ${active 
                ? 'text-brand-600 dark:text-amber-400' 
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
              }
            `}
            aria-current={active ? 'page' : undefined}
          >
            <span className="relative">
              {active ? item.activeIcon || item.icon : item.icon}
              {active && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-600 dark:bg-amber-400" />
              )}
            </span>
            <span className={`mt-1 text-[10px] font-medium ${active ? 'font-semibold' : ''}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
      
      {/* More button triggers the mobile nav sheet */}
      <button
        className="
          flex flex-col items-center justify-center
          px-3 py-2 min-w-[64px]
          text-gray-500 dark:text-slate-400
          hover:text-gray-700 dark:hover:text-slate-300
          transition-colors duration-200
          no-tap-highlight haptic-tap
        "
        aria-label="More options"
        onClick={() => {
          // Trigger the mobile nav - dispatch custom event
          window.dispatchEvent(new CustomEvent('open-mobile-nav'));
        }}
      >
        <MoreIcon />
        <span className="mt-1 text-[10px] font-medium">More</span>
      </button>
    </nav>
  );
}
