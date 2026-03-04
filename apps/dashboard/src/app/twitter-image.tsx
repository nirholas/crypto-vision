/**
 * Dynamic Twitter Image Generation
 * Generates branded Twitter card images for better social media sharing
 */

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Crypto Data Aggregator - Real-time Market Data';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
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
            backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(247, 147, 26, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(98, 126, 234, 0.1) 0%, transparent 50%)',
          }}
        />

        {/* Logo/Icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #f7931a 0%, #ff6b35 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 48,
              marginRight: 20,
            }}
          >
            ₿
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: 'white',
              letterSpacing: '-2px',
            }}
          >
            Crypto Data Aggregator
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: 'rgba(255, 255, 255, 0.8)',
            marginBottom: 50,
            textAlign: 'center',
            maxWidth: 800,
          }}
        >
          Real-time cryptocurrency market data, DeFi analytics, and portfolio tracking
        </div>

        {/* Stats Row */}
        <div
          style={{
            display: 'flex',
            gap: 60,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 42, fontWeight: 700, color: '#f7931a' }}>10,000+</div>
            <div style={{ fontSize: 18, color: 'rgba(255, 255, 255, 0.6)' }}>Coins Tracked</div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 42, fontWeight: 700, color: '#627eea' }}>200+</div>
            <div style={{ fontSize: 18, color: 'rgba(255, 255, 255, 0.6)' }}>DeFi Protocols</div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 42, fontWeight: 700, color: '#00d395' }}>Free API</div>
            <div style={{ fontSize: 18, color: 'rgba(255, 255, 255, 0.6)' }}>No API Key</div>
          </div>
        </div>

        {/* URL */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            fontSize: 20,
            color: 'rgba(255, 255, 255, 0.4)',
          }}
        >
          crypto-data-aggregator.vercel.app
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
