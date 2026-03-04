import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Market Sentiment - Crypto Data Aggregator',
  description: 'AI-powered crypto market sentiment analysis. Understand the mood of the market.',
};

// Force dynamic rendering to avoid self-referential API call during build
export const dynamic = 'force-dynamic';

interface SentimentArticle {
  title: string;
  source: string;
  sentiment: string;
  confidence: number;
  reasoning: string;
  impactLevel: string;
  affectedAssets: string[];
}

interface MarketSentiment {
  overall: string;
  score: number;
  confidence: number;
  summary: string;
  keyDrivers: string[];
}

interface SentimentData {
  articles: SentimentArticle[];
  market: MarketSentiment;
}

async function getSentiment(): Promise<SentimentData | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'https://crypto-data-aggregator.vercel.app'}/api/sentiment?limit=20`,
      {
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

const sentimentColors: Record<string, { text: string; bg: string; border: string }> = {
  very_bullish: {
    text: 'text-text-primary',
    bg: 'bg-surface-alt',
    border: 'border-surface-border',
  },
  bullish: {
    text: 'text-text-primary',
    bg: 'bg-surface-alt',
    border: 'border-surface-border',
  },
  neutral: {
    text: 'text-text-secondary',
    bg: 'bg-surface-alt',
    border: 'border-surface-border',
  },
  bearish: {
    text: 'text-text-muted',
    bg: 'bg-surface-alt',
    border: 'border-surface-border',
  },
  very_bearish: {
    text: 'text-text-muted',
    bg: 'bg-surface-alt',
    border: 'border-surface-border',
  },
};

// Text labels instead of emojis for sentiment
const sentimentLabels: Record<string, string> = {
  very_bullish: 'VERY BULLISH',
  bullish: 'BULLISH',
  neutral: 'NEUTRAL',
  bearish: 'BEARISH',
  very_bearish: 'VERY BEARISH',
};

function SentimentGauge({ score }: { score: number }) {
  // Score is -100 to 100, normalize to 0-100 for display
  const normalized = (score + 100) / 2;
  const rotation = (normalized / 100) * 180 - 90; // -90 to 90 degrees

  return (
    <div className="relative w-48 h-24 mx-auto">
      {/* Gauge background */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="w-48 h-48 rounded-full border-[16px] border-surface-border"
          style={{
            borderTopColor: '#525252',
            borderRightColor: '#a3a3a3',
            borderBottomColor: 'transparent',
            borderLeftColor: '#171717',
            transform: 'rotate(-45deg)',
          }}
        />
      </div>
      {/* Needle */}
      <div
        className="absolute bottom-0 left-1/2 w-1 h-20 bg-surface-alt origin-bottom rounded-full transition-transform duration-500"
        style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
      />
      {/* Center dot */}
      <div className="absolute bottom-0 left-1/2 w-4 h-4 bg-surface-alt rounded-full -translate-x-1/2 translate-y-1/2" />
      {/* Score */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-2xl font-bold text-text-primary">
        {score > 0 ? '+' : ''}
        {score}
      </div>
    </div>
  );
}

export default async function SentimentPage() {
  const data = await getSentiment();

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-6xl mx-auto">
        <Header />

        <main className="px-4 py-8">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <svg
                className="w-8 h-8 text-text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <h1 className="text-4xl font-bold text-text-primary">Market Sentiment</h1>
            </div>
            <p className="text-text-secondary">AI-powered analysis of crypto market mood</p>
          </div>

          {data ? (
            <div className="space-y-8">
              {/* Overall Sentiment Card */}
              <div className="bg-surface rounded-2xl border border-surface-border p-8">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div className="text-center">
                    <h2 className="text-lg text-text-muted mb-4">Market Sentiment Score</h2>
                    <SentimentGauge score={data.market.score} />
                    <div className="mt-12">
                      <span
                        className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-lg font-bold ${sentimentColors[data.market.overall]?.bg || 'bg-surface-alt'} ${sentimentColors[data.market.overall]?.text || 'text-text-secondary'}`}
                      >
                        {sentimentLabels[data.market.overall] || 'NEUTRAL'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-3 text-text-primary">Summary</h3>
                    <p className="text-text-secondary mb-4">{data.market.summary}</p>

                    <h3 className="font-bold text-lg mb-3 text-text-primary">Key Drivers</h3>
                    <ul className="space-y-2">
                      {data.market.keyDrivers?.map((driver, i) => (
                        <li key={i} className="flex items-start gap-2 text-text-secondary">
                          <span className="text-text-primary">→</span>
                          {driver}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 text-sm text-text-muted">
                      Confidence: {data.market.confidence}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Article Sentiment List */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <svg
                    className="w-5 h-5 text-text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                    />
                  </svg>
                  <h2 className="text-xl font-bold text-text-primary">Article Analysis</h2>
                </div>
                <div className="space-y-3">
                  {data.articles?.map((article, i) => (
                    <div
                      key={i}
                      className={`bg-surface rounded-xl border p-5 ${sentimentColors[article.sentiment]?.border || 'border-surface-border'}`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-text-primary">{article.title}</h3>
                          <p className="text-sm text-text-muted">{article.source}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${sentimentColors[article.sentiment]?.bg || 'bg-surface-alt'} ${sentimentColors[article.sentiment]?.text || 'text-text-secondary'}`}
                          >
                            {article.sentiment.replace('_', ' ')}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${article.impactLevel === 'high' ? 'bg-surface-alt text-text-primary font-semibold' : article.impactLevel === 'medium' ? 'bg-surface-alt text-text-secondary' : 'bg-surface-alt text-text-secondary'}`}
                          >
                            {article.impactLevel} impact
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-text-secondary mb-3">{article.reasoning}</p>
                      {article.affectedAssets?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {article.affectedAssets.map((asset) => (
                            <Link
                              key={asset}
                              href={`/search?q=${asset}`}
                              className="text-xs px-2 py-1 bg-surface-alt text-text-primary rounded hover:bg-surface-alt"
                            >
                              {asset}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-surface rounded-xl border border-surface-border">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <h3 className="text-xl font-semibold text-text-secondary mb-2">
                Sentiment Analysis Unavailable
              </h3>
              <p className="text-text-muted mb-4">
                AI features require GROQ_API_KEY to be configured
              </p>
              <Link href="/" className="text-text-primary hover:underline">
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
