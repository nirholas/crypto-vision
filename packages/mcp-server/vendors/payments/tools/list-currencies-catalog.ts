/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// MCP tool for listing available cryptocurrency catalog with filtering

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CurrencyService } from '../services/currency-service.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export const listCurrenciesCatalogTool: Tool = {
  name: 'list_currencies_catalog',
  description:
    'Get available cryptocurrencies with optional amount filtering. USE WHEN: (1) User asks which cryptos available, (2) BEFORE onchain payment if crypto has multiple networks (e.g., USDC). DISPLAY RULES: Show users "original_symbol" (BTC, USDC) and "original_blockchain" (Bitcoin Network, Ethereum Network). Use "input_currency_code" ONLY when calling create_payment_onchain - NEVER show it to users. NETWORK SELECTION: If multiple networks exist (shown in network_groups), ASK user which network. RESULT: List with min/max amounts, decimals, network info, features. EXAMPLES: "Which cryptos available?", "What currencies support 50 euros?"',
  inputSchema: {
    type: 'object',
    properties: {
      filter_by_amount: {
        type: 'number',
        minimum: 0.01,
        description:
          'Optional EUR amount to filter currencies that support this payment amount. Use this if user asks "which cryptos accept 50 euros?" or similar.',
      },
    },
    additionalProperties: false,
  },
};

// Internal interface with API code (used for lookups)
interface CurrencyInfoInternal {
  input_currency_code: string;
  name: string;
  min_amount: number;
  max_amount: number | null;
  image: string;
  original_symbol: string;
  original_blockchain: string;
  requires_memo: boolean;
  decimals: number;
  is_active: boolean;
  features: string[];
}

// Display interface WITHOUT internal codes (what LLM sees in JSON)
export interface CurrencyInfo {
  name: string;
  min_amount: number;
  max_amount: number | null;
  image: string;
  original_symbol: string; // Display this to users (e.g., BTC, USDC)
  original_blockchain: string; // Display this to users (e.g., Bitcoin Network)
  requires_memo: boolean;
  decimals: number;
  is_active: boolean;
  features: string[];
}

export class ListCurrenciesCatalogHandler {
  constructor(private readonly currencyService: CurrencyService) {}

  async handle(args: unknown): Promise<{
    currencies: CurrencyInfo[];
    total_count: number;
    filtered_count: number;
    filter_applied: boolean;
    filter_amount?: number;
    network_groups?: Record<string, string[]>;
    cache_info: {
      cached: boolean;
      age: number;
      valid: boolean;
    };
  }> {
    const startTime = Date.now();

    logger.info('Processing list_currencies_catalog request', {
      operation: 'list_currencies_catalog',
      timestamp: new Date().toISOString(),
    });

    try {
      // Get currencies catalog through service
      const catalogResult =
        await this.currencyService.getCurrenciesCatalog(args);

      // Transform currencies - first create internal list with codes
      const currencyInfosInternal: CurrencyInfoInternal[] =
        catalogResult.currencies.map(currency => {
          // Extract with explicit types to satisfy ESLint
          const originalSymbol: string = currency.original_symbol as string;
          const originalBlockchain: string =
            currency.original_blockchain as string;

          return {
            input_currency_code: currency.symbol, // Internal API code
            name: currency.name,
            min_amount: currency.minAmount,
            max_amount: currency.maxAmount,
            image: currency.network_image,
            original_symbol: originalSymbol,
            original_blockchain: originalBlockchain,
            requires_memo: currency.requiresMemo,
            decimals: currency.decimals,
            is_active: currency.isActive,
            features: this.getCurrencyFeatures(currency),
          };
        });

      // Create display list WITHOUT input_currency_code (what LLM sees)
      const currencyInfos: CurrencyInfo[] = currencyInfosInternal.map(c => ({
        name: c.name,
        min_amount: c.min_amount,
        max_amount: c.max_amount,
        image: c.image,
        original_symbol: c.original_symbol,
        original_blockchain: c.original_blockchain,
        requires_memo: c.requires_memo,
        decimals: c.decimals,
        is_active: c.is_active,
        features: c.features,
      }));

      // Get cache information
      const cacheStats = this.currencyService.getCacheStats();

      // Group currencies by base symbol to identify multi-network currencies
      const networkGroups = this.groupCurrenciesByNetwork(
        currencyInfosInternal
      );

      const response = {
        currencies: currencyInfos,
        total_count: catalogResult.totalCount,
        filtered_count: catalogResult.filteredCount,
        filter_applied: !!catalogResult.appliedFilters.filterByAmount,
        filter_amount: catalogResult.appliedFilters.filterByAmount,
        network_groups:
          Object.keys(networkGroups).length > 0 ? networkGroups : undefined,
        cache_info: {
          cached: cacheStats.cached,
          age: cacheStats.age,
          valid: cacheStats.valid,
        },
      };

      const duration = Date.now() - startTime;

      logger.info('list_currencies_catalog completed successfully', {
        operation: 'list_currencies_catalog_success',
        totalCount: catalogResult.totalCount,
        filteredCount: catalogResult.filteredCount,
        filterApplied: response.filter_applied,
        filterAmount: response.filter_amount,
        cached: cacheStats.cached,
        duration,
        timestamp: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('list_currencies_catalog failed', error as Error, {
        operation: 'list_currencies_catalog_error',
        duration,
        timestamp: new Date().toISOString(),
      });

      // Re-throw the error to be handled by MCP framework
      throw error;
    }
  }

  /**
   * Get feature list for a currency
   * Uses original_symbol and original_blockchain for user-friendly features
   */
  private getCurrencyFeatures(currency: {
    requiresMemo: boolean;
    blockchain: string;
    symbol: string;
    original_symbol: string;
    original_blockchain: string;
    maxAmount: number | null;
  }): string[] {
    const features: string[] = [];

    if (currency.requiresMemo) {
      features.push('Requires memo/tag');
    }

    // Use original_blockchain for user-friendly display
    if (currency.original_blockchain) {
      features.push(`${currency.original_blockchain}`);
    }

    if (currency.maxAmount === null) {
      features.push('No maximum limit');
    }

    // Add stability indicator for stablecoins - use original_symbol
    if (this.isStablecoin(currency.original_symbol)) {
      features.push('Stablecoin');
    }

    // Add popular currency indicator - use original_symbol
    if (this.isPopularCurrency(currency.original_symbol)) {
      features.push('Popular');
    }

    return features;
  }

  /**
   * Group currencies by base symbol to identify multi-network variants
   * Example: USDC_ETH, USDC_TRON, USDC_POLYGON -> { "USDC": ["USDC_ETH", "USDC_TRON", "USDC_POLYGON"] }
   */
  private groupCurrenciesByNetwork(
    currencies: CurrencyInfoInternal[]
  ): Record<string, string[]> {
    const groups: Record<string, string[]> = {};

    for (const currency of currencies) {
      // Extract base symbol (part before underscore if exists)
      const parts = currency.input_currency_code.split('_');
      const baseSymbol = parts[0];

      // Only group if there are multiple variants (contains underscore)
      if (parts.length > 1 && baseSymbol) {
        if (!groups[baseSymbol]) {
          groups[baseSymbol] = [];
        }
        // Store display name instead of code: "USDC on Ethereum Network"
        // Handle undefined values gracefully
        const symbol = currency.original_symbol || baseSymbol;
        const blockchain = currency.original_blockchain || 'Unknown Network';
        groups[baseSymbol]?.push(`${symbol} on ${blockchain}`);
      }
    }

    // Only return groups with multiple networks
    const multiNetworkGroups: Record<string, string[]> = {};
    for (const [base, variants] of Object.entries(groups)) {
      if (variants.length > 1) {
        multiNetworkGroups[base] = variants;
      }
    }

    return multiNetworkGroups;
  }

  /**
   * Check if currency is a stablecoin
   */
  private isStablecoin(symbol: string): boolean {
    if (!symbol) return false;
    const stablecoins = ['USDC'];
    return stablecoins.includes(symbol.toUpperCase());
  }

  /**
   * Check if currency is in the popular list
   */
  private isPopularCurrency(symbol: string): boolean {
    if (!symbol) return false;
    const popularCurrencies = ['BTC', 'ETH', 'LTC', 'BCH', 'XRP'];
    return popularCurrencies.includes(symbol.toUpperCase());
  }
}

// Factory function for creating the handler
export function listCurrenciesCatalogHandler(
  currencyService: CurrencyService
): ListCurrenciesCatalogHandler {
  return new ListCurrenciesCatalogHandler(currencyService);
}
