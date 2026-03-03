/**
 * Hooks Index
 *
 * Central export for all custom React hooks
 */

export * from './crypto';
export * from './data-sources';
export {
  useMarketMood,
  useMarketMood as default,
  getMoodColor,
  getMoodLabel,
} from './useMarketMood';

// Live Price Hooks
export {
  useLivePrice,
  useLivePrices,
  useConnectionStatus,
  LivePriceProvider,
} from './useLivePrice';
export type {
  LivePriceData,
  UseLivePriceResult,
  UseLivePricesResult,
  ConnectionStatus,
  LivePriceProviderProps,
} from './useLivePrice';

// Price Flash Hook
export {
  usePriceFlash,
  usePriceFlashes,
} from './usePriceFlash';
export type {
  FlashDirection,
  UsePriceFlashOptions,
  UsePriceFlashResult,
} from './usePriceFlash';
