/**
 * Structured Data Components
 * JSON-LD schemas for enhanced SEO and rich snippets
 */

interface NewsArticleProps {
  headline: string;
  description?: string;
  datePublished: string;
  dateModified?: string;
  author?: string;
  publisher?: string;
  image?: string;
  url: string;
}

interface CoinDataProps {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  url: string;
  price?: number;
  priceChange24h?: number;
  marketCap?: number;
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

/**
 * Organization Schema - Site-wide
 */
export function OrganizationStructuredData() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Crypto Data Aggregator',
    url: 'https://crypto-data-aggregator.vercel.app',
    logo: 'https://crypto-data-aggregator.vercel.app/icons/icon-512x512.png',
    description: 'Real-time cryptocurrency market data, DeFi analytics, and portfolio tracking.',
    sameAs: ['https://github.com/nirholas/crypto-data-aggregator'],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'technical support',
      url: 'https://github.com/nirholas/crypto-data-aggregator/issues',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * Website Schema - For search features
 */
export function WebsiteStructuredData() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Crypto Data Aggregator',
    url: 'https://crypto-data-aggregator.vercel.app',
    description: 'Real-time cryptocurrency market data aggregator',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://crypto-data-aggregator.vercel.app/coin/{search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * NewsArticle Schema - For news items
 */
export function NewsArticleStructuredData({
  headline,
  description,
  datePublished,
  dateModified,
  author = 'Crypto Data Aggregator',
  publisher = 'Crypto Data Aggregator',
  image,
  url,
}: NewsArticleProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline,
    description: description || headline,
    datePublished,
    dateModified: dateModified || datePublished,
    author: {
      '@type': 'Organization',
      name: author,
    },
    publisher: {
      '@type': 'Organization',
      name: publisher,
      logo: {
        '@type': 'ImageObject',
        url: 'https://crypto-data-aggregator.vercel.app/icons/icon-512x512.png',
      },
    },
    image: image || 'https://crypto-data-aggregator.vercel.app/og-image.png',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * ArticleStructuredData - Alias for NewsArticleStructuredData
 * Used in article pages for SEO
 */
export interface ArticleStructuredDataProps {
  article: {
    title: string;
    description?: string;
    pubDate?: string;
    updatedAt?: string;
    author?: string;
    source?: string;
    image?: string;
  };
  url: string;
}

export function ArticleStructuredData({ article, url }: ArticleStructuredDataProps) {
  return (
    <NewsArticleStructuredData
      headline={article.title}
      description={article.description}
      datePublished={article.pubDate || new Date().toISOString()}
      dateModified={article.updatedAt || article.pubDate}
      author={article.author || article.source || 'Crypto Data Aggregator'}
      image={article.image}
      url={url}
    />
  );
}

/**
 * NewsArticle List Schema - For news feeds
 */
export function NewsListStructuredData({
  articles,
  listName = 'Latest Crypto News',
}: {
  articles: Array<{
    title: string;
    link: string;
    pubDate?: string;
    source?: string;
  }>;
  listName?: string;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    numberOfItems: articles.length,
    itemListElement: articles.slice(0, 10).map((article, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'NewsArticle',
        headline: article.title,
        url: article.link,
        datePublished: article.pubDate || new Date().toISOString(),
        publisher: {
          '@type': 'Organization',
          name: article.source || 'Crypto Data Aggregator',
        },
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * Cryptocurrency Schema - For coin pages
 */
export function CryptocurrencyStructuredData({
  name,
  symbol,
  description,
  image,
  url,
  price,
  priceChange24h,
  marketCap,
}: CoinDataProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${name} (${symbol.toUpperCase()})`,
    description: description || `${name} cryptocurrency price, charts, and market data`,
    image: image || 'https://crypto-data-aggregator.vercel.app/og-image.png',
    url,
    category: 'Cryptocurrency',
    brand: {
      '@type': 'Brand',
      name: name,
    },
    offers: price
      ? {
          '@type': 'Offer',
          price: price,
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          priceValidUntil: new Date(Date.now() + 3600000).toISOString(), // 1 hour
        }
      : undefined,
    additionalProperty: [
      priceChange24h !== undefined && {
        '@type': 'PropertyValue',
        name: '24h Price Change',
        value: `${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}%`,
      },
      marketCap && {
        '@type': 'PropertyValue',
        name: 'Market Cap',
        value: `$${marketCap.toLocaleString()}`,
      },
    ].filter(Boolean),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * Breadcrumb Schema - For navigation hierarchy
 */
export function BreadcrumbStructuredData({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * FAQ Schema - For FAQ pages
 */
export function FAQStructuredData({
  questions,
}: {
  questions: Array<{ question: string; answer: string }>;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * Financial Data Schema - For market pages
 */
export function FinancialDataStructuredData({
  name,
  description,
  dataPoints,
}: {
  name: string;
  description: string;
  dataPoints?: Array<{ name: string; value: string | number }>;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name,
    description,
    creator: {
      '@type': 'Organization',
      name: 'Crypto Data Aggregator',
    },
    dateModified: new Date().toISOString(),
    license: 'https://opensource.org/licenses/MIT',
    variableMeasured: dataPoints?.map((dp) => ({
      '@type': 'PropertyValue',
      name: dp.name,
      value: dp.value,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
