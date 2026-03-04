import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Flame, TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import MarketMoodWidget from '@/components/MarketMoodWidget';
import { SocialBuzz } from '@/components/SocialBuzz';

export const metadata: Metadata = {
  title: 'Trending Topics - Crypto Data Aggregator',
  description:
    "See what's trending in crypto news right now. Real-time analysis of the hottest topics.",
};

// Force dynamic rendering to avoid self-referential API call during build
export const dynamic = 'force-dynamic';

interface TrendingTopic {
  topic: string;
  count: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  recentHeadlines: string[];
}

async function getTrending(): Promise<{ trending: TrendingTopic[]; articlesAnalyzed: number }> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'https://crypto-data-aggregator.vercel.app'}/api/trending?limit=20`,
      {
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  } catch {
    return { trending: [], articlesAnalyzed: 0 };
  }
}

const sentimentConfig = {
  bullish: { icon: TrendingUp, label: 'Bullish', color: 'text-green-600', bg: 'bg-green-100' },
  bearish: { icon: TrendingDown, label: 'Bearish', color: 'text-red-600', bg: 'bg-red-100' },
  neutral: { icon: Minus, label: 'Neutral', color: 'text-text-muted', bg: 'bg-surface-alt' },
};

export default async function TrendingPage() {
  const data = await getTrending();

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto">
        <Header />

        <main className="px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <Flame className="w-8 h-8 text-orange-500" />
              Trending Topics
            </h1>
            <p className="text-text-muted">
              Real-time analysis of what&apos;s hot in crypto news • {data.articlesAnalyzed}{' '}
              articles analyzed
            </p>
          </div>

          {/* Market Mood Banner */}
          <div className="mb-8">
            <MarketMoodWidget />
          </div>

          {/* Social Buzz Section */}
          <div className="mb-8">
            <SocialBuzz />
          </div>

          {data.trending.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.trending.map((topic, index) => {
                const SentimentIcon = sentimentConfig[topic.sentiment].icon;
                return (
                  <div
                    key={topic.topic}
                    className="bg-surface rounded-xl border border-surface-border p-5 hover:shadow-lg transition"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-text-muted/50">#{index + 1}</span>
                        <h3 className="text-xl font-bold">{topic.topic}</h3>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${sentimentConfig[topic.sentiment].bg} ${sentimentConfig[topic.sentiment].color}`}
                      >
                        <SentimentIcon className="w-3 h-3" />
                        {sentimentConfig[topic.sentiment].label}
                      </span>
                    </div>

                    <div className="text-sm text-text-muted mb-3">
                      {topic.count} mentions in recent news
                    </div>

                    {topic.recentHeadlines.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-text-muted uppercase font-medium">
                          Recent Headlines
                        </p>
                        {topic.recentHeadlines.slice(0, 3).map((headline, i) => (
                          <p key={i} className="text-sm text-text-secondary line-clamp-2">
                            • {headline}
                          </p>
                        ))}
                      </div>
                    )}

                    <Link
                      href={`/search?q=${encodeURIComponent(topic.topic)}`}
                      className="inline-block mt-4 text-sm text-blue-600 hover:underline"
                    >
                      View all {topic.topic} news →
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-surface rounded-xl">
              <div className="flex justify-center mb-4">
                <BarChart3 className="w-16 h-16 text-text-muted" />
              </div>
              <h3 className="text-xl font-semibold text-text-secondary mb-2">Analyzing trends...</h3>
              <p className="text-text-muted">Check back soon for trending topics</p>
            </div>
          )}

          {/* Sentiment Legend */}
          <div className="mt-8 p-4 bg-surface rounded-xl border border-surface-border">
            <h4 className="font-medium mb-3">Understanding Sentiment</h4>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span>Bullish - Positive market sentiment</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span>Bearish - Negative market sentiment</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-text-muted"></span>
                <span>Neutral - Mixed or balanced coverage</span>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
