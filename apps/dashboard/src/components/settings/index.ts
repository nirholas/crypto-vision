/**
 * Settings Components Index
 * 
 * Exports all settings-related components
 */

export { ExchangeSettings } from './ExchangeSettings';

// Re-export exchange sync hook for convenience
export { useExchangeSync } from '@/hooks/useExchangeSync';
export type {
  ExchangeConfig,
  Balance,
  Trade,
  AggregatedPortfolio,
  SyncResult,
  SyncHistoryItem,
} from '@/hooks/useExchangeSync';
