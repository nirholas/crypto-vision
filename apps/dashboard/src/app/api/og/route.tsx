/**
 * Dynamic OG Image Generator
 * Generates beautiful, shareable social images for all page types
 * Designed for viral sharing with clean, eye-catching design
 * 
 * Supports:
 * - Articles with sentiment badges
 * - Coins with price and 24h change
 * - Generic pages with custom styling
 * - Market data with live indicators
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const sourceColors: Record<string, string> = {
  'CoinDesk': '#1d4ed8',
  'The Block': '#7c3aed',
  'Decrypt': '#059669',
  'CoinTelegraph': '#d97706',
  'Bitcoin Magazine': '#b45309',
  'Blockworks': '#4f46e5',
  'The Defiant': '#db2777',
};

// Sentiment styling
const sentimentStyles: Record<string, { color: string; bg: string; emoji: string; label: string }> = {
  bullish: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', emoji: '🟢', label: 'Bullish' },
  very_bullish: { color: '#16a34a', bg: 'rgba(22, 163, 74, 0.2)', emoji: '🚀', label: 'Very Bullish' },
  bearish: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', emoji: '🔴', label: 'Bearish' },
  very_bearish: { color: '#dc2626', bg: 'rgba(220, 38, 38, 0.2)', emoji: '📉', label: 'Very Bearish' },
  neutral: { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', emoji: '⚪', label: 'Neutral' },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Core params
  const title = searchParams.get('title') || 'CryptoNews';
  const subtitle = searchParams.get('subtitle') || '';
  const type = searchParams.get('type') || 'article'; // article, coin, page, market
  
  // Article params
  const source = searchParams.get('source') || '';
  const date = searchParams.get('date') || '';
  const sentiment = searchParams.get('sentiment') || '';
  const category = searchParams.get('category') || '';
  
  // Coin params
  const ticker = searchParams.get('ticker') || '';
  const price = searchParams.get('price') || '';
  const change = searchParams.get('change') || '';
  const marketCap = searchParams.get('marketCap') || '';
  
  // Market params
  const btcPrice = searchParams.get('btcPrice') || '';
  const fearGreed = searchParams.get('fearGreed') || '';
  
  // Style params
  const theme = searchParams.get('theme') || 'dark';
  
  const sourceColor = sourceColors[source] || '#64748b';
  const sentimentStyle = sentimentStyles[sentiment] || null;
  const changeNum = change ? parseFloat(change) : 0;
  const isPositive = changeNum >= 0;
  
  // Truncate text for display
  const displayTitle = title.length > 90 ? title.slice(0, 87) + '...' : title;
  const displaySubtitle = subtitle.length > 120 ? subtitle.slice(0, 117) + '...' : subtitle;

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0f172a',
          padding: '50px 60px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Background gradient - varies by type */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: type === 'coin' 
              ? 'radial-gradient(ellipse at 0% 0%, rgba(139, 92, 246, 0.2) 0%, transparent 50%), radial-gradient(ellipse at 100% 100%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)'
              : type === 'market'
              ? 'radial-gradient(ellipse at 50% 0%, rgba(34, 197, 94, 0.15) 0%, transparent 40%), radial-gradient(ellipse at 100% 100%, rgba(239, 68, 68, 0.1) 0%, transparent 40%)'
              : 'radial-gradient(ellipse at 20% 20%, rgba(247, 147, 26, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)',
          }}
        />
        
        {/* Content container */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, zIndex: 1 }}>
          
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
            {/* Logo and brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                }}
              >
                📰
              </div>
              <span style={{ color: '#f1f5f9', fontSize: '22px', fontWeight: 700, letterSpacing: '-0.3px' }}>
                CryptoNews
              </span>
            </div>
            
            {/* Right side badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Ticker for coins */}
              {type === 'coin' && ticker && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '25px',
                    fontSize: '20px',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                  }}
                >
                  ${ticker.toUpperCase()}
                </div>
              )}
              
              {/* Category for articles */}
              {type === 'article' && category && (
                <div
                  style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '16px',
                    fontWeight: 600,
                  }}
                >
                  {category}
                </div>
              )}
            </div>
          </div>
          
          {/* Source and date row for articles */}
          {type === 'article' && source && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <span
                style={{
                  backgroundColor: sourceColor,
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 600,
                }}
              >
                {source}
              </span>
              {date && (
                <span style={{ color: '#64748b', fontSize: '16px' }}>
                  {date}
                </span>
              )}
              {/* Sentiment badge */}
              {sentimentStyle && (
                <div
                  style={{
                    background: sentimentStyle.bg,
                    color: sentimentStyle.color,
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '16px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{sentimentStyle.emoji}</span>
                  <span>{sentimentStyle.label}</span>
                </div>
              )}
            </div>
          )}
          
          {/* Main title */}
          <h1
            style={{
              color: '#f1f5f9',
              fontSize: type === 'coin' ? '64px' : displayTitle.length > 60 ? '44px' : '52px',
              fontWeight: 800,
              lineHeight: 1.15,
              margin: 0,
              letterSpacing: '-1px',
              flex: type === 'coin' ? 0 : 1,
              display: 'flex',
              alignItems: type === 'coin' ? 'flex-start' : 'center',
              marginTop: type === 'coin' ? '20px' : 0,
            }}
          >
            {displayTitle}
          </h1>
          
          {/* Subtitle for pages */}
          {displaySubtitle && type === 'page' && (
            <p style={{ color: '#94a3b8', fontSize: '26px', marginTop: '20px', lineHeight: 1.4 }}>
              {displaySubtitle}
            </p>
          )}
          
          {/* Price display for coins */}
          {type === 'coin' && price && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginTop: '24px' }}>
              <span style={{ fontSize: '56px', fontWeight: 700, color: '#ffffff' }}>
                {price}
              </span>
              {change && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: isPositive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    padding: '12px 20px',
                    borderRadius: '12px',
                  }}
                >
                  <span style={{ fontSize: '32px', color: isPositive ? '#22c55e' : '#ef4444' }}>
                    {isPositive ? '↑' : '↓'}
                  </span>
                  <span style={{ fontSize: '32px', fontWeight: 600, color: isPositive ? '#22c55e' : '#ef4444' }}>
                    {Math.abs(changeNum).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          )}
          
          {/* Market cap for coins */}
          {type === 'coin' && marketCap && (
            <div style={{ display: 'flex', marginTop: '16px' }}>
              <span style={{ color: '#64748b', fontSize: '22px' }}>
                Market Cap: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{marketCap}</span>
              </span>
            </div>
          )}
          
          {/* Market overview stats */}
          {type === 'market' && (
            <div style={{ display: 'flex', gap: '40px', marginTop: '30px' }}>
              {btcPrice && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: '#64748b', fontSize: '18px' }}>Bitcoin</span>
                  <span style={{ color: '#f59e0b', fontSize: '36px', fontWeight: 700 }}>{btcPrice}</span>
                </div>
              )}
              {fearGreed && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: '#64748b', fontSize: '18px' }}>Fear & Greed</span>
                  <span style={{ color: parseInt(fearGreed) > 50 ? '#22c55e' : '#ef4444', fontSize: '36px', fontWeight: 700 }}>
                    {fearGreed}/100
                  </span>
                </div>
              )}
            </div>
          )}
          
          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid #1e293b' }}>
            <span style={{ color: '#475569', fontSize: '18px' }}>
              cryptonews.example.com
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Live indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    background: '#22c55e',
                    borderRadius: '50%',
                    boxShadow: '0 0 10px #22c55e',
                  }}
                />
                <span style={{ color: '#22c55e', fontSize: '16px', fontWeight: 500 }}>LIVE</span>
              </div>
              <span style={{ color: '#475569', fontSize: '16px' }}>50+ Sources</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
