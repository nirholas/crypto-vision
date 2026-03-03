// Navigation types
export type RootStackParamList = {
  Main: undefined;
  Article: { url: string; title: string };
};

export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Markets: undefined;
  Alerts: undefined;
  Settings: undefined;
};

// API response types
export interface Article {
  title: string;
  link: string;
  description?: string;
  pubDate: string;
  source: string;
  timeAgo: string;
  ticker?: string;
  image?: string;
}

export interface NewsResponse {
  articles: Article[];
  totalCount: number;
  fetchedAt: string;
}

export interface Sentiment {
  overall: string;
  score: number;
  label: 'bullish' | 'bearish' | 'neutral';
}

export interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  image?: string;
}

export interface FearGreed {
  value: number;
  classification: string;
  timestamp: string;
}

export interface Alert {
  id: string;
  type: 'price' | 'news' | 'sentiment';
  asset: string;
  condition: string;
  enabled: boolean;
}
