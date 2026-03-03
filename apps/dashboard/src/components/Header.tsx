'use client';

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import Link from 'next/link';
import { MobileNav } from './MobileNav';
import { SearchModal } from './SearchModal';
import { CommandPalette } from './CommandPalette';
import { CurrencySelector } from './CurrencySelector';
import { PriceAlerts } from './PriceAlerts';
import { MarketMoodHeader } from './MarketMoodWidget';

// Lazy load PriceWidget
const PriceWidget = lazy(() => import('./PriceWidget'));

// Navigation items with mega menu content
const navItems = [
  {
    label: 'Markets',
    href: '/',
    icon: null,
    megaMenu: {
      sections: [
        {
          title: 'Market Data',
          links: [
            { label: 'All Cryptocurrencies', href: '/', icon: null },
            { label: 'Top Gainers', href: '/markets/gainers', icon: null },
            { label: 'Top Losers', href: '/markets/losers', icon: null },
            { label: 'Trending', href: '/trending', icon: null },
            { label: 'New Listings', href: '/markets/new', icon: null },
            { label: 'Categories', href: '/markets/categories', icon: null },
          ],
        },
        {
          title: 'Visualization',
          links: [
            { label: 'Market Heatmap', href: '/heatmap', icon: null },
            { label: 'Dominance', href: '/dominance', icon: null },
            { label: 'Top Movers', href: '/movers', icon: null },
            { label: 'Exchanges', href: '/markets/exchanges', icon: null },
          ],
        },
        {
          title: 'Analysis',
          links: [
            { label: 'Screener', href: '/screener', icon: null },
            { label: 'Sentiment', href: '/sentiment', icon: null },
            { label: 'Correlation', href: '/correlation', icon: null },
            { label: 'Volatility', href: '/volatility', icon: null },
            { label: 'Compare Coins', href: '/compare', icon: null },
            { label: 'Social Buzz', href: '/buzz', icon: null },
          ],
        },
      ],
      featured: {
        title: 'Market Overview',
        description: 'Real-time crypto market data and analytics',
        href: '/',
      },
    },
  },
  {
    label: 'Tools',
    href: '/calculator',
    icon: null,
    megaMenu: {
      sections: [
        {
          title: 'Calculators',
          links: [
            { label: 'Crypto Calculator', href: '/calculator', icon: null },
            { label: 'Gas Tracker', href: '/gas', icon: null },
            { label: 'Halving Countdown', href: '/halving', icon: null },
          ],
        },
        {
          title: 'Trading',
          links: [
            { label: 'Liquidations', href: '/liquidations', icon: null },
            { label: 'Volatility', href: '/volatility', icon: null },
          ],
        },
        {
          title: 'News & Content',
          links: [
            { label: 'Daily Digest', href: '/digest', icon: null },
            { label: 'News Sources', href: '/sources', icon: null },
            { label: 'Browse Topics', href: '/topics', icon: null },
            { label: 'Read Articles', href: '/read', icon: null },
            { label: 'Blog', href: '/blog', icon: null },
          ],
        },
      ],
      featured: {
        title: 'Trading Tools',
        description: 'Calculators, gas tracker, and more',
        href: '/calculator',
      },
    },
  },
  {
    label: 'DeFi',
    href: '/defi',
    icon: null,
    megaMenu: {
      sections: [
        {
          title: 'DeFi Analytics',
          links: [
            { label: 'Protocol Rankings', href: '/defi', icon: null },
            { label: 'Chain TVL', href: '/defi', icon: null },
          ],
        },
        {
          title: 'Sectors',
          links: [
            { label: 'Lending', href: '/defi?sector=lending', icon: null },
            { label: 'DEXs', href: '/defi?sector=dex', icon: null },
            { label: 'Yield', href: '/defi?sector=yield', icon: null },
          ],
        },
      ],
      featured: {
        title: 'DeFi Dashboard',
        description: 'Track TVL, yields, and protocol metrics',
        href: '/defi',
      },
    },
  },
  {
    label: 'Portfolio',
    href: '/portfolio',
    icon: null,
    megaMenu: {
      sections: [
        {
          title: 'Your Assets',
          links: [
            { label: 'Portfolio Tracker', href: '/portfolio', icon: null },
            { label: 'Watchlist', href: '/watchlist', icon: null },
            { label: 'Bookmarks', href: '/bookmarks', icon: null },
          ],
        },
        {
          title: 'Settings',
          links: [
            { label: 'Preferences', href: '/settings', icon: null },
            { label: 'Exchange Connections', href: '/settings/exchanges', icon: null },
          ],
        },
      ],
      featured: {
        title: 'Portfolio Tracker',
        description: 'Track your crypto holdings and performance',
        href: '/portfolio',
      },
    },
  },
  {
    label: 'Blog',
    href: '/blog',
    icon: null,
    megaMenu: {
      sections: [
        {
          title: 'Content',
          links: [
            { label: 'All Posts', href: '/blog', icon: null },
            { label: 'Tutorials', href: '/blog/tag/tutorial', icon: null },
            { label: 'Analysis', href: '/blog/tag/analysis', icon: null },
            { label: 'Announcements', href: '/blog/tag/announcement', icon: null },
          ],
        },
        {
          title: 'Resources',
          links: [
            { label: 'About Us', href: '/about', icon: null },
            { label: 'Install App', href: '/install', icon: null },
          ],
        },
      ],
      featured: {
        title: 'CryptoNews Blog',
        description: 'Insights, tutorials, and crypto market analysis',
        href: '/blog',
      },
    },
  },
  {
    label: 'API',
    href: '/pricing',
    icon: null,
    megaMenu: {
      sections: [
        {
          title: 'Developer',
          links: [
            { label: 'API Documentation', href: '/developers', icon: null },
            { label: 'Swagger UI', href: '/docs/swagger', icon: null },
            { label: 'Code Examples', href: '/examples', icon: null },
            { label: 'Pricing & Tiers', href: '/pricing', icon: null },
          ],
        },
        {
          title: 'AI & Integrations',
          links: [
            { label: 'Ask AI', href: '/api/ask', icon: null },
            { label: 'LLM Context', href: '/llms.txt', icon: null },
            { label: 'RSS Feed', href: '/api/rss', icon: null },
            { label: 'x402 Micropayments', href: '/pricing#x402', icon: null },
          ],
        },
      ],
      featured: {
        title: 'API Access',
        description: 'Pay-per-request or subscribe for monthly access',
        href: '/pricing',
      },
    },
  },
];

// Mega Menu Component - Refined design
function MegaMenu({ item, isOpen }: { item: (typeof navItems)[0]; isOpen: boolean }) {
  if (!item.megaMenu || !isOpen) return null;

  const sectionCount = item.megaMenu.sections.length;
  const hasMultipleSections = sectionCount > 1;

  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50"
      role="menu"
      aria-label={`${item.label} submenu`}
    >
      {/* Arrow pointer */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-[var(--surface)] border-l border-t border-[var(--surface-border)]" />

      <div
        className={`relative bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl shadow-2xl overflow-hidden ${
          hasMultipleSections ? 'min-w-[480px]' : 'min-w-[320px]'
        }`}
        style={{
          animation: 'menuFadeIn 200ms ease-out forwards',
        }}
      >
        <div className="flex">
          {/* Links Section */}
          <div className={`${hasMultipleSections ? 'flex-1 p-4' : 'p-4'}`}>
            <div className={hasMultipleSections ? 'grid grid-cols-2 gap-4' : ''}>
              {item.megaMenu.sections.map((section, idx) => (
                <div key={idx}>
                  <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 px-2">
                    {section.title}
                  </h3>
                  <ul className="space-y-0.5">
                    {section.links.map((link, linkIdx) => (
                      <li key={linkIdx}>
                        <Link
                          href={link.href}
                          className="flex items-center gap-2.5 px-2 py-2 text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)] rounded-lg transition-all duration-150 group"
                          role="menuitem"
                        >
                          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] group-hover:bg-[var(--primary)] group-hover:scale-105 transition-all duration-150 text-base">
                            {link.icon}
                          </span>
                          <span className="font-medium text-sm">{link.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Featured Card - Right side */}
          <div className="w-48 bg-[var(--primary)] p-4 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-surface/20 backdrop-blur-sm flex items-center justify-center mb-3">
                <span className="text-xl text-text-primary">{item.icon}</span>
              </div>
              <h4 className="font-semibold text-white text-sm mb-1">
                {item.megaMenu.featured.title}
              </h4>
              <p className="text-white/80 text-xs leading-relaxed">
                {item.megaMenu.featured.description}
              </p>
            </div>
            <Link
              href={item.megaMenu.featured.href}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white hover:text-white/90 transition-colors mt-3 group"
              role="menuitem"
            >
              Explore
              <svg
                className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle scroll for shrinking header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Keyboard shortcuts: Cmd/Ctrl+K for search, Cmd/Ctrl+Shift+P for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !e.shiftKey) {
        e.preventDefault();
        setIsSearchOpen(true);
        setIsCommandPaletteOpen(false);
      }
      // Cmd/Ctrl + Shift + P for command palette
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle mega menu hover with delay
  const handleMenuEnter = (label: string) => {
    if (menuTimeoutRef.current) {
      clearTimeout(menuTimeoutRef.current);
    }
    setActiveMenu(label);
  };

  const handleMenuLeave = () => {
    menuTimeoutRef.current = setTimeout(() => {
      setActiveMenu(null);
    }, 150);
  };

  // Handle keyboard navigation for mega menu
  const handleNavKeyDown = (e: React.KeyboardEvent, item: (typeof navItems)[0]) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (item.megaMenu) {
        e.preventDefault();
        setActiveMenu(activeMenu === item.label ? null : item.label);
      }
    } else if (e.key === 'Escape') {
      setActiveMenu(null);
    }
  };

  return (
    <>
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="skip-link focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Skip to main content
      </a>

      <header
        ref={headerRef}
        className={`sticky top-0 z-40 bg-[var(--bg-secondary)]/95 backdrop-blur-md border-b border-[var(--surface-border)] transition-all duration-300 ${
          isScrolled ? 'shadow-md' : 'shadow-sm'
        }`}
        style={{
          height: isScrolled ? '64px' : '80px',
        }}
      >
        <div className="flex justify-between items-center px-4 lg:px-6 max-w-7xl mx-auto h-full transition-all duration-300">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-3 focus-ring rounded-lg group">
              <span className="text-xl font-light tracking-wide text-white">
                crypto<span className="font-semibold">data</span>
              </span>
            </Link>
          </div>

          {/* Main Navigation - Desktop */}
          <nav
            className="hidden lg:flex items-center gap-1"
            aria-label="Main navigation"
            role="menubar"
          >
            {navItems.map((item) => (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => handleMenuEnter(item.label)}
                onMouseLeave={handleMenuLeave}
              >
                <Link
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 focus-ring ${
                    activeMenu === item.label
                      ? 'text-white bg-[var(--surface-hover)]'
                      : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)]'
                  }`}
                  role="menuitem"
                  aria-haspopup={item.megaMenu ? 'true' : undefined}
                  aria-expanded={item.megaMenu ? activeMenu === item.label : undefined}
                  onKeyDown={(e) => handleNavKeyDown(e, item)}
                >
                  <span className="hidden xl:inline" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {item.megaMenu && (
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${activeMenu === item.label ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  )}
                </Link>

                {/* Mega Menu */}
                <MegaMenu item={item} isOpen={activeMenu === item.label} />
              </div>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Market Mood - Desktop only */}
            <div className="hidden xl:block mr-2">
              <MarketMoodHeader />
            </div>

            {/* Price Widget - Desktop only */}
            <div className="hidden xl:block mr-2">
              <Suspense
                fallback={<div className="w-48 h-6 bg-[var(--surface)] rounded animate-pulse" />}
              >
                <PriceWidget variant="compact" />
              </Suspense>
            </div>

            {/* Search Button */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)] rounded-lg transition-all duration-200 focus-ring"
              aria-label="Search (⌘K)"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span className="hidden md:flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <kbd className="px-1.5 py-0.5 bg-[var(--surface)] rounded text-[10px] font-medium">
                  ⌘K
                </kbd>
              </span>
            </button>

            {/* Currency Selector */}
            <div className="hidden sm:block">
              <CurrencySelector />
            </div>

            {/* Price Alerts */}
            <div className="hidden sm:block">
              <PriceAlerts />
            </div>

            {/* Install App Button */}
            <Link
              href="/install"
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)] rounded-lg transition-all duration-200 focus-ring text-sm"
              aria-label="Install as app"
              title="Install as native app"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden xl:inline">Install</span>
            </Link>

            {/* Keyboard Shortcuts Hint */}
            <button
              onClick={() => {
                const event = new KeyboardEvent('keydown', { key: '?' });
                document.dispatchEvent(event);
              }}
              className="hidden lg:flex items-center gap-1 px-2 py-1.5 text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface-hover)] rounded-lg transition-all duration-200 focus-ring"
              aria-label="Keyboard shortcuts"
              title="View keyboard shortcuts"
            >
              <kbd className="px-1.5 py-0.5 bg-[var(--surface)] rounded text-[10px] font-medium border border-[var(--surface-border)]">?</kbd>
            </button>

            {/* GitHub Link */}
            <a
              href="https://github.com/nirholas/crypto-data-aggregator"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 ml-1 px-4 py-2 bg-[var(--primary)] text-white rounded-full hover:bg-[var(--primary-hover)] hover:shadow-lg active:scale-95 transition-all duration-200 text-sm font-medium focus-ring"
              aria-label="View on GitHub"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="hidden md:inline">Star</span>
            </a>

            {/* Mobile Nav Toggle */}
            <MobileNav />
          </div>
        </div>
      </header>

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </>
  );
}
