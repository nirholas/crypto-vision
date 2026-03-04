/**
 * Premium AI Analysis API
 *
 * High-value AI-powered endpoints that users will pay for:
 * - Sentiment analysis
 * - Trading signals
 * - Market summaries
 * - Coin comparisons
 */

import { NextRequest, NextResponse } from 'next/server';
import { PREMIUM_PRICING, getPaymentRequirements } from '@/lib/x402-config';
import { getLatestNews } from '@/lib/crypto-news';
import { getTopCoins, getCoinDetails } from '@/lib/market-data';

export const runtime = 'edge';

// AI Provider configuration (use env vars)
const AI_PROVIDER = process.env.AI_PROVIDER || 'groq'; // groq, openai, anthropic
const AI_API_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'llama-3.3-70b-versatile';

interface AIResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Call AI provider for analysis
 */
async function callAI(systemPrompt: string, userPrompt: string): Promise<AIResponse> {
  if (!AI_API_KEY) {
    return {
      success: false,
      error: 'AI not configured. Set GROQ_API_KEY or OPENAI_API_KEY.',
    };
  }

  try {
    let response: Response;

    if (AI_PROVIDER === 'groq') {
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        }),
      });
    } else {
      // OpenAI compatible
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        }),
      });
    }

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `AI API error: ${error}` };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      return { success: false, error: 'Empty AI response' };
    }

    return { success: true, data: JSON.parse(content) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AI request failed',
    };
  }
}

// =============================================================================
// SENTIMENT ANALYSIS
// =============================================================================

const SENTIMENT_SYSTEM_PROMPT = `You are an expert cryptocurrency market sentiment analyst.
Analyze news articles and return JSON with this exact structure:
{
  "articles": [
    {
      "title": "string",
      "sentiment": "very_bullish" | "bullish" | "neutral" | "bearish" | "very_bearish",
      "confidence": 0-100,
      "reasoning": "brief explanation",
      "impact": "high" | "medium" | "low",
      "affectedCoins": ["BTC", "ETH", ...]
    }
  ],
  "overall": {
    "sentiment": "bullish",
    "score": -100 to +100,
    "summary": "1-2 sentence market summary",
    "keyDrivers": ["driver1", "driver2", "driver3"]
  }
}

Be objective. High-impact = market-moving news. Consider source credibility.`;

export async function analyzeSentiment(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const asset = searchParams.get('asset')?.toUpperCase();

  try {
    // Fetch latest news
    const newsData = await getLatestNews(limit);

    if (newsData.articles.length === 0) {
      return NextResponse.json({
        articles: [],
        overall: {
          sentiment: 'neutral',
          score: 0,
          summary: 'No articles available for analysis',
          keyDrivers: [],
        },
        meta: {
          analyzedAt: new Date().toISOString(),
          articlesAnalyzed: 0,
        },
      });
    }

    const articlesForAnalysis = newsData.articles.map((a) => ({
      title: a.title,
      source: a.source,
      description: a.description?.slice(0, 200) || '',
      timeAgo: a.timeAgo,
    }));

    const userPrompt = `Analyze sentiment for these ${articlesForAnalysis.length} crypto news articles${asset ? ` (focus on ${asset})` : ''}:

${JSON.stringify(articlesForAnalysis, null, 2)}`;

    const aiResult = await callAI(SENTIMENT_SYSTEM_PROMPT, userPrompt);

    if (!aiResult.success) {
      return NextResponse.json(
        { error: 'AI analysis failed', details: aiResult.error },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ...(aiResult.data as object),
      meta: {
        analyzedAt: new Date().toISOString(),
        articlesAnalyzed: newsData.articles.length,
        model: AI_MODEL,
        endpoint: '/api/premium/ai/sentiment',
        price: PREMIUM_PRICING['/api/premium/ai/sentiment'].price,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// TRADING SIGNALS
// =============================================================================

const SIGNALS_SYSTEM_PROMPT = `You are an expert crypto technical analyst.
Analyze market data and generate trading signals. Return JSON:
{
  "signals": [
    {
      "coin": "BTC",
      "coinId": "bitcoin",
      "signal": "strong_buy" | "buy" | "hold" | "sell" | "strong_sell",
      "confidence": 0-100,
      "reasoning": "technical analysis explanation",
      "keyLevels": {
        "support": number,
        "resistance": number,
        "stopLoss": number,
        "takeProfit": number
      },
      "indicators": {
        "rsi": "oversold" | "neutral" | "overbought",
        "trend": "up" | "sideways" | "down",
        "momentum": "increasing" | "stable" | "decreasing"
      },
      "timeframe": "short" | "medium" | "long"
    }
  ],
  "marketContext": {
    "btcTrend": "up" | "sideways" | "down",
    "marketPhase": "accumulation" | "markup" | "distribution" | "markdown",
    "riskLevel": "low" | "medium" | "high"
  }
}

Base signals on price action, volume, and market structure. Be conservative.`;

export async function generateSignals(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const coins = searchParams.get('coins')?.split(',') || ['bitcoin', 'ethereum', 'solana'];
  const limit = Math.min(coins.length, 10);

  try {
    // Fetch market data for requested coins
    const topCoins = await getTopCoins(100);
    const requestedCoins = topCoins.filter((c) => coins.slice(0, limit).includes(c.id));

    if (requestedCoins.length === 0) {
      return NextResponse.json(
        { error: 'No valid coins found', validCoins: topCoins.slice(0, 10).map((c) => c.id) },
        { status: 400 }
      );
    }

    const marketData = requestedCoins.map((c) => ({
      id: c.id,
      symbol: c.symbol.toUpperCase(),
      price: c.current_price,
      change24h: c.price_change_percentage_24h,
      change7d: c.price_change_percentage_7d_in_currency,
      volume: c.total_volume,
      marketCap: c.market_cap,
      ath: c.ath,
      athChange: c.ath_change_percentage,
      sparkline: c.sparkline_in_7d?.price?.slice(-24) || [], // Last 24 hours
    }));

    const userPrompt = `Generate trading signals for these cryptocurrencies based on their market data:

${JSON.stringify(marketData, null, 2)}`;

    const aiResult = await callAI(SIGNALS_SYSTEM_PROMPT, userPrompt);

    if (!aiResult.success) {
      return NextResponse.json(
        { error: 'Signal generation failed', details: aiResult.error },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ...(aiResult.data as object),
      meta: {
        generatedAt: new Date().toISOString(),
        coinsAnalyzed: requestedCoins.length,
        model: AI_MODEL,
        endpoint: '/api/premium/ai/signals',
        price: PREMIUM_PRICING['/api/premium/ai/signals'].price,
        disclaimer: 'Not financial advice. Do your own research.',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Signal generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// MARKET SUMMARY
// =============================================================================

const SUMMARY_SYSTEM_PROMPT = `You are a crypto market analyst writing daily summaries.
Create a comprehensive but concise market summary. Return JSON:
{
  "summary": {
    "headline": "one-line market headline",
    "overview": "2-3 paragraph market overview",
    "keyEvents": ["event1", "event2", "event3"],
    "topMovers": {
      "gainers": ["coin1 +X%", "coin2 +Y%"],
      "losers": ["coin3 -X%", "coin4 -Y%"]
    },
    "outlook": {
      "shortTerm": "bullish" | "neutral" | "bearish",
      "reasoning": "brief explanation"
    }
  },
  "coinHighlight": {
    "coin": "symbol",
    "analysis": "why this coin is notable today",
    "priceAction": "description of recent moves"
  }
}

Write in professional but accessible style. Focus on actionable insights.`;

export async function generateSummary(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const coinId = searchParams.get('coin');

  try {
    // Fetch market data
    const topCoins = await getTopCoins(20);
    const newsData = await getLatestNews(10);

    let coinDetails = null;
    if (coinId) {
      coinDetails = await getCoinDetails(coinId);
    }

    const marketContext = {
      topCoins: topCoins.slice(0, 10).map((c) => ({
        id: c.id,
        symbol: c.symbol.toUpperCase(),
        price: c.current_price,
        change24h: c.price_change_percentage_24h,
        marketCap: c.market_cap,
      })),
      recentNews: newsData.articles.slice(0, 5).map((a) => ({
        title: a.title,
        source: a.source,
      })),
      focusCoin: coinDetails
        ? {
            id: coinDetails.id,
            name: coinDetails.name,
            symbol: coinDetails.symbol,
            price: coinDetails.market_data?.current_price?.usd,
            change24h: coinDetails.market_data?.price_change_percentage_24h,
            description: coinDetails.description?.en?.slice(0, 300),
          }
        : null,
    };

    const userPrompt = `Generate a market summary based on this data:

${JSON.stringify(marketContext, null, 2)}`;

    const aiResult = await callAI(SUMMARY_SYSTEM_PROMPT, userPrompt);

    if (!aiResult.success) {
      return NextResponse.json(
        { error: 'Summary generation failed', details: aiResult.error },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ...(aiResult.data as object),
      meta: {
        generatedAt: new Date().toISOString(),
        model: AI_MODEL,
        endpoint: '/api/premium/ai/summary',
        price: PREMIUM_PRICING['/api/premium/ai/summary'].price,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Summary generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// COIN COMPARISON
// =============================================================================

const COMPARE_SYSTEM_PROMPT = `You are an expert crypto investment analyst.
Compare cryptocurrencies and provide detailed analysis. Return JSON:
{
  "comparison": {
    "coins": ["BTC", "ETH"],
    "verdict": "which is better for what purpose",
    "table": {
      "technology": { "coin1": "score/10", "coin2": "score/10", "analysis": "..." },
      "adoption": { "coin1": "score/10", "coin2": "score/10", "analysis": "..." },
      "tokenomics": { "coin1": "score/10", "coin2": "score/10", "analysis": "..." },
      "risk": { "coin1": "low|medium|high", "coin2": "low|medium|high", "analysis": "..." },
      "potential": { "coin1": "score/10", "coin2": "score/10", "analysis": "..." }
    }
  },
  "recommendation": {
    "forTrading": "which coin and why",
    "forHolding": "which coin and why",
    "forBeginner": "which coin and why"
  },
  "risks": ["risk1", "risk2", "risk3"]
}

Be balanced and objective. Acknowledge both strengths and weaknesses.`;

export async function compareCoins(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const coinsParam = searchParams.get('coins');

  if (!coinsParam) {
    return NextResponse.json(
      { error: 'Missing coins parameter. Use: ?coins=bitcoin,ethereum' },
      { status: 400 }
    );
  }

  const coinIds = coinsParam.split(',').slice(0, 5); // Max 5 coins

  if (coinIds.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 coins to compare' }, { status: 400 });
  }

  try {
    // Fetch details for all coins
    const topCoins = await getTopCoins(100);
    const coinsData = topCoins.filter((c) => coinIds.includes(c.id));

    if (coinsData.length < 2) {
      return NextResponse.json(
        { error: 'Could not find enough coins', found: coinsData.map((c) => c.id) },
        { status: 400 }
      );
    }

    const comparisonData = coinsData.map((c) => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol.toUpperCase(),
      price: c.current_price,
      marketCap: c.market_cap,
      marketCapRank: c.market_cap_rank,
      volume: c.total_volume,
      change24h: c.price_change_percentage_24h,
      change7d: c.price_change_percentage_7d_in_currency,
      athChange: c.ath_change_percentage,
      circulatingSupply: c.circulating_supply,
      maxSupply: c.max_supply,
    }));

    const userPrompt = `Compare these cryptocurrencies and provide investment analysis:

${JSON.stringify(comparisonData, null, 2)}`;

    const aiResult = await callAI(COMPARE_SYSTEM_PROMPT, userPrompt);

    if (!aiResult.success) {
      return NextResponse.json(
        { error: 'Comparison failed', details: aiResult.error },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ...(aiResult.data as object),
      coinsCompared: coinsData.map((c) => ({ id: c.id, symbol: c.symbol, name: c.name })),
      meta: {
        generatedAt: new Date().toISOString(),
        model: AI_MODEL,
        endpoint: '/api/premium/ai/compare',
        price: PREMIUM_PRICING['/api/premium/ai/compare'].price,
        disclaimer: 'Not financial advice. Do your own research.',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Comparison failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Export all handlers
export const aiHandlers = {
  sentiment: analyzeSentiment,
  signals: generateSignals,
  summary: generateSummary,
  compare: compareCoins,
};
