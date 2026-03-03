/**
 * x402 Per-endpoint Pricing Configuration
 *
 * Manages pricing rules and converts between human-readable and on-chain amounts.
 */

import type { X402PricingConfig, TokenConfig } from './types.js';
import { BSC_TOKENS, BSC_TESTNET_TOKENS, OPBNB_TOKENS, OPBNB_TESTNET_TOKENS } from './types.js';
import type { PricingConfig } from '../erc8004/types.js';

export class PricingManager {
  private readonly routes: Map<string, X402PricingConfig> = new Map();
  private readonly chainId: number;

  constructor(chainId: number) {
    this.chainId = chainId;
  }

  /**
   * Add pricing from a simplified config map.
   */
  addFromConfig(pricing: Record<string, PricingConfig>): void {
    for (const [route, config] of Object.entries(pricing)) {
      this.addRoute({
        route,
        price: config.price,
        token: config.token,
        tokenAddress: config.tokenAddress ?? this.resolveTokenAddress(config.token),
        decimals: config.decimals ?? this.resolveTokenDecimals(config.token),
      });
    }
  }

  /**
   * Add a pricing rule for a route.
   */
  addRoute(config: X402PricingConfig): void {
    this.routes.set(this.normalizeRoute(config.route), config);
  }

  /**
   * Remove pricing for a route.
   */
  removeRoute(route: string): void {
    this.routes.delete(this.normalizeRoute(route));
  }

  /**
   * Get pricing for a route.
   */
  getRoutePrice(route: string): X402PricingConfig | undefined {
    const normalized = this.normalizeRoute(route);
    return this.routes.get(normalized);
  }

  /**
   * Check if a route requires payment.
   */
  isPaywalled(route: string): boolean {
    return this.routes.has(this.normalizeRoute(route));
  }

  /**
   * Get all priced routes.
   */
  getAllRoutes(): X402PricingConfig[] {
    return Array.from(this.routes.values());
  }

  /**
   * Convert human-readable price to smallest unit.
   */
  toSmallestUnit(price: string, decimals: number): string {
    const amount = parseFloat(price);
    return BigInt(Math.floor(amount * 10 ** decimals)).toString();
  }

  /**
   * Convert smallest unit to human-readable price.
   */
  toHumanReadable(amount: string, decimals: number): string {
    const value = Number(BigInt(amount)) / 10 ** decimals;
    return value.toString();
  }

  /**
   * Resolve a token address from symbol based on chain.
   */
  private resolveTokenAddress(symbol: string): string | undefined {
    const tokensByChain: Record<number, Record<string, TokenConfig>> = {
      97: BSC_TESTNET_TOKENS,
      56: BSC_TOKENS,
      5611: OPBNB_TESTNET_TOKENS,
      204: OPBNB_TOKENS,
    };
    const tokens = tokensByChain[this.chainId] ?? BSC_TOKENS;
    return tokens[symbol.toUpperCase()]?.address;
  }

  /**
   * Resolve token decimals from symbol.
   */
  private resolveTokenDecimals(symbol: string): number {
    // Most BSC tokens use 18 decimals
    const stablecoins = ['USDC', 'USDT', 'BUSD', 'DAI'];
    if (stablecoins.includes(symbol.toUpperCase())) return 18; // BSC uses 18 for these
    return 18;
  }

  private normalizeRoute(route: string): string {
    return route.replace(/^\/+|\/+$/g, '').toLowerCase();
  }
}
