/**
 * Footer Component
 * Premium footer with gradient mesh background
 */

import Link from 'next/link';
import { NewsletterForm } from './NewsletterForm';

export default function Footer() {
  return (
    <footer
      className="relative bg-[var(--bg-secondary)] text-text-primary mt-16 overflow-hidden"
      role="contentinfo"
    >
      {/* Minimal divider */}
      <div className="relative">
        <div className="h-px bg-[var(--surface-border)]" aria-hidden="true" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-16">
          {/* Brand Section */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center gap-3 text-2xl font-black mb-6 focus-ring rounded group"
            >
              <svg
                className="w-7 h-7 text-text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                />
              </svg>
              <span className="text-text-primary group-hover:text-text-secondary transition-all duration-300">
                Crypto Data
              </span>
            </Link>
            <p className="text-text-muted text-base mb-8 leading-relaxed max-w-sm">
              Real-time cryptocurrency market data aggregator. DeFi analytics, portfolio tracking,
              and comprehensive market insights.
            </p>

            {/* Social Links */}
            <div className="flex gap-3">
              <a
                href="https://github.com/nirholas/crypto-data-aggregator"
                target="_blank"
                rel="noopener noreferrer"
                className="group p-3 bg-[var(--surface)] rounded-xl hover:bg-primary hover:scale-110 active:scale-95 transition-all duration-300 focus-ring border border-[var(--surface-border)] hover:border-primary"
                aria-label="View on GitHub"
              >
                <svg
                  className="w-5 h-5 text-text-muted group-hover:text-background transition-colors"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </div>
          </div>

          {/* Markets */}
          <nav aria-label="Markets">
            <h3 className="font-bold text-text-primary text-lg mb-6 flex items-center gap-2">
              <span className="w-8 h-0.5 bg-primary" aria-hidden="true" />
              Markets
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/"
                  className="group text-text-muted hover:text-text-primary transition-colors inline-flex items-center gap-3 focus-ring rounded px-1 -mx-1"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  <span className="text-sm font-medium">All Cryptocurrencies</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/movers"
                  className="group text-text-muted hover:text-text-primary transition-colors inline-flex items-center gap-3 focus-ring rounded px-1 -mx-1"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                  <span className="text-sm font-medium">Top Movers</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/trending"
                  className="group text-text-muted hover:text-text-primary transition-colors inline-flex items-center gap-3 focus-ring rounded px-1 -mx-1"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-medium">Trending</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/defi"
                  className="group text-text-muted hover:text-text-primary transition-colors inline-flex items-center gap-3 focus-ring rounded px-1 -mx-1"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  <span className="text-sm font-medium">DeFi</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/sentiment"
                  className="group text-text-muted hover:text-text-primary transition-colors inline-flex items-center gap-3 focus-ring rounded px-1 -mx-1"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  <span className="text-sm font-medium">Sentiment</span>
                </Link>
              </li>
            </ul>
          </nav>

          {/* Resources */}
          <nav aria-label="Resources">
            <h3 className="font-bold text-text-primary text-lg mb-6 flex items-center gap-2">
              <span className="w-8 h-0.5 bg-primary" aria-hidden="true" />
              Tools
            </h3>
            <ul className="space-y-3">
              {[
                { href: '/portfolio', label: 'Portfolio' },
                { href: '/watchlist', label: 'Watchlist' },
                { href: '/calculator', label: 'Calculator' },
                { href: '/gas', label: 'Gas Tracker' },
                { href: '/halving', label: 'Halving Countdown' },
                { href: '/liquidations', label: 'Liquidations' },
                { href: '/correlation', label: 'Correlation Matrix' },
                { href: '/buzz', label: 'Social Buzz' },
                { href: '/bookmarks', label: 'Bookmarks' },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group text-text-muted hover:text-text-primary transition-colors inline-flex items-center gap-3 focus-ring rounded px-1 -mx-1"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Developer Resources */}
          <nav aria-label="Developer Resources">
            <h3 className="font-bold text-text-primary text-lg mb-6 flex items-center gap-2">
              <span className="w-8 h-0.5 bg-primary" aria-hidden="true" />
              Developers
            </h3>
            <ul className="space-y-3">
              {[
                { href: '/developers', label: 'API Documentation' },
                { href: '/docs/swagger', label: 'Swagger UI' },
                { href: '/examples', label: 'Code Examples' },
                { href: '/pricing', label: 'API Pricing' },
                { href: '/api/rss', label: 'RSS Feed' },
                { href: '/llms.txt', label: 'LLM Context' },
              ].map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="group text-text-muted hover:text-text-primary transition-colors font-mono text-sm focus-ring rounded inline-flex items-center gap-2"
                  >
                    <span className="text-text-disabled group-hover:text-text-primary transition-colors">
                      →
                    </span>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Newsletter Signup */}
        <div className="mt-12 pt-8 border-t border-surface-border">
          <div className="max-w-md mx-auto text-center">
            <h3 className="font-bold text-text-primary text-lg mb-2">Stay Updated</h3>
            <p className="text-text-muted text-sm mb-4">
              Get the latest crypto news and market insights delivered to your inbox.
            </p>
            <NewsletterForm />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-surface-border mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-text-muted text-sm flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 bg-primary text-text-primary px-3 py-1 rounded-full text-xs font-semibold">
              MIT Licensed
            </span>
            <span>•</span>
            <span>
              Made by{' '}
              <a
                href="https://github.com/nirholas"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-text-primary transition-colors focus-ring rounded font-medium"
              >
                nich
              </a>
            </span>
          </p>
          <div className="flex items-center gap-4 text-sm text-text-muted">
            <Link
              href="/install"
              className="flex items-center gap-1.5 hover:text-text-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Install App
            </Link>
            <span className="text-surface-border">|</span>
            <span className="flex items-center gap-1.5">
              Press <kbd className="px-1.5 py-0.5 bg-surface rounded text-xs font-medium border border-surface-border">?</kbd> for shortcuts
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
