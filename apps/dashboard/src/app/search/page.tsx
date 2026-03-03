import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SearchPageContent } from '@/components/SearchPageContent';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search - Free Crypto News',
  description:
    'Search crypto news from 7 major sources. Find articles about Bitcoin, Ethereum, DeFi, and more.',
};

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto">
        <Header />

        <main className="px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-3">🔍 Search News</h1>
            <p className="text-text-secondary max-w-2xl mx-auto">
              Search across 7 major crypto news sources. Find the latest articles on any topic.
            </p>
          </div>

          <SearchPageContent />
        </main>

        <Footer />
      </div>
    </div>
  );
}
