import './globals.css';
import type { Metadata, Viewport } from 'next';
import { PWAProvider } from '@/components/PWAProvider';
import { InstallPrompt } from '@/components/InstallPrompt';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { BookmarksProvider } from '@/components/BookmarksProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { KeyboardShortcutsProvider } from '@/components/KeyboardShortcuts';
import { WatchlistProvider } from '@/components/watchlist';
import { AlertsProvider } from '@/components/alerts';
import { PortfolioProvider } from '@/components/portfolio';
import { GlobalSearch } from '@/components/GlobalSearch';
import { ToastProvider } from '@/components/Toast';
import { CurrencyProvider } from '@/components/CurrencySelector';

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  title: {
    default: 'Crypto Data Aggregator',
    template: '%s | Crypto Data Aggregator',
  },
  description:
    'Real-time cryptocurrency market data, DeFi analytics, portfolio tracking, and comprehensive market insights. Your complete crypto data dashboard.',
  keywords: [
    'crypto',
    'cryptocurrency',
    'bitcoin',
    'ethereum',
    'market-data',
    'defi',
    'portfolio',
    'watchlist',
    'coingecko',
    'trading',
  ],
  authors: [{ name: 'Crypto Data Aggregator' }],
  creator: 'Crypto Data Aggregator',
  publisher: 'Crypto Data Aggregator',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://crypto-data-aggregator.vercel.app'),
  alternates: {
    canonical: '/',
    languages: {
      'en': '/',
      'ar': '/ar',
      'de': '/de',
      'es': '/es',
      'fr': '/fr',
      'id': '/id',
      'it': '/it',
      'ja': '/ja',
      'ko': '/ko',
      'nl': '/nl',
      'pl': '/pl',
      'pt': '/pt',
      'ru': '/ru',
      'th': '/th',
      'tr': '/tr',
      'vi': '/vi',
      'zh-CN': '/zh-CN',
      'zh-TW': '/zh-TW',
      'x-default': '/',
    },
  },
  openGraph: {
    title: 'Crypto Data Aggregator',
    description: 'Real-time cryptocurrency market data, DeFi analytics, and portfolio tracking.',
    url: 'https://crypto-data-aggregator.vercel.app',
    siteName: 'Crypto Data Aggregator',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Crypto Data Aggregator - Real-time Market Data',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crypto Data Aggregator',
    description: 'Real-time cryptocurrency market data, DeFi analytics, and portfolio tracking.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/favicon.svg',
    apple: [{ url: '/apple-touch-icon.svg', sizes: '180x180', type: 'image/svg+xml' }],
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
        color: '#f7931a',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CryptoNews',
    startupImage: [
      {
        url: '/splash/apple-splash-2048-2732.png',
        media:
          '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)',
      },
      {
        url: '/splash/apple-splash-1668-2388.png',
        media:
          '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)',
      },
      {
        url: '/splash/apple-splash-1536-2048.png',
        media:
          '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)',
      },
      {
        url: '/splash/apple-splash-1125-2436.png',
        media:
          '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)',
      },
      {
        url: '/splash/apple-splash-1242-2688.png',
        media:
          '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)',
      },
      {
        url: '/splash/apple-splash-750-1334.png',
        media:
          '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)',
      },
      {
        url: '/splash/apple-splash-640-1136.png',
        media:
          '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)',
      },
    ],
  },
  category: 'news',
  classification: 'Cryptocurrency News',
  other: {
    'msapplication-TileColor': '#f7931a',
    'msapplication-config': '/browserconfig.xml',
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'application-name': 'CryptoNews',
    'apple-mobile-web-app-title': 'CryptoNews',
  },
};

import { OrganizationStructuredData, WebsiteStructuredData } from '@/components/StructuredData';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className="dark">
      <head>
        {/* Global Structured Data */}
        <OrganizationStructuredData />
        <WebsiteStructuredData />

        {/* Preconnect to external resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* DNS prefetch for API endpoints */}
        <link rel="dns-prefetch" href="https://api.coingecko.com" />

        {/* PWA splash screens for iOS */}
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-splash-dark.png"
          media="(prefers-color-scheme: dark)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-splash-light.png"
          media="(prefers-color-scheme: light)"
        />
        {/* JSON-LD Structured Data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'Crypto Data Aggregator',
              description:
                'Real-time cryptocurrency market data aggregator for 10,000+ coins and 200+ DeFi protocols',
              url: 'https://crypto-data-aggregator.vercel.app',
              applicationCategory: 'FinanceApplication',
              operatingSystem: 'Web',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              featureList: [
                'Real-time cryptocurrency prices',
                'DeFi protocol analytics',
                'Portfolio tracking',
                'Price alerts',
                'Historical charts',
                'Fear & Greed Index',
                'Free REST API',
                'MCP Server support',
              ],
            }),
          }}
        />
      </head>
      <body className="bg-[var(--bg-primary)] antialiased min-h-screen text-white">
        {/* Skip Link for Accessibility */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ThemeProvider>
          <CurrencyProvider>
            <ToastProvider>
              <KeyboardShortcutsProvider>
                <WatchlistProvider>
                  <AlertsProvider>
                    <PortfolioProvider>
                      <BookmarksProvider>
                        <PWAProvider>
                          {children}
                          <GlobalSearch />
                          <InstallPrompt />
                          <UpdatePrompt />
                          <OfflineIndicator />
                        </PWAProvider>
                      </BookmarksProvider>
                    </PortfolioProvider>
                  </AlertsProvider>
                </WatchlistProvider>
              </KeyboardShortcutsProvider>
            </ToastProvider>
          </CurrencyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
