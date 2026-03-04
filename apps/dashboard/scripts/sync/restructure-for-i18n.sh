#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Restructure App for i18n
# 
# Moves pages from src/app/ to src/app/[locale]/ for next-intl support.
# CAUTION: This is a significant change. Review before committing.
# ═══════════════════════════════════════════════════════════════════════════════

set -e

CDA_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
APP_DIR="$CDA_DIR/src/app"
LOCALE_DIR="$APP_DIR/[locale]"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🔧 i18n App Restructure${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Folders that should stay at app/ level (not locale-specific)
STAY_AT_ROOT=(
    "api"
    "feed.xml"
    "robots.ts"
    "sitemap.ts"
)

# Function to check if a folder should stay at root
should_stay_at_root() {
    local folder=$1
    for item in "${STAY_AT_ROOT[@]}"; do
        if [ "$folder" = "$item" ]; then
            return 0
        fi
    done
    return 1
}

show_plan() {
    echo -e "${YELLOW}📋 Migration Plan (dry run):${NC}"
    echo ""
    
    echo -e "${GREEN}Will stay at /app/:${NC}"
    for item in "${STAY_AT_ROOT[@]}"; do
        if [ -e "$APP_DIR/$item" ]; then
            echo -e "  ○ $item"
        fi
    done
    
    echo ""
    echo -e "${GREEN}Will move to /app/[locale]/:${NC}"
    
    for item in "$APP_DIR"/*; do
        if [ -e "$item" ]; then
            name=$(basename "$item")
            if ! should_stay_at_root "$name"; then
                if [ "$name" != "[locale]" ]; then
                    echo -e "  → $name"
                fi
            fi
        fi
    done
    
    echo ""
    echo -e "${YELLOW}Run with --execute to perform migration${NC}"
}

execute_migration() {
    echo -e "${YELLOW}🚀 Executing migration...${NC}"
    echo ""
    
    # Create [locale] directory
    mkdir -p "$LOCALE_DIR"
    echo -e "${GREEN}✓${NC} Created $LOCALE_DIR"
    
    # Move folders
    for item in "$APP_DIR"/*; do
        if [ -e "$item" ]; then
            name=$(basename "$item")
            
            # Skip if it should stay at root
            if should_stay_at_root "$name"; then
                echo -e "${YELLOW}○${NC} Skipping $name (stays at root)"
                continue
            fi
            
            # Skip if it's already [locale]
            if [ "$name" = "[locale]" ]; then
                continue
            fi
            
            # Move the folder/file
            if [ -d "$item" ] || [ -f "$item" ]; then
                mv "$item" "$LOCALE_DIR/"
                echo -e "${GREEN}✓${NC} Moved $name → [locale]/$name"
            fi
        fi
    done
    
    echo ""
    echo -e "${GREEN}✅ Migration complete!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Update layout.tsx in [locale]/ to use NextIntlClientProvider"
    echo "  2. Update middleware.ts for locale detection"
    echo "  3. Update next.config.js for i18n plugin"
    echo "  4. Run npm install next-intl"
    echo "  5. Test the app: npm run dev"
}

create_locale_layout() {
    echo -e "${BLUE}Creating [locale]/layout.tsx that preserves your existing design...${NC}"
    
    # First, check if there's an existing layout.tsx to preserve
    if [ -f "$LOCALE_DIR/layout.tsx" ]; then
        echo -e "${YELLOW}layout.tsx already exists in [locale]/, adding i18n wrapper...${NC}"
        
        # Read the existing layout and wrap it
        # For now, just inform the user
        echo -e "${YELLOW}Please manually add NextIntlClientProvider to your existing layout${NC}"
        return
    fi
    
    cat > "$LOCALE_DIR/layout.tsx" << 'EOF'
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales, type Locale, isRtlLocale } from '@/i18n/config';
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
import { OrganizationStructuredData, WebsiteStructuredData } from '@/components/StructuredData';

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

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // Validate locale
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = isRtlLocale(locale as Locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className="dark">
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
      </head>
      <body className="bg-[var(--bg-primary)] antialiased min-h-screen text-white">
        {/* Skip Link for Accessibility */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <NextIntlClientProvider messages={messages}>
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
EOF
    
    echo -e "${GREEN}✓${NC} Created [locale]/layout.tsx (preserves your existing CDA design!)"
}

update_middleware() {
    echo -e "${BLUE}Creating/updating middleware.ts...${NC}"
    
    cat > "$CDA_DIR/src/middleware.ts" << 'EOF'
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed'
});

export const config = {
  matcher: [
    // Match all pathnames except for
    // - API routes
    // - Static files
    // - _next internals
    '/((?!api|_next|.*\\..*).*)',
  ]
};
EOF
    
    echo -e "${GREEN}✓${NC} Created middleware.ts"
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

show_help() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  plan        Show migration plan (default, dry run)"
    echo "  execute     Execute the migration"
    echo "  layout      Create [locale]/layout.tsx only"
    echo "  middleware  Create/update middleware.ts only"
    echo "  full        Execute migration + create layout + middleware"
    echo "  help        Show this help"
    echo ""
    echo -e "${RED}WARNING: This modifies your app structure. Commit changes first!${NC}"
}

case "${1:-plan}" in
    plan)
        show_plan
        ;;
    execute)
        execute_migration
        ;;
    layout)
        mkdir -p "$LOCALE_DIR"
        create_locale_layout
        ;;
    middleware)
        update_middleware
        ;;
    full)
        execute_migration
        create_locale_layout
        update_middleware
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac

echo ""
