import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About - Free Crypto News',
  description: 'Learn about Free Crypto News - 100% free crypto news API aggregating from 7 major sources.',
};

const sources = [
  { name: 'CoinDesk', url: 'https://coindesk.com', description: 'Leading crypto news and analysis' },
  { name: 'The Block', url: 'https://theblock.co', description: 'Institutional-grade crypto research' },
  { name: 'Decrypt', url: 'https://decrypt.co', description: 'Web3 and crypto news for everyone' },
  { name: 'CoinTelegraph', url: 'https://cointelegraph.com', description: 'Independent crypto media' },
  { name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com', description: 'Original Bitcoin publication' },
  { name: 'Blockworks', url: 'https://blockworks.co', description: 'Financial news meets crypto' },
  { name: 'The Defiant', url: 'https://thedefiant.io', description: 'DeFi-focused news and analysis' },
];

const features = [
  { icon: '🆓', title: 'Completely Free', description: 'No API keys, no rate limits, no hidden costs' },
  { icon: '⚡', title: 'Real-time Updates', description: 'News aggregated every 5 minutes from all sources' },
  { icon: '🔍', title: 'Smart Search', description: 'Search across all sources with keyword matching' },
  { icon: '📊', title: 'Market Data', description: 'Live prices, fear & greed index, and market stats' },
  { icon: '🤖', title: 'AI Summaries', description: 'Get AI-powered article summaries and analysis' },
  { icon: '🔧', title: 'Developer Friendly', description: 'REST API, RSS feeds, and SDK libraries' },
];

// Categorized endpoints to surface all available APIs
const endpointCategories = [
  {
    category: '📰 News & Content',
    endpoints: [
      { path: '/api/news', description: 'Latest news from all sources' },
      { path: '/api/search?q=', description: 'Search news by keywords' },
      { path: '/api/bitcoin', description: 'Bitcoin-specific news' },
      { path: '/api/defi', description: 'DeFi news and updates' },
      { path: '/api/breaking', description: 'Breaking news (last 2 hours)' },
      { path: '/api/trending', description: 'Trending topics analysis' },
      { path: '/api/sources', description: 'List of news sources' },
      { path: '/api/article?url=', description: 'Fetch & summarize full article' },
    ],
  },
  {
    category: '🤖 AI & Intelligence',
    endpoints: [
      { path: '/api/summarize', description: 'AI article summarization' },
      { path: '/api/sentiment', description: 'Market sentiment analysis' },
      { path: '/api/signals', description: 'AI-generated trading signals' },
      { path: '/api/narratives', description: 'Dominant market narratives' },
      { path: '/api/entities', description: 'Named entity recognition' },
      { path: '/api/factcheck', description: 'Fact-check crypto claims' },
      { path: '/api/clickbait', description: 'Headline quality scoring' },
      { path: '/api/digest', description: 'AI-curated news digest' },
      { path: '/api/ask', description: 'Natural language Q&A' },
      { path: '/api/classify', description: 'Topic classification' },
    ],
  },
  {
    category: '📊 Market Data',
    endpoints: [
      { path: '/api/market', description: 'Global market stats' },
      { path: '/api/v2/coins', description: 'Top coins with prices' },
      { path: '/api/v2/coin/:id', description: 'Detailed coin data' },
      { path: '/api/v2/global', description: 'Global crypto metrics' },
      { path: '/api/v2/defi', description: 'DeFi TVL & protocols' },
      { path: '/api/v2/gas', description: 'Multi-chain gas prices' },
      { path: '/api/v2/volatility', description: 'Volatility metrics' },
      { path: '/api/exchanges', description: 'Exchange listings' },
      { path: '/api/bitcoin/halving', description: 'Halving countdown' },
    ],
  },
  {
    category: '📈 Analytics',
    endpoints: [
      { path: '/api/analytics/anomalies', description: 'Unusual pattern detection' },
      { path: '/api/analytics/sources', description: 'Source credibility scores' },
      { path: '/api/analytics/headlines', description: 'Track headline changes' },
      { path: '/api/origins', description: 'Trace to original sources' },
      { path: '/api/stats', description: 'API usage statistics' },
    ],
  },
  {
    category: '🔄 Real-time & Feeds',
    endpoints: [
      { path: '/api/rss', description: 'RSS feed output' },
      { path: '/api/atom', description: 'Atom feed format' },
      { path: '/api/opml', description: 'OPML export for readers' },
      { path: '/api/sse', description: 'Server-Sent Events stream' },
      { path: '/api/ws', description: 'WebSocket endpoint' },
    ],
  },
  {
    category: '🛠️ Developer Tools',
    endpoints: [
      { path: '/api/v2/graphql', description: 'GraphQL API' },
      { path: '/api/v2/batch', description: 'Batch API calls' },
      { path: '/api/webhooks', description: 'Webhook subscriptions' },
      { path: '/api/health', description: 'API health check' },
      { path: '/api/v2/openapi.json', description: 'OpenAPI specification' },
      { path: '/docs/swagger', description: 'Interactive API explorer' },
    ],
  },
  {
    category: '💎 Premium (x402)',
    endpoints: [
      { path: '/api/premium/ai/analyze', description: 'Deep AI analysis ($0.05)' },
      { path: '/api/premium/ai/compare', description: 'Coin comparison ($0.03)' },
      { path: '/api/premium/ai/signals', description: 'Trading signals ($0.05)' },
      { path: '/api/premium/whales', description: 'Whale tracking ($0.05)' },
      { path: '/api/premium/screener', description: 'Advanced screener ($0.01)' },
      { path: '/api/premium/portfolio', description: 'Portfolio analytics ($0.02)' },
    ],
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto">
        <Header />

        <main className="px-4 py-12">
          {/* Hero */}
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold mb-4">About Free Crypto News</h1>
            <p className="text-xl text-text-muted max-w-3xl mx-auto">
              The only 100% free crypto news aggregator API. No API keys required.
              No rate limits. Just pure, real-time crypto news from 7 major sources.
            </p>
          </div>

          {/* Features Grid */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-center mb-8">Why Free Crypto News?</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature) => (
                <div key={feature.title} className="p-6 rounded-xl border border-surface-border hover:shadow-lg transition">
                  <div className="text-4xl mb-3">{feature.icon}</div>
                  <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                  <p className="text-text-muted">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sources */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-center mb-8">Our Sources</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sources.map((source) => (
                <a
                  key={source.name}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-5 rounded-xl border border-surface-border hover:border-surface-hover hover:shadow-md transition group"
                >
                  <h3 className="font-bold text-lg mb-1 group-hover:text-primary">{source.name}</h3>
                  <p className="text-text-muted text-sm">{source.description}</p>
                </a>
              ))}
            </div>
          </div>

          {/* API Section */}
          <div className="mb-16 bg-surface-alt rounded-2xl p-8 text-text-primary">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold mb-4">🚀 Quick Start</h2>
              <p className="text-text-secondary mb-6">
                Start fetching crypto news in seconds. No signup required.
              </p>

              <div className="space-y-4">
                <div>
                  <p className="text-text-muted text-sm mb-2">Get latest news:</p>
                  <code className="block bg-surface p-3 rounded-lg text-gain text-sm overflow-x-auto">
                    curl https://free-crypto-news.vercel.app/api/news?limit=10
                  </code>
                </div>

                <div>
                  <p className="text-text-muted text-sm mb-2">Search news:</p>
                  <code className="block bg-surface p-3 rounded-lg text-gain text-sm overflow-x-auto">
                    curl https://free-crypto-news.vercel.app/api/search?q=bitcoin
                  </code>
                </div>

                <div>
                  <p className="text-text-muted text-sm mb-2">Get Bitcoin news:</p>
                  <code className="block bg-surface p-3 rounded-lg text-gain text-sm overflow-x-auto">
                    curl https://free-crypto-news.vercel.app/api/bitcoin?limit=5
                  </code>
                </div>
              </div>

              <div className="mt-6 flex gap-4">
                <Link href="/examples" className="px-6 py-3 bg-surface text-text-primary rounded-full font-medium hover:bg-surface-hover transition">
                  View All Examples →
                </Link>
                <a
                  href="https://github.com/nirholas/free-crypto-news"
                  className="px-6 py-3 border border-surface-border rounded-full font-medium hover:border-text-primary transition"
                >
                  GitHub Docs
                </a>
              </div>
            </div>
          </div>

          {/* Endpoints */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-center mb-4">API Endpoints</h2>
            <p className="text-center text-text-muted mb-8">
              60+ endpoints covering news, market data, AI analysis, and more
            </p>
            <div className="grid lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
              {endpointCategories.map((cat) => (
                <div key={cat.category} className="rounded-xl border border-surface-border overflow-hidden">
                  <div className="bg-surface-alt px-4 py-3 font-semibold">{cat.category}</div>
                  <div className="divide-y divide-surface-border">
                    {cat.endpoints.map((ep) => (
                      <div key={ep.path} className="px-4 py-2 flex items-start gap-3">
                        <code className="font-mono text-sm text-primary whitespace-nowrap">{ep.path}</code>
                        <span className="text-text-muted text-sm">{ep.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-6">
              <Link href="/docs/swagger" className="text-primary hover:underline">
                Explore all endpoints in Swagger UI →
              </Link>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-text-muted mb-6">Deploy your own instance or use our free public API</p>
            <div className="flex justify-center gap-4 flex-wrap">
              <a
                href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnirholas%2Ffree-crypto-news"
                className="px-6 py-3 bg-primary text-white rounded-full font-medium hover:bg-primary-hover transition"
              >
                ▲ Deploy on Vercel
              </a>
              <a
                href="https://github.com/nirholas/free-crypto-news"
                className="px-6 py-3 border border-surface-border rounded-full font-medium hover:bg-surface hover:text-white transition"
              >
                ⭐ Star on GitHub
              </a>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
