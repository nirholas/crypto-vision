import type { SupportedChain } from "../../../config/chains.js";
import { EVMChainScanner } from "./evm.js";

/**
 * Base Chain Scanner
 * Uses Alchemy for token balance queries
 */
export class BaseScanner extends EVMChainScanner {
  chain: SupportedChain = "base";

  protected getAlchemyUrl(): string {
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error("ALCHEMY_API_KEY not configured");
    }
    return `https://base-mainnet.g.alchemy.com/v2/${apiKey}`;
  }

  protected getRpcUrl(): string {
    // Prefer custom RPC if configured, otherwise use Alchemy
    const customRpc = process.env.RPC_BASE;
    if (customRpc) return customRpc;
    
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error("No RPC configured for Base");
    }
    return `https://base-mainnet.g.alchemy.com/v2/${apiKey}`;
  }
}

// Export singleton instance
export const baseScanner = new BaseScanner();
