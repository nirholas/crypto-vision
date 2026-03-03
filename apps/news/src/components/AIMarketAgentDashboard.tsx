'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  type MarketIntelligence, 
  type MarketSignal, 
  type TradingOpportunity, 
  type RiskAlert,
  type AgentResponse,
  type MarketRegime,
} from '@/lib/ai-market-agent';

// =============================================================================
// Types
// =============================================================================

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  signals?: MarketSignal[];
  actions?: string[];
}

// =============================================================================
// Helper Components
// =============================================================================

const RegimeBadge: React.FC<{ regime: MarketRegime; confidence: number }> = ({ regime, confidence }) => {
  const colors: Record<MarketRegime, string> = {
    accumulation: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    markup: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    distribution: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    markdown: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    ranging: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
    capitulation: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    euphoria: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  };
  
  const icons: Record<MarketRegime, string> = {
    accumulation: '📦',
    markup: '🚀',
    distribution: '📤',
    markdown: '📉',
    ranging: '↔️',
    capitulation: '😱',
    euphoria: '🎉',
  };
  
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-medium ${colors[regime]}`}>
      <span>{icons[regime]}</span>
      <span className="capitalize">{regime}</span>
      <span className="text-xs opacity-75">({confidence}%)</span>
    </div>
  );
};

const FearGreedGauge: React.FC<{ value: number }> = ({ value }) => {
  const getColor = (v: number) => {
    if (v <= 20) return 'bg-red-500';
    if (v <= 40) return 'bg-orange-500';
    if (v <= 60) return 'bg-yellow-500';
    if (v <= 80) return 'bg-lime-500';
    return 'bg-green-500';
  };
  
  const getLabel = (v: number) => {
    if (v <= 20) return 'Extreme Fear';
    if (v <= 40) return 'Fear';
    if (v <= 60) return 'Neutral';
    if (v <= 80) return 'Greed';
    return 'Extreme Greed';
  };
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-slate-400">Fear & Greed</span>
        <span className="font-bold text-gray-900 dark:text-white">{value}</span>
      </div>
      <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${getColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <div className="text-center text-sm font-medium text-gray-700 dark:text-slate-300">
        {getLabel(value)}
      </div>
    </div>
  );
};

const SignalCard: React.FC<{ signal: MarketSignal }> = ({ signal }) => {
  const directionColors = {
    bullish: 'border-green-400 bg-green-50 dark:bg-green-900/20',
    bearish: 'border-red-400 bg-red-50 dark:bg-red-900/20',
    neutral: 'border-gray-400 bg-gray-50 dark:bg-gray-700/20',
  };
  
  const strengthBadges = {
    weak: 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200',
    moderate: 'bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-200',
    strong: 'bg-purple-200 text-purple-700 dark:bg-purple-800 dark:text-purple-200',
    extreme: 'bg-red-200 text-red-700 dark:bg-red-800 dark:text-red-200',
  };
  
  const sourceIcons: Record<string, string> = {
    news: '📰',
    social: '💬',
    'on-chain': '⛓️',
    technical: '📊',
    derivatives: '📈',
    whale: '🐋',
    regulatory: '⚖️',
    'smart-money': '🎯',
    narrative: '📝',
    'cross-correlation': '🔗',
  };
  
  return (
    <div className={`border-l-4 rounded-r-lg p-4 ${directionColors[signal.direction]}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{sourceIcons[signal.source] || '📡'}</span>
          <span className="font-semibold text-gray-900 dark:text-white">{signal.asset}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${strengthBadges[signal.strength]}`}>
            {signal.strength}
          </span>
        </div>
        <span className="text-xs text-gray-500 dark:text-slate-400">
          {signal.confidence}% conf
        </span>
      </div>
      <p className="text-sm text-gray-700 dark:text-slate-300">{signal.narrative}</p>
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-slate-500">
        <span>Source: {signal.source}</span>
        <span>Horizon: {signal.timeHorizon}</span>
      </div>
    </div>
  );
};

const OpportunityCard: React.FC<{ opportunity: TradingOpportunity }> = ({ opportunity }) => {
  const typeColors = {
    long: 'bg-green-500',
    short: 'bg-red-500',
    arbitrage: 'bg-purple-500',
    yield: 'bg-blue-500',
    hedge: 'bg-orange-500',
  };
  
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs font-bold text-white uppercase ${typeColors[opportunity.type]}`}>
            {opportunity.type}
          </span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">{opportunity.asset}</span>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-green-600 dark:text-green-400">
            {opportunity.confidence}% conf
          </div>
          <div className="text-xs text-gray-500">R:R {opportunity.riskReward}:1</div>
        </div>
      </div>
      
      <p className="text-sm text-gray-600 dark:text-slate-300 mb-3">{opportunity.rationale}</p>
      
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="bg-gray-100 dark:bg-slate-700 rounded p-2">
          <div className="text-xs text-gray-500 dark:text-slate-400">Entry</div>
          <div className="font-semibold text-gray-900 dark:text-white">
            ${opportunity.entry.toLocaleString()}
          </div>
        </div>
        <div className="bg-green-100 dark:bg-green-900/30 rounded p-2">
          <div className="text-xs text-green-600 dark:text-green-400">Targets</div>
          <div className="font-semibold text-green-700 dark:text-green-300">
            ${opportunity.targets[0]?.toLocaleString()}
          </div>
        </div>
        <div className="bg-red-100 dark:bg-red-900/30 rounded p-2">
          <div className="text-xs text-red-600 dark:text-red-400">Stop</div>
          <div className="font-semibold text-red-700 dark:text-red-300">
            ${opportunity.stopLoss.toLocaleString()}
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-1 mt-3">
        {opportunity.signalSources.map(source => (
          <span key={source} className="px-2 py-0.5 bg-gray-200 dark:bg-slate-600 rounded text-xs">
            {source}
          </span>
        ))}
      </div>
    </div>
  );
};

const RiskAlertCard: React.FC<{ alert: RiskAlert }> = ({ alert }) => {
  const severityColors = {
    info: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20',
    warning: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
    danger: 'border-orange-400 bg-orange-50 dark:bg-orange-900/20',
    critical: 'border-red-400 bg-red-50 dark:bg-red-900/20',
  };
  
  const severityIcons = {
    info: 'ℹ️',
    warning: '⚠️',
    danger: '🔶',
    critical: '🚨',
  };
  
  return (
    <div className={`border-l-4 rounded-r-lg p-4 ${severityColors[alert.severity]}`}>
      <div className="flex items-start gap-2 mb-2">
        <span className="text-lg">{severityIcons[alert.severity]}</span>
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white">{alert.title}</h4>
          <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">{alert.description}</p>
        </div>
      </div>
      <div className="mt-3 p-2 bg-white/50 dark:bg-slate-800/50 rounded">
        <span className="text-xs text-gray-500 dark:text-slate-400">Recommendation:</span>
        <p className="text-sm font-medium text-gray-700 dark:text-slate-200">{alert.recommendation}</p>
      </div>
    </div>
  );
};

// =============================================================================
// Main Dashboard Component
// =============================================================================

export function AIMarketAgentDashboard() {
  const [intelligence, setIntelligence] = useState<MarketIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'signals' | 'opportunities' | 'risks' | 'chat'>('overview');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Fetch intelligence
  const fetchIntelligence = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ai/agent');
      const data = await response.json();
      
      if (data.success) {
        setIntelligence(data.data);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch intelligence');
      }
    } catch (err) {
      setError('Network error - please try again');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchIntelligence();
    const interval = setInterval(fetchIntelligence, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchIntelligence]);
  
  // Chat functionality
  const sendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);
    
    try {
      const response = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage.content }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        const agentResponse = data.data as AgentResponse;
        const agentMessage: ChatMessage = {
          id: `agent-${Date.now()}`,
          role: 'agent',
          content: agentResponse.answer,
          timestamp: new Date(),
          signals: agentResponse.supportingSignals,
          actions: agentResponse.suggestedActions,
        };
        setChatMessages(prev => [...prev, agentMessage]);
      } else {
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'agent',
          content: 'Sorry, I encountered an error processing your request. Please try again.',
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, errorMessage]);
      }
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'agent',
        content: 'Network error. Please check your connection and try again.',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  
  // Quick questions
  const quickQuestions = [
    "What's happening in the market?",
    "Should I buy BTC?",
    "What are the current risks?",
    "Show me trading opportunities",
    "What is smart money doing?",
  ];
  
  if (loading && !intelligence) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600 dark:text-slate-400">Synthesizing market intelligence...</p>
        </div>
      </div>
    );
  }
  
  if (error && !intelligence) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <span className="text-3xl mb-2 block">❌</span>
        <p className="text-red-800 dark:text-red-200">{error}</p>
        <button 
          onClick={fetchIntelligence}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }
  
  if (!intelligence) return null;
  
  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span>🤖</span> AI Market Intelligence
            </h2>
            <p className="text-purple-200 text-sm mt-1">
              Real-time synthesis of news, social, on-chain & derivatives data
            </p>
          </div>
          <RegimeBadge regime={intelligence.overallRegime} confidence={intelligence.regimeConfidence} />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-white/10 rounded-xl p-4">
            <FearGreedGauge value={intelligence.fearGreedIndex} />
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-sm text-purple-200">Volatility</div>
            <div className="text-2xl font-bold capitalize">{intelligence.volatilityRegime}</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-sm text-purple-200">Active Signals</div>
            <div className="text-2xl font-bold">{intelligence.activeSignals.length}</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-sm text-purple-200">Opportunities</div>
            <div className="text-2xl font-bold">{intelligence.topOpportunities.length}</div>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-white/10 rounded-xl">
          <div className="text-sm text-purple-200 mb-1">Dominant Narrative</div>
          <div className="text-lg font-semibold">{intelligence.dominantNarrative}</div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['overview', 'signals', 'opportunities', 'risks', 'chat'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
              activeTab === tab
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            {tab === 'chat' && '💬 '}
            {tab === 'overview' && '📊 '}
            {tab === 'signals' && '📡 '}
            {tab === 'opportunities' && '🎯 '}
            {tab === 'risks' && '⚠️ '}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Market Narrative */}
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>📝</span> Market Narrative
            </h3>
            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-slate-300 whitespace-pre-wrap">
              {intelligence.marketNarrative}
            </div>
          </div>
          
          {/* Sector Rotation */}
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>🔄</span> Sector Rotation
            </h3>
            <div className="space-y-3">
              {intelligence.sectorRotation.map(sector => (
                <div key={sector.sector} className="flex items-center gap-4">
                  <div className="w-32 font-medium text-gray-900 dark:text-white">{sector.sector}</div>
                  <div className="flex-1 h-6 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden relative">
                    <div 
                      className={`absolute h-full transition-all ${
                        sector.magnitude > 0 ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{ 
                        width: `${Math.abs(sector.magnitude)}%`,
                        left: sector.magnitude > 0 ? '50%' : `${50 - Math.abs(sector.magnitude)}%`,
                      }}
                    />
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-400" />
                  </div>
                  <div className={`w-16 text-right font-bold ${
                    sector.magnitude > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {sector.magnitude > 0 ? '+' : ''}{sector.magnitude.toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Upcoming Catalysts */}
          {intelligence.upcomingCatalysts.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span>📅</span> Upcoming Catalysts
              </h3>
              <div className="space-y-3">
                {intelligence.upcomingCatalysts.map(catalyst => (
                  <div 
                    key={catalyst.id}
                    className="flex items-start gap-4 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg"
                  >
                    <div className="text-2xl">
                      {catalyst.type === 'macro' ? '🏛️' : 
                       catalyst.type === 'upgrade' ? '⬆️' :
                       catalyst.type === 'regulatory' ? '⚖️' :
                       catalyst.type === 'governance' ? '🗳️' : '📌'}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 dark:text-white">{catalyst.title}</div>
                      <div className="text-sm text-gray-600 dark:text-slate-300">{catalyst.description}</div>
                      <div className="flex gap-2 mt-2">
                        {catalyst.assets.map(asset => (
                          <span key={asset} className="px-2 py-0.5 bg-gray-200 dark:bg-slate-600 rounded text-xs">
                            {asset}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {new Date(catalyst.expectedDate).toLocaleDateString()}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        catalyst.potentialImpact === 'high' || catalyst.potentialImpact === 'extreme'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}>
                        {catalyst.potentialImpact} impact
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'signals' && (
        <div className="space-y-4">
          {intelligence.activeSignals.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-slate-400">
              No active signals detected
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {intelligence.activeSignals.map(signal => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'opportunities' && (
        <div className="space-y-4">
          {intelligence.topOpportunities.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-slate-400">
              No high-conviction opportunities detected currently
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {intelligence.topOpportunities.map(opp => (
                <OpportunityCard key={opp.id} opportunity={opp} />
              ))}
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'risks' && (
        <div className="space-y-4">
          {intelligence.riskAlerts.length === 0 ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
              <span className="text-3xl mb-2 block">✅</span>
              <p className="text-green-800 dark:text-green-200">No major risks detected</p>
            </div>
          ) : (
            intelligence.riskAlerts.map(alert => (
              <RiskAlertCard key={alert.id} alert={alert} />
            ))
          )}
          
          {/* Correlation Anomalies */}
          {intelligence.correlationAnomalies.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                🔗 Correlation Anomalies
              </h3>
              <div className="space-y-3">
                {intelligence.correlationAnomalies.map((anomaly, i) => (
                  <div key={i} className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{anomaly.asset1}/{anomaly.asset2}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        anomaly.significance === 'high' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {anomaly.significance} significance
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-slate-300">
                      Expected: {(anomaly.expectedCorrelation * 100).toFixed(0)}% | 
                      Actual: {(anomaly.actualCorrelation * 100).toFixed(0)}%
                    </div>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{anomaly.interpretation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'chat' && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          {/* Chat Header */}
          <div className="border-b border-gray-200 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-750">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>💬</span> Ask the AI Agent
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Natural language interface for market insights
            </p>
          </div>
          
          {/* Quick Questions */}
          {chatMessages.length === 0 && (
            <div className="p-4 border-b border-gray-200 dark:border-slate-700">
              <div className="text-sm text-gray-600 dark:text-slate-400 mb-2">Quick questions:</div>
              <div className="flex flex-wrap gap-2">
                {quickQuestions.map(q => (
                  <button
                    key={q}
                    onClick={() => {
                      setChatInput(q);
                      setTimeout(() => sendMessage(), 0);
                    }}
                    className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm hover:bg-purple-200 dark:hover:bg-purple-900/50 transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Chat Messages */}
          <div className="h-96 overflow-y-auto p-4 space-y-4">
            {chatMessages.map(msg => (
              <div 
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-2xl p-4 ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white rounded-br-none'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white rounded-bl-none'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/20">
                      <div className="text-xs opacity-75 mb-1">Suggested Actions:</div>
                      <ul className="text-sm space-y-1">
                        {msg.actions.map((action, i) => (
                          <li key={i}>• {action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="text-xs opacity-60 mt-2">
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-slate-700 rounded-2xl rounded-bl-none p-4">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>
          
          {/* Chat Input */}
          <div className="border-t border-gray-200 dark:border-slate-700 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about markets, signals, opportunities..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={chatLoading}
              />
              <button
                onClick={sendMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="px-6 py-2 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Last Updated */}
      <div className="text-center text-sm text-gray-500 dark:text-slate-500">
        Last updated: {new Date(intelligence.generatedAt).toLocaleString()}
        <button 
          onClick={fetchIntelligence}
          className="ml-2 text-purple-600 dark:text-purple-400 hover:underline"
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}

export default AIMarketAgentDashboard;
