import type { SupportedChain } from "../../../config/chains.js";
import { EVMChainScanner } from "./evm.js";

/**
 * Arbitrum One Scanner
 * Uses Alchemy for token balance queries
 */
export class ArbitrumScanner extends EVMChainScanner {
  chain: SupportedChain = "arbitrum";

  protected getAlchemyUrl(): string {
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error("ALCHEMY_API_KEY not configured");
    }
    return `https://arb-mainnet.g.alchemy.com/v2/${apiKey}`;
  }

  protected getRpcUrl(): string {
    // Prefer custom RPC if configured, otherwise use Alchemy
    const customRpc = process.env.RPC_ARBITRUM;
    if (customRpc) return customRpc;
    
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error("No RPC configured for Arbitrum");
    }
    return `https://arb-mainnet.g.alchemy.com/v2/${apiKey}`;
  }
}

// Export singleton instance
export const arbitrumScanner = new ArbitrumScanner();
