/**
 * Trending Topics Sidebar
 * Shows trending topics and tags
 */

'use client';

import Link from 'next/link';
import { Flame } from 'lucide-react';

interface Topic {
  name: string;
  slug: string;
  count: number;
}

interface TrendingTopicsProps {
  topics?: Topic[];
}

const defaultTopics: Topic[] = [
  { name: 'Bitcoin ETF', slug: 'bitcoin-etf', count: 24 },
  { name: 'Ethereum', slug: 'ethereum', count: 18 },
  { name: 'DeFi', slug: 'defi', count: 15 },
  { name: 'Regulation', slug: 'regulation', count: 12 },
  { name: 'NFTs', slug: 'nft', count: 9 },
  { name: 'Stablecoins', slug: 'stablecoin', count: 8 },
  { name: 'Layer 2', slug: 'layer2', count: 7 },
  { name: 'Mining', slug: 'mining', count: 5 },
];

export default function TrendingTopics({ topics = defaultTopics }: TrendingTopicsProps) {
  return (
    <div className="bg-surface rounded-xl border border-surface-border p-6">
      <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
        <Flame className="w-5 h-5 text-orange-500" />
        Trending Topics
      </h3>

      <div className="space-y-2">
        {topics.map((topic, index) => (
          <Link
            key={topic.slug}
            href={`/topic/${topic.slug}`}
            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-hover transition group"
          >
            <div className="flex items-center gap-3">
              <span className="text-text-muted text-sm font-medium w-5">{index + 1}</span>
              <span className="text-text-primary group-hover:text-primary transition">
                {topic.name}
              </span>
            </div>
            <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded-full">
              {topic.count}
            </span>
          </Link>
        ))}
      </div>

      <Link href="/topics" className="block mt-4 text-center text-sm text-primary hover:underline">
        View all topics →
      </Link>
    </div>
  );
}
