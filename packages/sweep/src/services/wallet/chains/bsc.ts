import type { SupportedChain } from "../../../config/chains.js";
import { InfuraEVMScanner } from "./evm.js";

/**
 * BNB Chain (BSC) Scanner
 * Uses Infura/public RPC + BscScan API for token discovery
 * Note: Alchemy doesn't support BSC, so we use a different approach
 */
export class BSCScanner extends InfuraEVMScanner {
  chain: SupportedChain = "bsc";

  protected getAlchemyUrl(): string {
    // BSC is not supported by Alchemy, this method is overridden in parent
    // but we still need to implement it - just return the RPC URL
    return this.getRpcUrl();
  }

  protected getRpcUrl(): string {
    // Prefer custom RPC if configured, otherwise use public BSC RPC
    const customRpc = process.env.RPC_BSC;
    if (customRpc) return customRpc;
    
    // Fallback to public BSC RPC
    return "https://bsc-dataseed1.binance.org";
  }

  /**
   * Override native token price fetch for BNB
   */
  protected async getNativeTokenPrice(): Promise<number> {
    const { getValidatedPrice } = await import("../../price.service.js");
    // WBNB address on BSC
    const wbnbAddress = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
    const priceData = await getValidatedPrice(wbnbAddress, "bsc");
    return priceData.price;
  }
}

// Export singleton instance
export const bscScanner = new BSCScanner();
