import { NextRequest, NextResponse } from 'next/server';
import {
  queryArchiveV2,
  getArchiveV2Stats,
  getArticlesByTicker,
  getTrendingTickers,
  getMarketHistory,
  toNewsArticle,
  EnrichedArticle
} from '@/lib/archive-v2';
import { translateArticles, isLanguageSupported, SUPPORTED_LANGUAGES } from '@/lib/translate';

export const runtime = 'edge';

/**
 * GET /api/archive/v2 - Query enriched historical news archive
 * 
 * Query Parameters:
 * - start_date: Start date (YYYY-MM-DD)
 * - end_date: End date (YYYY-MM-DD)
 * - source: Filter by source name
 * - ticker: Filter by cryptocurrency ticker (BTC, ETH, etc.)
 * - q: Search query
 * - sentiment: Filter by sentiment (positive, negative, neutral)
 * - tags: Filter by tags (comma-separated)
 * - limit: Max results (default 50, max 200)
 * - offset: Pagination offset
 * - format: Response format (full, simple, minimal)
 * - stats: If "true", return archive statistics only
 * - trending: If "true", return trending tickers
 * - market: If "YYYY-MM", return market history for that month
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Check for stats-only request
    if (searchParams.get('stats') === 'true') {
      const stats = await getArchiveV2Stats();
      
      if (!stats) {
        return NextResponse.json({
          success: false,
          error: 'Archive V2 not available',
          message: 'Enhanced archive has not been initialized yet. Try /api/archive for v1.'
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        version: '2.0.0',
        stats
      });
    }
    
    // Check for trending tickers request
    if (searchParams.get('trending') === 'true') {
      const hours = parseInt(searchParams.get('hours') || '24');
      const trending = await getTrendingTickers(Math.min(hours, 72));
      
      return NextResponse.json({
        success: true,
        hours,
        tickers: trending
      });
    }
    
    // Check for market history request
    const marketMonth = searchParams.get('market');
    if (marketMonth) {
      const history = await getMarketHistory(marketMonth);
      
      return NextResponse.json({
        success: true,
        month: marketMonth,
        data_points: history.length,
        history
      });
    }
    
    // Parse query parameters
    const startDate = searchParams.get('start_date') || undefined;
    const endDate = searchParams.get('end_date') || undefined;
    const source = searchParams.get('source') || undefined;
    const ticker = searchParams.get('ticker') || undefined;
    const search = searchParams.get('q') || undefined;
    const sentiment = searchParams.get('sentiment') as 'positive' | 'negative' | 'neutral' | undefined;
    const tagsParam = searchParams.get('tags');
    const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()) : undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');
    const format = searchParams.get('format') || 'full';
    const lang = searchParams.get('lang') || 'en';
    
    // Validate language parameter
    if (lang !== 'en' && !isLanguageSupported(lang)) {
      return NextResponse.json({
        success: false,
        error: 'Unsupported language',
        message: `Language '${lang}' is not supported`,
        supported: Object.keys(SUPPORTED_LANGUAGES)
      }, { status: 400 });
    }
    
    // Validate date formats
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid start_date format',
        message: 'Use YYYY-MM-DD format'
      }, { status: 400 });
    }
    if (endDate && !dateRegex.test(endDate)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid end_date format',
        message: 'Use YYYY-MM-DD format'
      }, { status: 400 });
    }
    
    // Validate sentiment
    if (sentiment && !['positive', 'negative', 'neutral'].includes(sentiment)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid sentiment value',
        message: 'Use positive, negative, or neutral'
      }, { status: 400 });
    }
    
    // Query archive
    const result = await queryArchiveV2({
      startDate,
      endDate,
      source,
      ticker,
      search,
      sentiment,
      tags,
      limit,
      offset
    });
    
    // Format response based on requested format
    let articles: unknown[];
    
    switch (format) {
      case 'minimal':
        // Just IDs and titles
        articles = result.articles.map(a => ({
          id: a.id,
          title: a.title,
          source: a.source,
          first_seen: a.first_seen,
          tickers: a.tickers,
          sentiment: a.sentiment.label
        }));
        break;
        
      case 'simple':
        // Backwards-compatible format
        articles = result.articles.map(a => toNewsArticle(a));
        break;
        
      case 'full':
      default:
        // Full enriched articles
        articles = result.articles;
        break;
    }
    
    // Translate articles if language is not English
    let translatedLang = 'en';
    
    if (lang !== 'en' && articles.length > 0) {
      try {
        articles = await translateArticles(articles as any, lang);
        translatedLang = lang;
      } catch (translateError) {
        console.error('Translation failed:', translateError);
        // Continue with original articles on translation failure
      }
    }
    
    return NextResponse.json({
      success: true,
      version: '2.0.0',
      count: articles.length,
      total: result.total,
      pagination: result.pagination,
      lang: translatedLang,
      availableLanguages: Object.keys(SUPPORTED_LANGUAGES),
      filters: {
        start_date: startDate || null,
        end_date: endDate || null,
        source: source || null,
        ticker: ticker || null,
        search: search || null,
        sentiment: sentiment || null,
        tags: tags || null
      },
      format,
      articles
    });
    
  } catch (error) {
    console.error('Archive V2 API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to query archive',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
