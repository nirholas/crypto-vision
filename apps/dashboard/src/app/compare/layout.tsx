/**
 * Compare Page Layout
 * Provides metadata for the coin comparison tool
 */

import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Compare Cryptocurrencies - Side by Side Analysis',
  description:
    'Compare cryptocurrency prices, market caps, and performance side by side. Analyze up to 5 coins at once.',
  openGraph: {
    title: 'Crypto Compare Tool ⚖️',
    description: 'Compare cryptocurrency prices, market caps, and performance side by side',
    images: [{
      url: '/api/og?type=page&title=Compare%20Cryptocurrencies&subtitle=Side%20by%20Side%20Analysis',
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crypto Compare Tool ⚖️',
    description: 'Compare cryptocurrency prices, market caps, and performance side by side',
    images: ['/api/og?type=page&title=Compare%20Cryptocurrencies&subtitle=Side%20by%20Side%20Analysis'],
  },
};

export default function CompareLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
