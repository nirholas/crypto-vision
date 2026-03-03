/**
 * CoinPageClient - Client component for interactive coin page features
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CoinHeader,
  PriceBox,
  MarketStats,
  PriceStatistics,
  CoinConverter,
  CoinTabs,
  CoinInfo,
  DeveloperStats,
  MarketsTable,
  HistoricalTable,
  CoinNews,
  type CoinTab,
} from './components';
import { PriceChart } from '@/components/coin-charts';
import { useLivePrices } from '@/lib/price-websocket';
import { MarketMoodSidebar } from '@/components/MarketMoodWidget';
import { LivePriceCard } from '@/components/LivePrice';
import { PriceAlertModal } from '@/components/alerts';
import { useWatchlist } from '@/components/watchlist/WatchlistProvider';
import type { Ticker, OHLCData, DeveloperData, CommunityData } from '@/lib/market-data';

interface Article {
  id: string;
  title: string;
  source: string;
  sourceUrl?: string;
  url: string;
  publishedAt: string;
  imageUrl?: string;
  excerpt?: string;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  categories?: string[];
}

interface CoinPageClientProps {
  coinData: {
    id: string;
    name: string;
    symbol: string;
    image: {
      large?: string;
      small?: string;
      thumb?: string;
    };
    market_cap_rank: number | null;
    categories?: string[];
    description?: { en?: string };
    links?: {
      homepage?: string[];
      blockchain_site?: string[];
      official_forum_url?: string[];
      chat_url?: string[];
      announcement_url?: string[];
      twitter_screen_name?: string;
      facebook_username?: string;
      telegram_channel_identifier?: string;
      subreddit_url?: string;
      repos_url?: {
        github?: string[];
        bitbucket?: string[];
      };
    };
    genesis_date?: string;
    hashing_algorithm?: string;
    block_time_in_minutes?: number;
  };
  priceData: {
    price: number;
    priceInBtc?: number;
    priceInEth?: number;
    change1h?: number;
    change24h: number;
    change7d?: number;
    change14d?: number;
    change30d?: number;
    change1y?: number;
    high24h: number;
    low24h: number;
    lastUpdated?: string;
  };
  marketData: {
    marketCap: number;
    marketCapRank: number | null;
    volume24h: number;
    circulatingSupply: number;
    totalSupply: number | null;
    maxSupply: number | null;
    fdv?: number | null;
  };
  athAtlData: {
    ath: number;
    athDate: string;
    athChange: number;
    atl: number;
    atlDate: string;
    atlChange: number;
  };
  tickers: Ticker[];
  ohlcData: OHLCData[];
  developerData: DeveloperData | null;
  communityData: CommunityData | null;
  articles: Article[];
  initialTab?: CoinTab;
}

export default function CoinPageClient({
  coinData,
  priceData,
  marketData,
  athAtlData,
  tickers,
  ohlcData,
  developerData,
  communityData,
  articles,
  initialTab = 'overview',
}: CoinPageClientProps) {
  const [activeTab, setActiveTab] = useState<CoinTab>(initialTab);
  const [showAlertModal, setShowAlertModal] = useState(false);
  
  // Real watchlist integration
  const { addToWatchlist, removeFromWatchlist, isWatchlisted } = useWatchlist();
  const isInWatchlist = isWatchlisted(coinData.id);

  // Live price updates via WebSocket
  const { prices: livePrices, isConnected: isPriceLive } = useLivePrices([coinData.id]);
  const livePrice = livePrices[coinData.id]?.price ?? priceData.price;

  // Convert OHLC to chart format
  const chartData = ohlcData.map((d) => ({
    timestamp: d.timestamp,
    price: d.close,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
  }));

  const handleWatchlistToggle = useCallback(() => {
    if (isInWatchlist) {
      removeFromWatchlist(coinData.id);
    } else {
      addToWatchlist(coinData.id);
    }
  }, [isInWatchlist, coinData.id, addToWatchlist, removeFromWatchlist]);

  const handleAlertClick = useCallback(() => {
    setShowAlertModal(true);
  }, []);

  return (
    <main className="px-4 py-6 sm:py-8">
      {/* Header Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Coin Header - 2 columns on desktop */}
        <div className="lg:col-span-2">
          <CoinHeader
            coin={coinData}
            onWatchlistToggle={handleWatchlistToggle}
            onAlertClick={handleAlertClick}
            isWatchlisted={isInWatchlist}
          />
        </div>

        {/* Price Box - 1 column on desktop */}
        <div className="lg:col-span-1">
          <PriceBox
            price={livePrice}
            change24h={priceData.change24h}
            high24h={priceData.high24h}
            low24h={priceData.low24h}
            priceInBtc={priceData.priceInBtc}
            priceInEth={priceData.priceInEth}
            lastUpdated={isPriceLive ? new Date().toISOString() : priceData.lastUpdated}
            symbol={coinData.symbol}
            isLive={isPriceLive}
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <CoinTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hasMarkets={tickers.length > 0}
          hasHistorical={ohlcData.length > 0}
          marketsCount={tickers.length}
        />
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Interactive Chart */}
              {chartData.length > 0 && (
                <div className="bg-surface-alt/50 rounded-2xl border border-surface-border p-4 sm:p-6">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">
                    {coinData.symbol.toUpperCase()} Price Chart
                  </h3>
                  <PriceChart data={chartData} type="area" height={350} showGrid={true} />
                </div>
              )}

              {/* Market Stats */}
              <MarketStats
                marketCap={marketData.marketCap}
                marketCapRank={marketData.marketCapRank}
                volume24h={marketData.volume24h}
                circulatingSupply={marketData.circulatingSupply}
                totalSupply={marketData.totalSupply}
                maxSupply={marketData.maxSupply}
                fullyDilutedValuation={marketData.fdv || null}
                symbol={coinData.symbol}
              />

              {/* Price Statistics */}
              <PriceStatistics
                currentPrice={priceData.price}
                ath={athAtlData.ath}
                athDate={athAtlData.athDate}
                athChangePercentage={athAtlData.athChange}
                atl={athAtlData.atl}
                atlDate={athAtlData.atlDate}
                atlChangePercentage={athAtlData.atlChange}
                high24h={priceData.high24h}
                low24h={priceData.low24h}
                priceChange1h={priceData.change1h}
                priceChange24h={priceData.change24h}
                priceChange7d={priceData.change7d}
                priceChange14d={priceData.change14d}
                priceChange30d={priceData.change30d}
                priceChange1y={priceData.change1y}
              />

              {/* Two Column Layout: Info & Converter */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CoinInfo coin={coinData} />
                <CoinConverter
                  coinId={coinData.id}
                  symbol={coinData.symbol}
                  name={coinData.name}
                  price={priceData.price}
                  image={coinData.image?.large}
                />
              </div>

              {/* Developer & Community Stats */}
              <DeveloperStats
                developerData={developerData}
                communityData={communityData}
                coinName={coinData.name}
              />

              {/* Market Mood & Live Price Widgets */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MarketMoodSidebar />
                <LivePriceCard
                  coinId={coinData.id}
                  name={coinData.name}
                  symbol={coinData.symbol}
                  image={coinData.image?.small}
                  initialPrice={priceData.price}
                  initialChange24h={priceData.change24h}
                />
              </div>

              {/* Related News Preview */}
              {articles.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
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
                      <h3 className="text-lg font-semibold text-text-primary">
                        Latest {coinData.name} News
                      </h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('news')}
                      className="text-sm text-text-secondary hover:text-white transition-colors"
                    >
                      View all →
                    </button>
                  </div>
                  <CoinNews
                    articles={articles.slice(0, 6)}
                    coinName={coinData.name}
                    coinSymbol={coinData.symbol}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'markets' && (
            <MarketsTable tickers={tickers} coinSymbol={coinData.symbol} />
          )}

          {activeTab === 'historical' && (
            <HistoricalTable
              ohlcData={ohlcData}
              coinId={coinData.id}
              coinSymbol={coinData.symbol}
              coinName={coinData.name}
            />
          )}

          {activeTab === 'news' && (
            <CoinNews articles={articles} coinName={coinData.name} coinSymbol={coinData.symbol} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Price Alert Modal */}
      <PriceAlertModal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        coinId={coinData.id}
        coinName={coinData.name}
        coinSymbol={coinData.symbol}
        currentPrice={livePrice}
      />
    </main>
  );
}
