/**
 * Token Unlock & Vesting Schedule Calculator
 * 
 * Core calculation logic for vesting schedules, unlock events,
 * and market impact analysis.
 */

import type {
  VestingSchedule,
  UnlockEvent,
  TokenProject,
  MarketImpactAnalysis,
  VestingStatistics,
} from './types.js';

/**
 * Calculate all unlock events from a vesting schedule
 */
export function calculateUnlockEvents(schedule: VestingSchedule): UnlockEvent[] {
  const events: UnlockEvent[] = [];
  const now = new Date();
  
  // Initial unlock at TGE (if any)
  if (parseFloat(schedule.initialUnlock) > 0) {
    const initialEvent: UnlockEvent = {
      id: `${schedule.id}-initial`,
      projectId: schedule.projectId,
      scheduleId: schedule.id,
      date: schedule.vestingStart,
      tokensUnlocked: schedule.initialUnlock,
      percentageOfTotal: (parseFloat(schedule.initialUnlock) / parseFloat(schedule.totalTokens)) * 100,
      percentageOfCirculating: 0, // calculated separately with project data
      beneficiaryType: schedule.beneficiaryType,
      isCliffEvent: false,
    };
    events.push(initialEvent);
  }

  // Cliff unlock (if applicable)
  if (schedule.cliffDuration > 0 && schedule.cliffEnd) {
    const cliffTokens = calculateCliffUnlock(schedule);
    if (parseFloat(cliffTokens) > 0) {
      const cliffEvent: UnlockEvent = {
        id: `${schedule.id}-cliff`,
        projectId: schedule.projectId,
        scheduleId: schedule.id,
        date: schedule.cliffEnd,
        tokensUnlocked: cliffTokens,
        percentageOfTotal: (parseFloat(cliffTokens) / parseFloat(schedule.totalTokens)) * 100,
        percentageOfCirculating: 0,
        beneficiaryType: schedule.beneficiaryType,
        isCliffEvent: true,
      };
      events.push(cliffEvent);
    }
  }

  // Linear vesting events
  if (schedule.linearVesting) {
    const linearEvents = calculateLinearVestingEvents(schedule);
    events.push(...linearEvents);
  }

  return events.filter(event => event.date >= now);
}

/**
 * Calculate tokens unlocked at cliff
 */
function calculateCliffUnlock(schedule: VestingSchedule): string {
  const totalTokens = parseFloat(schedule.totalTokens);
  const initialUnlock = parseFloat(schedule.initialUnlock);
  const remainingTokens = totalTokens - initialUnlock;
  
  if (schedule.cliffDuration === schedule.vestingDuration) {
    // All remaining tokens unlock at cliff
    return remainingTokens.toString();
  }
  
  // Typically no additional unlock at cliff in linear vesting
  // Cliff just delays the start of linear vesting
  return '0';
}

/**
 * Calculate linear vesting unlock events (monthly)
 */
function calculateLinearVestingEvents(schedule: VestingSchedule): UnlockEvent[] {
  const events: UnlockEvent[] = [];
  const totalTokens = parseFloat(schedule.totalTokens);
  const initialUnlock = parseFloat(schedule.initialUnlock);
  
  const startDate = schedule.cliffEnd || schedule.vestingStart;
  const vestingDurationDays = schedule.vestingDuration - schedule.cliffDuration;
  
  if (vestingDurationDays <= 0) return events;
  
  const tokensToVest = totalTokens - initialUnlock;
  const monthlyUnlock = tokensToVest / (vestingDurationDays / 30);
  
  const currentDate = new Date(startDate);
  const endDate = schedule.vestingEnd;
  
  while (currentDate <= endDate) {
    const event: UnlockEvent = {
      id: `${schedule.id}-${currentDate.toISOString()}`,
      projectId: schedule.projectId,
      scheduleId: schedule.id,
      date: new Date(currentDate),
      tokensUnlocked: monthlyUnlock.toString(),
      percentageOfTotal: (monthlyUnlock / totalTokens) * 100,
      percentageOfCirculating: 0,
      beneficiaryType: schedule.beneficiaryType,
      isCliffEvent: false,
    };
    events.push(event);
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  return events;
}

/**
 * Analyze market impact of an unlock event
 */
export function analyzeMarketImpact(
  unlockEvent: UnlockEvent,
  project: TokenProject,
  historicalData?: any
): MarketImpactAnalysis {
  const circulatingSupply = parseFloat(project.circulatingSupply);
  const tokensUnlocked = parseFloat(unlockEvent.tokensUnlocked);
  
  // Calculate unlock as percentage of circulating supply
  const unlockPercentage = (tokensUnlocked / circulatingSupply) * 100;
  
  // Score factors (0-100)
  const unlockSizeScore = Math.min(unlockPercentage * 10, 100);
  
  // Calculate liquidity ratio from historical data or estimate
  const liquidityRatio = historicalData?.liquidityRatio || estimateLiquidityRatio(project, historicalData);
  
  // Calculate historical volatility from price data
  const historicalVolatility = historicalData?.volatility || calculateVolatility(historicalData?.priceHistory);
  
  // Calculate market sentiment from recent metrics
  const marketSentiment = historicalData?.sentiment || calculateMarketSentiment(project, historicalData);
  
  // Estimate hodl probability based on beneficiary type
  const hodlProbabilities: Record<string, number> = {
    team: 70, // team typically holds longer
    investors: 40, // early investors may sell
    advisors: 50,
    foundation: 80, // foundation rarely sells
    ecosystem: 90, // ecosystem funds stay in protocol
    community: 60,
    partners: 55,
  };
  const hodlProbability = hodlProbabilities[unlockEvent.beneficiaryType] || 50;
  
  // Calculate overall impact score
  const impactScore = (
    unlockSizeScore * 0.4 +
    (100 - liquidityRatio) * 0.2 +
    historicalVolatility * 0.2 +
    (100 - hodlProbability) * 0.2
  );
  
  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (impactScore < 30) riskLevel = 'low';
  else if (impactScore < 60) riskLevel = 'medium';
  else if (impactScore < 80) riskLevel = 'high';
  else riskLevel = 'critical';
  
  // Generate recommendations
  const recommendations: string[] = [];
  if (unlockPercentage > 10) {
    recommendations.push('⚠️ Large unlock relative to circulating supply - expect volatility');
  }
  if (unlockEvent.beneficiaryType === 'investors') {
    recommendations.push('💰 Investor unlock - higher selling pressure possible');
  }
  if (unlockEvent.isCliffEvent) {
    recommendations.push('🎯 Cliff event - significant one-time unlock');
  }
  if (hodlProbability > 70) {
    recommendations.push('✅ High hodl probability - reduced immediate selling pressure');
  }
  
  // Estimate price impact
  const baseImpact = unlockPercentage * (1 - hodlProbability / 100) * 0.5;
  
  return {
    unlockEvent,
    project,
    riskLevel,
    impactScore: Math.round(impactScore),
    factors: {
      unlockSize: unlockPercentage,
      liquidityRatio,
      historicalVolatility,
      marketSentiment,
      hodlProbability,
    },
    recommendations,
    estimatedPriceImpact: {
      bearish: `-${(baseImpact * 1.5).toFixed(1)}%`,
      neutral: `-${baseImpact.toFixed(1)}%`,
      bullish: `-${(baseImpact * 0.5).toFixed(1)}%`,
    },
  };
}

/**
 * Calculate vesting statistics for a project
 */
export function calculateVestingStatistics(
  project: TokenProject,
  schedules: VestingSchedule[],
  unlockEvents: UnlockEvent[]
): VestingStatistics {
  const now = new Date();
  
  // Calculate total vested and unlocked
  let totalVested = 0;
  let totalUnlocked = 0;
  
  schedules.forEach(schedule => {
    const scheduleTotal = parseFloat(schedule.totalTokens);
    totalVested += scheduleTotal;
    
    // Calculate already unlocked tokens
    const initialUnlock = parseFloat(schedule.initialUnlock);
    totalUnlocked += initialUnlock;
    
    if (schedule.cliffEnd && schedule.cliffEnd <= now) {
      // Add cliff unlock if passed
      const cliffAmount = parseFloat(calculateCliffUnlock(schedule));
      totalUnlocked += cliffAmount;
    }
    
    // Add vested tokens based on time passed
    if (schedule.linearVesting && now > schedule.vestingStart) {
      const startDate = schedule.cliffEnd || schedule.vestingStart;
      if (now > startDate) {
        const totalDays = (schedule.vestingEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        const daysPassed = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        const vestingProgress = Math.min(daysPassed / totalDays, 1);
        const tokensToVest = scheduleTotal - initialUnlock;
        totalUnlocked += tokensToVest * vestingProgress;
      }
    }
  });
  
  // Find next unlock
  const futureUnlocks = unlockEvents
    .filter(e => e.date > now)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  
  const nextUnlock = futureUnlocks[0];
  
  // Calculate average unlock size
  const averageUnlockSize = futureUnlocks.length > 0
    ? futureUnlocks.reduce((sum, e) => sum + parseFloat(e.tokensUnlocked), 0) / futureUnlocks.length
    : 0;
  
  // Determine unlock frequency
  let unlockFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'irregular' = 'monthly';
  if (futureUnlocks.length >= 2) {
    const avgGap = (futureUnlocks[futureUnlocks.length - 1].date.getTime() - futureUnlocks[0].date.getTime()) /
      (futureUnlocks.length - 1) / (1000 * 60 * 60 * 24);
    
    if (avgGap < 7) unlockFrequency = 'daily';
    else if (avgGap < 14) unlockFrequency = 'weekly';
    else if (avgGap < 60) unlockFrequency = 'monthly';
    else if (avgGap < 120) unlockFrequency = 'quarterly';
    else unlockFrequency = 'irregular';
  }
  
  // Find latest vesting end date
  const latestEnd = schedules.reduce((latest, s) =>
    s.vestingEnd > latest ? s.vestingEnd : latest, schedules[0]?.vestingEnd || now
  );
  
  return {
    projectId: project.id,
    totalVested: totalVested.toString(),
    totalUnlocked: totalUnlocked.toString(),
    percentageVested: (totalUnlocked / totalVested) * 100,
    nextUnlockDate: nextUnlock?.date || null,
    nextUnlockAmount: nextUnlock?.tokensUnlocked || '0',
    averageUnlockSize: averageUnlockSize.toString(),
    unlockFrequency,
    estimatedCompletionDate: latestEnd,
  };
}

/**
 * Calculate days until next unlock
 */
export function daysUntilUnlock(unlockDate: Date): number {
  const now = new Date();
  const diff = unlockDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(amount: string, decimals: number = 2): string {
  const num = parseFloat(amount);
  if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
  return num.toFixed(decimals);
}

/**
 * Estimate liquidity ratio for a token unlock event
 * Compares unlock amount to available DEX liquidity
 */
function estimateLiquidityRatio(
  project: TokenUnlockProject,
  historicalData?: HistoricalData
): number {
  if (!historicalData?.volumeHistory || historicalData.volumeHistory.length === 0) {
    return 50; // Neutral if no data
  }

  // Calculate average daily volume (last 30 days)
  const avgVolume = historicalData.volumeHistory.reduce((sum, v) => sum + v.volume, 0) / historicalData.volumeHistory.length;
  
  // Estimate unlock amount in USD
  const currentPrice = historicalData.priceHistory?.[historicalData.priceHistory.length - 1]?.price || 1;
  const unlockValueUSD = project.nextUnlock.amount * currentPrice;
  
  // Ratio: unlock value / average daily volume
  // Higher ratio = more pressure
  const ratio = unlockValueUSD / avgVolume;
  
  // Convert to 0-100 scale (capped at 100)
  // ratio > 10 = very high pressure (100)
  // ratio = 1 = moderate pressure (50)
  // ratio < 0.1 = low pressure (10)
  return Math.min(100, Math.max(0, ratio * 50));
}

/**
 * Calculate historical volatility from price data
 */
function calculateVolatility(priceHistory?: Array<{ timestamp: number; price: number }>): number {
  if (!priceHistory || priceHistory.length < 2) {
    return 50; // Neutral if no data
  }

  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < priceHistory.length; i++) {
    const dailyReturn = (priceHistory[i].price - priceHistory[i - 1].price) / priceHistory[i - 1].price;
    returns.push(dailyReturn);
  }

  // Calculate standard deviation of returns
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Annualize volatility (assuming daily data)
  const annualizedVol = stdDev * Math.sqrt(365);

  // Convert to 0-100 scale
  // 200% annual vol = 100
  // 50% annual vol = 25
  return Math.min(100, annualizedVol * 50);
}

/**
 * Calculate market sentiment from various indicators
 */
function calculateMarketSentiment(
  project: TokenUnlockProject,
  historicalData?: HistoricalData
): number {
  if (!historicalData?.priceHistory || historicalData.priceHistory.length < 7) {
    return 50; // Neutral if no data
  }

  const prices = historicalData.priceHistory.map(p => p.price);
  const latest = prices[prices.length - 1];
  const week7Ago = prices[prices.length - 7];
  const week30Ago = prices[prices.length - Math.min(30, prices.length)];

  // Calculate price momentum
  const momentum7d = (latest - week7Ago) / week7Ago;
  const momentum30d = (latest - week30Ago) / week30Ago;

  // Calculate volume trend
  let volumeTrend = 0;
  if (historicalData.volumeHistory && historicalData.volumeHistory.length >= 7) {
    const recentVol = historicalData.volumeHistory.slice(-7).reduce((sum, v) => sum + v.volume, 0) / 7;
    const olderVol = historicalData.volumeHistory.slice(-30, -7).reduce((sum, v) => sum + v.volume, 0) / 23;
    volumeTrend = (recentVol - olderVol) / olderVol;
  }

  // Weighted sentiment score
  // Positive momentum + increasing volume = bullish (>50)
  // Negative momentum + decreasing volume = bearish (<50)
  const sentimentScore = 50 + (momentum7d * 100) + (momentum30d * 50) + (volumeTrend * 25);

  return Math.min(100, Math.max(0, sentimentScore));
}
