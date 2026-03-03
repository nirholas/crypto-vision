import type { SupportedChain } from "../../../config/chains.js";
import { EVMChainScanner } from "./evm.js";

/**
 * Linea Scanner
 * Uses Alchemy for token balance queries (Alchemy supports Linea)
 */
export class LineaScanner extends EVMChainScanner {
  chain: SupportedChain = "linea";

  protected getAlchemyUrl(): string {
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error("ALCHEMY_API_KEY not configured");
    }
    return `https://linea-mainnet.g.alchemy.com/v2/${apiKey}`;
  }

  protected getRpcUrl(): string {
    // Prefer custom RPC if configured, otherwise use Alchemy
    const customRpc = process.env.RPC_LINEA;
    if (customRpc) return customRpc;
    
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      // Fallback to public Linea RPC
      return "https://rpc.linea.build";
    }
    return `https://linea-mainnet.g.alchemy.com/v2/${apiKey}`;
  }
}

// Export singleton instance
export const lineaScanner = new LineaScanner();
