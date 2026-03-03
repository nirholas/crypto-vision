/**
 * Token Unlock & Vesting Schedule Tracker
 * 
 * Types and interfaces for tracking token unlocks, vesting schedules,
 * and analyzing their potential market impact.
 */

export interface TokenProject {
  id: string;
  name: string;
  symbol: string;
  chain: string;
  tokenAddress: string;
  totalSupply: string;
  circulatingSupply: string;
  marketCap?: string;
  currentPrice?: string;
  launchDate: Date;
  vestingContract?: string;
}

export interface VestingSchedule {
  id: string;
  projectId: string;
  beneficiaryType: 'team' | 'investors' | 'advisors' | 'foundation' | 'ecosystem' | 'community' | 'partners';
  totalTokens: string;
  cliffDuration: number; // in days
  cliffEnd: Date | null;
  vestingDuration: number; // in days
  vestingStart: Date;
  vestingEnd: Date;
  initialUnlock: string; // tokens unlocked at TGE
  linearVesting: boolean;
  fullyDilutedValuation?: string;
}

export interface UnlockEvent {
  id: string;
  projectId: string;
  scheduleId: string;
  date: Date;
  tokensUnlocked: string;
  percentageOfTotal: number;
  percentageOfCirculating: number;
  beneficiaryType: string;
  estimatedValue?: string;
  isCliffEvent: boolean;
}

export interface MarketImpactAnalysis {
  unlockEvent: UnlockEvent;
  project: TokenProject;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  impactScore: number; // 0-100
  factors: {
    unlockSize: number; // percentage of circulating supply
    liquidityRatio: number;
    historicalVolatility: number;
    marketSentiment: number;
    hodlProbability: number; // likelihood tokens won't be sold immediately
  };
  recommendations: string[];
  estimatedPriceImpact: {
    bearish: string; // percentage drop
    neutral: string;
    bullish: string;
  };
}

export interface VestingAlert {
  id: string;
  projectId: string;
  unlockEventId: string;
  alertType: 'upcoming_unlock' | 'cliff_approaching' | 'large_unlock' | 'vesting_complete';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  daysUntil: number;
  createdAt: Date;
  acknowledged: boolean;
}

export interface UnlockCalendar {
  date: Date;
  events: UnlockEvent[];
  totalValueUnlocked: string;
  projectsAffected: number;
}

export interface VestingStatistics {
  projectId: string;
  totalVested: string;
  totalUnlocked: string;
  percentageVested: number;
  nextUnlockDate: Date | null;
  nextUnlockAmount: string;
  averageUnlockSize: string;
  unlockFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'irregular';
  estimatedCompletionDate: Date;
}

export interface TrackerConfig {
  alertThresholds: {
    minUnlockPercentage: number; // alert if unlock > X% of supply
    daysBeforeAlert: number; // alert X days before event
    minMarketCapForAlert: number; // only alert for projects above this mcap
  };
  priceDataSource: 'coingecko' | 'defillama' | 'manual';
  refreshInterval: number; // minutes
  enableNotifications: boolean;
}

export interface UnlockSearchFilters {
  startDate?: Date;
  endDate?: Date;
  minTokensUnlocked?: string;
  maxTokensUnlocked?: string;
  beneficiaryTypes?: string[];
  projectIds?: string[];
  riskLevels?: ('low' | 'medium' | 'high' | 'critical')[];
  chains?: string[];
}

export interface VestingAnalytics {
  project: TokenProject;
  schedules: VestingSchedule[];
  upcomingUnlocks: UnlockEvent[];
  statistics: VestingStatistics;
  marketImpact: MarketImpactAnalysis[];
  historicalUnlocks: UnlockEvent[];
  teamTokensRemaining: string;
  investorTokensRemaining: string;
  fullyUnlockedDate: Date;
}
