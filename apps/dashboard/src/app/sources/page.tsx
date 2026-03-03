/**
 * All Sources Page
 * Browse all news sources
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getSources } from '@/lib/crypto-news';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'News Sources',
  description: 'Browse all crypto news sources aggregated by Free Crypto News. Trusted sources including CoinDesk, The Block, Decrypt, and more.',
};

export const revalidate = 300;

// Source metadata for display
const sourceDetails: Record<string, {
  description: string;
  focus: string[];
  emoji: string;
  color: string;
}> = {
  coindesk: {
    description: 'The leading media platform for the crypto industry',
    focus: ['News', 'Markets', 'Research'],
    emoji: '📰',
    color: 'from-blue-500 to-blue-600',
  },
  theblock: {
    description: 'Research, analysis, and news for digital assets',
    focus: ['Research', 'Data', 'Analysis'],
    emoji: '📊',
    color: 'from-purple-500 to-purple-600',
  },
  decrypt: {
    description: 'News and educational content about crypto and Web3',
    focus: ['News', 'Learn', 'Culture'],
    emoji: '🔓',
    color: 'from-green-500 to-green-600',
  },
  cointelegraph: {
    description: 'Independent media covering blockchain and fintech',
    focus: ['News', 'Markets', 'Magazine'],
    emoji: '📡',
    color: 'from-yellow-500 to-orange-500',
  },
  bitcoinmagazine: {
    description: 'The oldest and most established Bitcoin publication',
    focus: ['Bitcoin', 'Lightning', 'Culture'],
    emoji: '₿',
    color: 'from-orange-500 to-orange-600',
  },
  blockworks: {
    description: 'Financial media for institutional crypto investors',
    focus: ['Institutional', 'Markets', 'Research'],
    emoji: '🏦',
    color: 'from-indigo-500 to-indigo-600',
  },
  defiant: {
    description: 'The leading news site for DeFi and Web3',
    focus: ['DeFi', 'DAOs', 'Web3'],
    emoji: '🦾',
    color: 'from-pink-500 to-pink-600',
  },
};

export default async function SourcesPage() {
  const { sources } = await getSources();
  
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto">
        <Header />
        
        <main className="px-4 py-8">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">📚 News Sources</h1>
            <p className="text-xl text-text-secondary max-w-2xl mx-auto">
              We aggregate news from the most trusted sources in crypto journalism.
              All content is fetched in real-time from official RSS feeds.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            <div className="bg-surface rounded-xl p-6 border border-surface-border text-center">
              <p className="text-4xl font-bold text-blue-600">{sources.length}</p>
              <p className="text-text-muted">Active Sources</p>
            </div>
            <div className="bg-surface rounded-xl p-6 border border-surface-border text-center">
              <p className="text-4xl font-bold text-green-600">100%</p>
              <p className="text-text-muted">Free Access</p>
            </div>
            <div className="bg-surface rounded-xl p-6 border border-surface-border text-center">
              <p className="text-4xl font-bold text-purple-600">Real-time</p>
              <p className="text-text-muted">RSS Feeds</p>
            </div>
            <div className="bg-surface rounded-xl p-6 border border-surface-border text-center">
              <p className="text-4xl font-bold text-orange-600">0</p>
              <p className="text-text-muted">API Keys Required</p>
            </div>
          </div>

          {/* Sources Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {sources.map(source => {
              const details = sourceDetails[source.key];
              return (
                <Link
                  key={source.key}
                  href={`/source/${source.key}`}
                  className="group bg-surface rounded-xl border border-surface-border overflow-hidden hover:shadow-lg transition"
                >
                  {/* Color Banner */}
                  <div className={`h-2 bg-gradient-to-r ${details?.color || 'from-surface-hover to-surface-alt'}`} />
                  
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{details?.emoji || '📰'}</span>
                        <div>
                          <h2 className="font-bold text-xl group-hover:text-primary transition">
                            {source.name}
                          </h2>
                          <span className={`inline-flex items-center gap-1 text-xs ${
                            source.status === 'active' ? 'text-gain' : 'text-loss'
                          }`}>
                            <span className={`w-2 h-2 rounded-full ${
                              source.status === 'active' ? 'bg-gain' : 'bg-loss'
                            }`} />
                            {source.status === 'active' ? 'Active' : 'Unavailable'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-text-secondary text-sm mb-4">
                      {details?.description || 'Crypto news source'}
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
                      {(details?.focus || [source.category]).map(tag => (
                        <span 
                          key={tag}
                          className="bg-surface-alt text-text-secondary px-2 py-1 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Info Section */}
          <div className="bg-surface rounded-xl border border-surface-border p-8">
            <h2 className="text-2xl font-bold mb-4">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="text-3xl mb-2">📡</div>
                <h3 className="font-bold mb-2">RSS Aggregation</h3>
                <p className="text-text-secondary text-sm">
                  We fetch news directly from official RSS feeds of each source, ensuring 
                  accurate and up-to-date content.
                </p>
              </div>
              <div>
                <div className="text-3xl mb-2">⚡</div>
                <h3 className="font-bold mb-2">Real-time Updates</h3>
                <p className="text-text-secondary text-sm">
                  New articles appear within minutes of publication. Our system 
                  continuously monitors all sources for fresh content.
                </p>
              </div>
              <div>
                <div className="text-3xl mb-2">🔗</div>
                <h3 className="font-bold mb-2">Direct Links</h3>
                <p className="text-text-secondary text-sm">
                  All articles link directly to the original source. We believe in 
                  supporting quality journalism.
                </p>
              </div>
            </div>
          </div>

          {/* API CTA */}
          <div className="mt-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-8 text-white text-center">
            <h2 className="text-2xl font-bold mb-2">Build With Our API</h2>
            <p className="text-blue-100 mb-4">
              Access all these sources programmatically with our free API. No registration required.
            </p>
            <div className="flex justify-center gap-4">
              <Link 
                href="/examples"
                className="bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-blue-50 transition"
              >
                View Examples
              </Link>
              <a 
                href="https://github.com/nirholas/free-crypto-news"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-400 transition"
              >
                GitHub →
              </a>
            </div>
          </div>
        </main>
        
        <Footer />
      </div>
    </div>
  );
}
