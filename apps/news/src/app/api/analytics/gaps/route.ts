import { NextResponse } from 'next/server';
import { getTopCoins } from '@/lib/market-data';
import { getLatestNews, type NewsArticle } from '@/lib/crypto-news';

export async function GET() {
  try {
    // Get top 100 coins by market cap
    const topCoins = await getTopCoins(100);
    const coinSymbols = topCoins.map(c => c.symbol.toUpperCase());
    
    // Get recent news
    const newsResponse = await getLatestNews(50);
    const articles = newsResponse.articles;
    
    // Extract mentioned tickers from news
    const mentionedTickers = new Set<string>();
    articles.forEach((article: NewsArticle) => {
      const text = `${article.title} ${article.description || ''}`.toUpperCase();
      coinSymbols.forEach(symbol => {
        if (text.includes(symbol) || text.includes(topCoins.find(c => c.symbol.toUpperCase() === symbol)?.name.toUpperCase() || '')) {
          mentionedTickers.add(symbol);
        }
      });
    });
    
    // Find gaps - top coins with no recent coverage
    const gaps = topCoins
      .filter(coin => !mentionedTickers.has(coin.symbol.toUpperCase()))
      .slice(0, 20)
      .map(coin => ({
        symbol: coin.symbol,
        name: coin.name,
        market_cap_rank: coin.market_cap_rank,
        market_cap: coin.market_cap,
        price_change_24h: coin.price_change_percentage_24h,
        coverage_status: 'no_recent_coverage'
      }));
    
    // Find over-covered (mentioned multiple times)
    const mentionCounts: Record<string, number> = {};
    articles.forEach((article: NewsArticle) => {
      const text = `${article.title} ${article.description || ''}`.toUpperCase();
      coinSymbols.forEach(symbol => {
        if (text.includes(symbol)) {
          mentionCounts[symbol] = (mentionCounts[symbol] || 0) + 1;
        }
      });
    });
    
    const overCovered = Object.entries(mentionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([symbol, count]) => ({
        symbol,
        mention_count: count,
        coverage_status: 'high_coverage'
      }));
    
    return NextResponse.json({
      analysis_time: new Date().toISOString(),
      total_coins_analyzed: topCoins.length,
      total_articles_analyzed: articles.length,
      coverage_gaps: gaps,
      high_coverage: overCovered,
      coverage_rate: ((mentionedTickers.size / topCoins.length) * 100).toFixed(1) + '%'
    });
  } catch (error) {
    console.error('Coverage gap analysis error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
