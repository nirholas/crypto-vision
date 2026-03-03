import type { SupportedChain } from "../../../config/chains.js";
import { EVMChainScanner } from "./evm.js";

/**
 * Polygon (Matic) Scanner
 * Uses Alchemy for token balance queries
 */
export class PolygonScanner extends EVMChainScanner {
  chain: SupportedChain = "polygon";

  protected getAlchemyUrl(): string {
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error("ALCHEMY_API_KEY not configured");
    }
    return `https://polygon-mainnet.g.alchemy.com/v2/${apiKey}`;
  }

  protected getRpcUrl(): string {
    // Prefer custom RPC if configured, otherwise use Alchemy
    const customRpc = process.env.RPC_POLYGON;
    if (customRpc) return customRpc;
    
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error("No RPC configured for Polygon");
    }
    return `https://polygon-mainnet.g.alchemy.com/v2/${apiKey}`;
  }
}

// Export singleton instance
export const polygonScanner = new PolygonScanner();
