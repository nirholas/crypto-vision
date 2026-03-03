/**
 * Dynamic Open Graph Image Generation for Coin Pages
 * Generates branded OG images with coin-specific data
 */

import { ImageResponse } from 'next/og';
import { getCoinDetails, formatPrice, formatPercent } from '@/lib/market-data';

export const runtime = 'edge';
export const alt = 'Cryptocurrency Price and Market Data';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image({ params }: { params: { coinId: string } }) {
  const { coinId } = params;
  
  // Fetch coin data for dynamic image
  let coinName = coinId;
  let coinSymbol = coinId.toUpperCase();
  let price = 0;
  let priceChange = 0;
  let marketCap = 0;
  let coinImage: string | null = null;

  try {
    const coinData = await getCoinDetails(coinId);
    if (coinData) {
      coinName = coinData.name || coinId;
      coinSymbol = coinData.symbol?.toUpperCase() || coinId.toUpperCase();
      price = coinData.market_data?.current_price?.usd || 0;
      priceChange = coinData.market_data?.price_change_percentage_24h || 0;
      marketCap = coinData.market_data?.market_cap?.usd || 0;
      coinImage = coinData.image?.large || null;
    }
  } catch {
    // Use defaults on error
  }

  const isPositive = priceChange >= 0;
  const changeColor = isPositive ? '#00d395' : '#ff4d4d';
  const changePrefix = isPositive ? '+' : '';

  const formatMarketCap = (cap: number): string => {
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
    if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
    return `$${cap.toLocaleString()}`;
  };

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Background Pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: isPositive
              ? 'radial-gradient(circle at 25% 25%, rgba(0, 211, 149, 0.1) 0%, transparent 50%)'
              : 'radial-gradient(circle at 25% 25%, rgba(255, 77, 77, 0.1) 0%, transparent 50%)',
          }}
        />

        {/* Coin Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 30,
          }}
        >
          {/* Coin Image Placeholder */}
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              background: 'linear-gradient(135deg, #f7931a 0%, #ff6b35 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 48,
              marginRight: 24,
              color: 'white',
              fontWeight: 700,
            }}
          >
            {coinSymbol.slice(0, 2)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 52,
                fontWeight: 800,
                color: 'white',
                letterSpacing: '-1px',
              }}
            >
              {coinName}
            </div>
            <div
              style={{
                fontSize: 28,
                color: 'rgba(255, 255, 255, 0.6)',
              }}
            >
              {coinSymbol}
            </div>
          </div>
        </div>

        {/* Price */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: 'white',
            marginBottom: 16,
          }}
        >
          {formatPrice(price)}
        </div>

        {/* Price Change */}
        <div
          style={{
            fontSize: 36,
            fontWeight: 600,
            color: changeColor,
            marginBottom: 40,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {changePrefix}{priceChange.toFixed(2)}% (24h)
        </div>

        {/* Stats Row */}
        <div
          style={{
            display: 'flex',
            gap: 80,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 32, fontWeight: 700, color: 'white' }}>
              {formatMarketCap(marketCap)}
            </div>
            <div style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.5)' }}>Market Cap</div>
          </div>
        </div>

        {/* Branding */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #f7931a 0%, #ff6b35 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}
          >
            ₿
          </div>
          <div
            style={{
              fontSize: 18,
              color: 'rgba(255, 255, 255, 0.4)',
            }}
          >
            Crypto Data Aggregator
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
