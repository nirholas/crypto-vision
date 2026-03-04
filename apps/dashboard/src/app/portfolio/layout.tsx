/**
 * Portfolio Page Layout
 * Provides metadata for the portfolio tracker
 */

import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Portfolio Tracker - Manage Your Crypto Holdings',
  description:
    'Track your cryptocurrency portfolio performance. Monitor profits, losses, and allocation across all your holdings.',
  openGraph: {
    title: 'Crypto Portfolio Tracker 💼',
    description: 'Track your cryptocurrency portfolio performance and allocation',
    images: [{
      url: '/api/og?type=page&title=Portfolio%20Tracker&subtitle=Manage%20Your%20Crypto%20Holdings',
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crypto Portfolio Tracker 💼',
    description: 'Track your cryptocurrency portfolio performance and allocation',
    images: ['/api/og?type=page&title=Portfolio%20Tracker&subtitle=Manage%20Your%20Crypto%20Holdings'],
  },
};

export default function PortfolioLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
