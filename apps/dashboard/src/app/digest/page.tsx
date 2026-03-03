import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Daily Digest - Free Crypto News',
  description: 'AI-powered daily crypto news digest. Get caught up on everything that matters.',
};

// Force dynamic rendering to avoid self-referential API call during build
export const dynamic = 'force-dynamic';

interface DigestData {
  headline: string;
  tldr: string;
  marketSentiment: {
    overall: string;
    reasoning: string;
  };
  sections: Array<{
    title: string;
    summary: string;
    articles: string[];
  }>;
  mustRead: Array<{
    title: string;
    source: string;
    why: string;
  }>;
  tickers: Array<{
    symbol: string;
    mentions: number;
    sentiment: string;
  }>;
  generatedAt: string;
}

async function getDigest(): Promise<DigestData | null> {
  // During Vercel build, skip external API calls to self
  if (process.env.VERCEL_ENV === 'production' && process.env.CI) {
    console.log('Skipping digest fetch during build');
    return null;
  }
  
  try {
    // Use internal API route during development
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://free-crypto-news.vercel.app';
    const res = await fetch(`${baseUrl}/api/digest`, {
      next: { revalidate: 300 },
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      console.warn('Digest API returned non-ok status:', res.status);
      return null;
    }
    return res.json();
  } catch (error) {
    console.warn('Failed to fetch digest:', error);
    return null;
  }
}

const sentimentColors: Record<string, string> = {
  bullish: 'text-gain bg-gain/10',
  bearish: 'text-loss bg-loss/10',
  neutral: 'text-text-secondary bg-surface-alt',
  mixed: 'text-warning bg-warning/10',
};

const sentimentEmojis: Record<string, string> = {
  bullish: '🟢',
  bearish: '🔴',
  neutral: '⚪',
  mixed: '🟡',
};

export default async function DigestPage() {
  const digest = await getDigest();

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto">
        <Header />

        <main className="px-4 py-8">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold mb-2">📋 Daily Digest</h1>
            <p className="text-text-secondary">
              AI-powered summary of today&apos;s crypto news
            </p>
          </div>

          {digest ? (
            <div className="space-y-6">
              {/* Headline */}
              <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl p-8 text-center">
                <h2 className="text-3xl font-bold text-text-primary mb-4">{digest.headline}</h2>
                <p className="text-lg text-text-secondary">{digest.tldr}</p>
              </div>

              {/* Market Sentiment */}
              <div className="bg-surface rounded-xl border border-surface-border p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  📊 Market Sentiment
                </h3>
                <div className="flex items-center gap-4 mb-3">
                  <span className={`px-4 py-2 rounded-full font-medium ${sentimentColors[digest.marketSentiment.overall] || sentimentColors.neutral}`}>
                    {sentimentEmojis[digest.marketSentiment.overall] || '⚪'} {digest.marketSentiment.overall.charAt(0).toUpperCase() + digest.marketSentiment.overall.slice(1)}
                  </span>
                </div>
                <p className="text-text-secondary">{digest.marketSentiment.reasoning}</p>
              </div>

              {/* Must Read */}
              {digest.mustRead?.length > 0 && (
                <div className="bg-surface rounded-xl border border-surface-border p-6">
                  <h3 className="font-bold text-lg mb-4">⭐ Must Read</h3>
                  <div className="space-y-4">
                    {digest.mustRead.map((article, i) => (
                      <div key={i} className="p-4 bg-surface-alt rounded-lg">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-semibold text-text-primary">{article.title}</h4>
                            <p className="text-sm text-text-muted mt-1">{article.source}</p>
                          </div>
                        </div>
                        <p className="text-sm text-primary mt-2">💡 {article.why}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sections */}
              {digest.sections?.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-bold text-lg">📰 News by Topic</h3>
                  {digest.sections.map((section, i) => (
                    <div key={i} className="bg-surface rounded-xl border border-surface-border p-6">
                      <h4 className="font-bold text-lg mb-2">{section.title}</h4>
                      <p className="text-text-secondary mb-4">{section.summary}</p>
                      {section.articles?.length > 0 && (
                        <ul className="space-y-2 text-sm text-text-secondary">
                          {section.articles.map((article, j) => (
                            <li key={j} className="flex items-start gap-2">
                              <span className="text-text-muted">•</span>
                              {article}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Trending Tickers */}
              {digest.tickers?.length > 0 && (
                <div className="bg-surface rounded-xl border border-surface-border p-6">
                  <h3 className="font-bold text-lg mb-4">💰 Most Mentioned</h3>
                  <div className="flex flex-wrap gap-3">
                    {digest.tickers.map((ticker) => (
                      <Link
                        key={ticker.symbol}
                        href={`/search?q=${ticker.symbol}`}
                        className={`px-4 py-2 rounded-full border border-surface-border flex items-center gap-2 hover:shadow-md transition ${sentimentColors[ticker.sentiment] || 'bg-surface-alt'}`}
                      >
                        <span className="font-bold">{ticker.symbol}</span>
                        <span className="text-sm opacity-75">{ticker.mentions}x</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamp */}
              <div className="text-center text-sm text-text-muted">
                Generated at {new Date(digest.generatedAt).toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-surface rounded-xl border border-surface-border">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold text-text-secondary mb-2">Digest Unavailable</h3>
              <p className="text-text-muted mb-4">AI features require GROQ_API_KEY to be configured</p>
              <Link href="/" className="text-primary hover:underline">
                ← Back to latest news
              </Link>
            </div>
          )}
        </main>

        <Footer />
      </div>
    </div>
  );
}
