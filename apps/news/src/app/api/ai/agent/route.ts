/**
 * AI Market Intelligence Agent API
 * 
 * Revolutionary market analysis endpoint providing:
 * - Real-time market intelligence synthesis
 * - Natural language query interface
 * - Multi-source signal aggregation
 * - Actionable trading insights
 * 
 * @endpoint GET /api/ai/agent - Get market intelligence
 * @endpoint POST /api/ai/agent - Query the AI agent
 */

import { type NextRequest, NextResponse } from 'next/server';
import { 
  generateMarketIntelligence, 
  queryMarketAgent,
  type AgentQuery,
  type MarketIntelligence,
  type AgentResponse,
} from '@/lib/ai-market-agent';

export const runtime = 'edge';
export const revalidate = 60;

/**
 * GET /api/ai/agent
 * 
 * Returns comprehensive market intelligence with signals, opportunities, and risks.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'full';
    
    const intelligence = await generateMarketIntelligence();
    
    // Format options
    if (format === 'summary') {
      return NextResponse.json({
        success: true,
        data: {
          regime: intelligence.overallRegime,
          regimeConfidence: intelligence.regimeConfidence,
          fearGreedIndex: intelligence.fearGreedIndex,
          volatility: intelligence.volatilityRegime,
          dominantNarrative: intelligence.dominantNarrative,
          signalCount: intelligence.activeSignals.length,
          opportunityCount: intelligence.topOpportunities.length,
          riskAlertCount: intelligence.riskAlerts.length,
          narrative: intelligence.marketNarrative,
          generatedAt: intelligence.generatedAt,
        },
      });
    }
    
    if (format === 'signals') {
      return NextResponse.json({
        success: true,
        data: {
          signals: intelligence.activeSignals,
          generatedAt: intelligence.generatedAt,
        },
      });
    }
    
    if (format === 'opportunities') {
      return NextResponse.json({
        success: true,
        data: {
          opportunities: intelligence.topOpportunities,
          generatedAt: intelligence.generatedAt,
        },
      });
    }
    
    if (format === 'risks') {
      return NextResponse.json({
        success: true,
        data: {
          riskAlerts: intelligence.riskAlerts,
          correlationAnomalies: intelligence.correlationAnomalies,
          generatedAt: intelligence.generatedAt,
        },
      });
    }
    
    // Full format
    return NextResponse.json({
      success: true,
      data: intelligence,
    });
    
  } catch (error) {
    console.error('[AI Agent] Error generating intelligence:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate market intelligence',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/agent
 * 
 * Query the AI agent with natural language questions.
 * 
 * @body { question: string, assets?: string[], timeHorizon?: string, focusAreas?: string[] }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    if (!body.question || typeof body.question !== 'string') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required field: question',
        },
        { status: 400 }
      );
    }
    
    const query: AgentQuery = {
      question: body.question,
      assets: body.assets,
      timeHorizon: body.timeHorizon,
      focusAreas: body.focusAreas,
    };
    
    const response = await queryMarketAgent(query);
    
    return NextResponse.json({
      success: true,
      data: response,
    });
    
  } catch (error) {
    console.error('[AI Agent] Error processing query:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process query',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
