/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// Currency service for catalog management and filtering

import type {
  Currency,
  Configuration,
  ApiError,
} from '../types/index.js';
import type { BitnovoApiClient } from '../api/bitnovo-client.js';
import { validateListCurrenciesCatalog } from '../utils/validation.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export class CurrencyServiceError extends Error implements ApiError {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'CurrencyServiceError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export interface CurrencyFilter {
  minAmount?: number;
  maxAmount?: number;
  filterByAmount?: number;
  includeInactive?: boolean;
  blockchain?: string;
  requiresMemo?: boolean;
}

export interface CurrencyCatalogResult {
  currencies: Currency[];
  totalCount: number;
  filteredCount: number;
  appliedFilters: CurrencyFilter;
}

export class CurrencyService {
  private currencyCache: Currency[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly cacheMaxAge = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly apiClient: BitnovoApiClient,
    private readonly config: Configuration
  ) {}

  /**
   * Get currencies catalog with optional filtering
   */
  async getCurrenciesCatalog(input: unknown): Promise<CurrencyCatalogResult> {
    logger.info('Getting currencies catalog', {
      operation: 'get_currencies_catalog',
    });

    // Validate input
    const validation = validateListCurrenciesCatalog(input);
    if (!validation.success) {
      logger.warn('Invalid currencies catalog input', {
        error: validation.error,
        operation: 'get_currencies_catalog_validation',
      });

      throw new CurrencyServiceError(
        `Invalid input: ${validation.error.message}`,
        400,
        validation.error.code,
        { field: validation.error.field }
      );
    }

    const validInput = validation.data;

    try {
      // Get currencies from cache or API
      const allCurrencies = await this.getCurrencies();

      // Apply filters
      const filters: CurrencyFilter = {
        filterByAmount: validInput.filter_by_amount,
        includeInactive: false, // Only show active currencies
      };

      const filteredCurrencies = this.applyCurrencyFilters(
        allCurrencies,
        filters
      );

      // Sort currencies by priority (BTC, ETH, then alphabetically)
      const sortedCurrencies = this.sortCurrencies(filteredCurrencies);

      const result: CurrencyCatalogResult = {
        currencies: sortedCurrencies,
        totalCount: allCurrencies.length,
        filteredCount: sortedCurrencies.length,
        appliedFilters: filters,
      };

      logger.info('Currencies catalog retrieved successfully', {
        totalCount: result.totalCount,
        filteredCount: result.filteredCount,
        hasAmountFilter: !!validInput.filter_by_amount,
        operation: 'get_currencies_catalog_success',
      });

      return result;
    } catch (error) {
      if (error instanceof CurrencyServiceError) {
        throw error;
      }

      logger.error('Failed to get currencies catalog', error as Error, {
        operation: 'get_currencies_catalog_error',
      });

      // Re-throw API errors with context
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error;
      }

      throw new CurrencyServiceError(
        'Internal error getting currencies catalog',
        500,
        'INTERNAL_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Get all currencies with caching
   */
  async getCurrencies(): Promise<Currency[]> {
    // Check cache validity
    if (this.currencyCache && this.isCacheValid()) {
      logger.debug('Using cached currencies', {
        cacheAge: Date.now() - this.cacheTimestamp,
        operation: 'get_currencies_cache_hit',
      });
      return this.currencyCache;
    }

    try {
      logger.debug('Fetching currencies from API', {
        operation: 'get_currencies_api_call',
      });

      const currencies = await this.apiClient.getCurrencies();

      // Enhance currencies with additional metadata
      const enhancedCurrencies = currencies.map(currency =>
        this.enhanceCurrency(currency)
      );

      // Update cache
      this.currencyCache = enhancedCurrencies;
      this.cacheTimestamp = Date.now();

      return enhancedCurrencies;
    } catch (error) {
      logger.error('Failed to fetch currencies from API', error as Error, {
        operation: 'get_currencies_api_error',
      });

      // If we have stale cache, return it as fallback
      if (this.currencyCache) {
        logger.warn('Using stale currency cache as fallback', {
          cacheAge: Date.now() - this.cacheTimestamp,
          operation: 'get_currencies_fallback',
        });
        return this.currencyCache;
      }

      throw error;
    }
  }

  /**
   * Find a specific currency by symbol
   */
  async findCurrency(symbol: string): Promise<Currency | null> {
    const currencies = await this.getCurrencies();
    return (
      currencies.find(c => c.symbol.toLowerCase() === symbol.toLowerCase()) ||
      null
    );
  }

  /**
   * Check if a currency is valid for a specific amount
   */
  async isCurrencyValidForAmount(
    symbol: string,
    amount: number
  ): Promise<boolean> {
    const currency = await this.findCurrency(symbol);
    if (!currency || !currency.isActive) {
      return false;
    }

    if (amount < currency.minAmount) {
      return false;
    }

    if (currency.maxAmount !== null && amount > currency.maxAmount) {
      return false;
    }

    return true;
  }

  /**
   * Get currencies that support a specific amount
   */
  async getCurrenciesForAmount(amount: number): Promise<Currency[]> {
    const allCurrencies = await this.getCurrencies();
    return this.applyCurrencyFilters(allCurrencies, { filterByAmount: amount });
  }

  /**
   * Apply filtering logic to currencies list
   */
  private applyCurrencyFilters(
    currencies: Currency[],
    filters: CurrencyFilter
  ): Currency[] {
    let filtered = currencies;

    // Filter by active status
    if (!filters.includeInactive) {
      filtered = filtered.filter(c => c.isActive);
    }

    // Filter by amount compatibility
    if (filters.filterByAmount !== undefined) {
      const amount = filters.filterByAmount;
      filtered = filtered.filter(c => {
        if (amount < c.minAmount) return false;
        if (c.maxAmount !== null && amount > c.maxAmount) return false;
        return true;
      });
    }

    // Filter by minimum amount
    if (filters.minAmount !== undefined) {
      filtered = filtered.filter(c => c.minAmount >= filters.minAmount!);
    }

    // Filter by maximum amount
    if (filters.maxAmount !== undefined) {
      filtered = filtered.filter(
        c => c.maxAmount !== null && c.maxAmount <= filters.maxAmount!
      );
    }

    // Filter by blockchain
    if (filters.blockchain) {
      filtered = filtered.filter(
        c => c.blockchain.toLowerCase() === filters.blockchain!.toLowerCase()
      );
    }

    // Filter by memo requirement
    if (filters.requiresMemo !== undefined) {
      filtered = filtered.filter(c => c.requiresMemo === filters.requiresMemo);
    }

    return filtered;
  }

  /**
   * Sort currencies by priority and name
   */
  private sortCurrencies(currencies: Currency[]): Currency[] {
    const priorityOrder = ['BTC', 'ETH', 'LTC', 'BCH', 'XRP', 'XLM', 'USDC'];

    return [...currencies].sort((a, b) => {
      const aPriority = priorityOrder.indexOf(a.symbol);
      const bPriority = priorityOrder.indexOf(b.symbol);

      // If both have priority, sort by priority order
      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      }

      // If only one has priority, prioritized one comes first
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;

      // If neither has priority, sort alphabetically
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Enhance currency with additional metadata and validation
   */
  private enhanceCurrency(currency: Currency): Currency {
    // Add current rate if available (would come from API in real implementation)
    const enhancedCurrency: Currency = {
      ...currency,
      // Ensure consistent decimal places
      minAmount: this.normalizeAmount(currency.minAmount),
      maxAmount: currency.maxAmount
        ? this.normalizeAmount(currency.maxAmount)
        : null,
    };

    // Add warnings for special currencies
    if (enhancedCurrency.requiresMemo) {
      logger.debug(`Currency ${currency.symbol} requires memo/tag`, {
        currency: currency.symbol,
        blockchain: currency.blockchain,
        operation: 'currency_enhancement',
      });
    }

    return enhancedCurrency;
  }

  /**
   * Check if currency cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.cacheTimestamp < this.cacheMaxAge;
  }

  /**
   * Clear currency cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.currencyCache = null;
    this.cacheTimestamp = 0;
    logger.debug('Currency cache cleared', { operation: 'clear_cache' });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    cached: boolean;
    age: number;
    maxAge: number;
    count: number;
    valid: boolean;
  } {
    return {
      cached: this.currencyCache !== null,
      age: Date.now() - this.cacheTimestamp,
      maxAge: this.cacheMaxAge,
      count: this.currencyCache?.length || 0,
      valid: this.isCacheValid(),
    };
  }

  /**
   * Normalize amount to avoid floating point precision issues
   */
  private normalizeAmount(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  /**
   * Get currency display information
   * Uses original_symbol and original_blockchain for user-friendly display
   */
  getCurrencyDisplayInfo(currency: Currency): {
    displayName: string;
    shortName: string;
    amountRange: string;
    features: string[];
  } {
    const features: string[] = [];

    if (currency.requiresMemo) {
      features.push('Requires memo/tag');
    }

    // Use original_blockchain for user-friendly display
    if (currency.original_blockchain) {
      features.push(`${currency.original_blockchain}`);
    }

    const maxAmountText = currency.maxAmount
      ? `€${currency.maxAmount}`
      : 'No limit';

    return {
      displayName: `${currency.name} (${currency.original_symbol})`, // Use original_symbol for display
      shortName: currency.original_symbol, // Use original_symbol for display
      amountRange: `€${currency.minAmount} - ${maxAmountText}`,
      features,
    };
  }

  /**
   * Validate if currencies are available for service
   */
  async validateServiceAvailability(): Promise<{
    available: boolean;
    error?: string;
  }> {
    try {
      const currencies = await this.getCurrencies();

      if (currencies.length === 0) {
        return {
          available: false,
          error: 'No currencies available from payment provider',
        };
      }

      const activeCurrencies = currencies.filter(c => c.isActive);
      if (activeCurrencies.length === 0) {
        return {
          available: false,
          error: 'No active currencies available',
        };
      }

      return { available: true };
    } catch (error) {
      logger.error('Service availability check failed', error as Error, {
        operation: 'validate_service_availability',
      });

      return {
        available: false,
        error: 'Unable to connect to payment provider',
      };
    }
  }
}
