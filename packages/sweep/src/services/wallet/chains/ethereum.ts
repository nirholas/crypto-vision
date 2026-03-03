import type { SupportedChain } from "../../../config/chains.js";
import { EVMChainScanner } from "./evm.js";

/**
 * Ethereum Mainnet Scanner
 * Uses Alchemy for token balance queries
 */
export class EthereumScanner extends EVMChainScanner {
  chain: SupportedChain = "ethereum";

  protected getAlchemyUrl(): string {
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error("ALCHEMY_API_KEY not configured");
    }
    return `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;
  }

  protected getRpcUrl(): string {
    // Prefer custom RPC if configured, otherwise use Alchemy
    const customRpc = process.env.RPC_ETHEREUM;
    if (customRpc) return customRpc;
    
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error("No RPC configured for Ethereum");
    }
    return `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;
  }
}

// Export singleton instance
export const ethereumScanner = new EthereumScanner();
