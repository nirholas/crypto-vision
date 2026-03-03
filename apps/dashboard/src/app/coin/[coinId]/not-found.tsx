/**
 * 404 page for invalid coin IDs
 */

import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Search } from 'lucide-react';

export default function CoinNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-surface via-surface to-surface-alt">
      <div className="max-w-7xl mx-auto">
        <Header />

        <main className="px-4 py-16 flex items-center justify-center min-h-[60vh]">
          <div className="max-w-md w-full text-center">
            {/* 404 Icon */}
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-surface-alt flex items-center justify-center">
              <Search className="w-12 h-12 text-text-muted" />
            </div>

            <h1 className="text-3xl font-bold text-text-primary mb-3">Coin Not Found</h1>

            <p className="text-text-muted mb-8">
              We couldn&apos;t find any cryptocurrency with that ID. The coin might have been
              delisted or the URL may be incorrect.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/markets"
                className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors"
              >
                Browse All Coins
              </Link>

              <Link
                href="/"
                className="px-6 py-3 bg-surface-alt hover:bg-surface-hover text-text-primary font-medium rounded-xl transition-colors"
              >
                Back to Home
              </Link>
            </div>

            {/* Popular coins */}
            <div className="mt-12 pt-8 border-t border-surface-border">
              <p className="text-sm text-text-muted mb-4">Popular cryptocurrencies:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
                  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
                  { id: 'solana', name: 'Solana', symbol: 'SOL' },
                  { id: 'binancecoin', name: 'BNB', symbol: 'BNB' },
                  { id: 'ripple', name: 'XRP', symbol: 'XRP' },
                  { id: 'cardano', name: 'Cardano', symbol: 'ADA' },
                ].map((coin) => (
                  <Link
                    key={coin.id}
                    href={`/coin/${coin.id}`}
                    className="px-3 py-1.5 bg-surface-alt hover:bg-surface-hover text-text-secondary text-sm rounded-lg transition-colors"
                  >
                    {coin.symbol}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
