/**
 * Watchlist Page Layout
 * Provides metadata for the watchlist feature
 */

import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Watchlist - Track Your Favorite Coins',
  description:
    'Track your favorite cryptocurrencies in one place. Set price alerts, monitor performance, and stay updated on the coins that matter to you.',
  openGraph: {
    title: 'My Crypto Watchlist ⭐',
    description: 'Track your favorite cryptocurrencies with real-time updates and price alerts',
    images: [{
      url: '/api/og?type=page&title=Crypto%20Watchlist&subtitle=Track%20Your%20Favorite%20Coins',
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'My Crypto Watchlist ⭐',
    description: 'Track your favorite cryptocurrencies with real-time updates and price alerts',
    images: ['/api/og?type=page&title=Crypto%20Watchlist&subtitle=Track%20Your%20Favorite%20Coins'],
  },
};

export default function WatchlistLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
