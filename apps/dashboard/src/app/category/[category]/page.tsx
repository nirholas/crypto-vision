/**
 * Category Page - Dynamic route for news categories
 * Shows filtered news by category (bitcoin, defi, markets, etc.)
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Posts from '@/components/Posts';
import CategoryNav from '@/components/CategoryNav';
import TrendingSidebar from '@/components/TrendingSidebar';
import MarketMoodWidget from '@/components/MarketMoodWidget';
import { getNewsByCategory } from '@/lib/crypto-news';
import { BreadcrumbStructuredData, NewsListStructuredData } from '@/components/StructuredData';
import type { Metadata } from 'next';
import Link from 'next/link';

interface Props {
  params: Promise<{ category: string }>;
}

const categoryInfo: Record<string, { title: string; description: string; emoji: string }> = {
  bitcoin: {
    title: 'Bitcoin News',
    description: 'Latest Bitcoin news, price analysis, and BTC updates',
    emoji: '₿',
  },
  ethereum: {
    title: 'Ethereum News', 
    description: 'Latest Ethereum news, ETH updates, and ecosystem developments',
    emoji: 'Ξ',
  },
  defi: {
    title: 'DeFi News',
    description: 'Decentralized finance news, protocols, and yield updates',
    emoji: '🏦',
  },
  nft: {
    title: 'NFT News',
    description: 'Non-fungible token news, collections, and marketplace updates',
    emoji: '🎨',
  },
  regulation: {
    title: 'Crypto Regulation',
    description: 'Cryptocurrency regulation, policy, and legal news',
    emoji: '⚖️',
  },
  markets: {
    title: 'Market News',
    description: 'Cryptocurrency market analysis, trading, and price movements',
    emoji: '📈',
  },
  mining: {
    title: 'Mining News',
    description: 'Cryptocurrency mining news, hashrate, and industry updates',
    emoji: '⛏️',
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const info = categoryInfo[category] || {
    title: `${category} News`,
    description: `Latest ${category} cryptocurrency news`,
    emoji: '📰',
  };

  return {
    title: `${info.title} - Free Crypto News`,
    description: info.description,
    alternates: {
      canonical: `/category/${category}`,
    },
    openGraph: {
      title: `${info.title} - Crypto Data Aggregator`,
      description: info.description,
      type: 'website',
      url: `https://crypto-data-aggregator.vercel.app/category/${category}`,
    },
  };
}

export const revalidate = 300; // 5 minutes

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const info = categoryInfo[category] || {
    title: `${category?.charAt(0)?.toUpperCase() || ''}${category?.slice(1) || ''} News`,
    description: `Latest ${category} news`,
    emoji: '📰',
  };

  // Get news filtered by category
  const data = await getNewsByCategory(category, 50);

  // Breadcrumb data for enhanced SEO
  const breadcrumbs = [
    { name: 'Home', url: 'https://crypto-data-aggregator.vercel.app' },
    { name: 'Categories', url: 'https://crypto-data-aggregator.vercel.app/category/bitcoin' },
    { name: info.title, url: `https://crypto-data-aggregator.vercel.app/category/${category}` },
  ];

  return (
    <div className="min-h-screen bg-surface">
      {/* Structured Data for SEO */}
      <BreadcrumbStructuredData items={breadcrumbs} />
      <NewsListStructuredData
        articles={data.articles.slice(0, 10).map(a => ({
          title: a.title || '',
          link: a.link || '',
          pubDate: a.pubDate,
          source: a.source,
        }))}
        listName={info.title}
      />
      
      <div className="max-w-7xl mx-auto">
        <Header />
        <CategoryNav activeCategory={category} />
        
        <main className="px-4 py-8">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="mb-6 text-sm">
            <ol className="flex items-center gap-2 text-text-muted">
              <li>
                <Link href="/" className="hover:text-text-primary transition-colors">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-text-primary">{info.title}</li>
            </ol>
          </nav>

          {/* Category Header */}
          <div className="text-center mb-8">
            <span className="text-5xl mb-4 block">{info.emoji}</span>
            <h1 className="text-4xl font-bold mb-3">{info.title}</h1>
            <p className="text-text-muted max-w-2xl mx-auto">
              {info.description}
            </p>
            <p className="text-sm text-text-muted mt-2">
              {data.articles.length} articles
            </p>
          </div>

          {/* Market Mood Banner */}
          <div className="mb-8">
            <MarketMoodWidget />
          </div>

          {/* Main Content with Sidebar */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* News Grid */}
            <div className="lg:col-span-2">
              {data.articles.length > 0 ? (
                <Posts articles={data.articles} />
              ) : (
                <div className="text-center py-12">
                  <p className="text-text-muted">No articles found in this category.</p>
                  <p className="text-sm text-text-muted mt-2">
                    Try checking back later or browse all news.
                  </p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <aside className="hidden lg:block">
              <div className="sticky top-4">
                <TrendingSidebar trendingArticles={data.articles.slice(0, 5)} />
              </div>
            </aside>
          </div>
        </main>
        
        <Footer />
      </div>
    </div>
  );
}

// Generate static paths for common categories
export async function generateStaticParams() {
  return Object.keys(categoryInfo).map((category) => ({
    category,
  }));
}
