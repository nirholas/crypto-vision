import type { SupportedChain } from "../../../config/chains.js";
import {
  type ChainBalance,
  type ChainScanner,
  type WalletToken,
  type HeliusAsset,
  type HeliusGetAssetsByOwnerResponse,
  DUST_THRESHOLD_USD,
} from "../types.js";
import { getValidatedPrice } from "../../price.service.js";

// ============================================================
// Types for Solana-specific scanning
// ============================================================

export interface VacantTokenAccount {
  address: string; // Token account address
  mint: string; // Token mint address
  owner: string; // Wallet owner
  rentLamports: bigint; // Recoverable rent (~0.002 SOL)
  isToken2022: boolean; // Token Extensions program
  programId: string;
}

export interface SolanaTokenAccount {
  address: string;
  mint: string;
  owner: string;
  balance: bigint;
  decimals: number;
  rentLamports: bigint;
  isToken2022: boolean;
  programId: string;
}

export interface SolanaScanResult extends ChainBalance {
  vacantAccounts: VacantTokenAccount[];
  totalRecoverableRent: bigint;
  tokenAccounts: SolanaTokenAccount[];
}

// Token Program IDs
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

// Rent-exempt minimum for token accounts (~0.00203928 SOL)
const TOKEN_ACCOUNT_RENT_LAMPORTS = 2039280n;

/**
 * Solana Scanner
 * Uses Helius DAS API for token account discovery
 */
export class SolanaScanner implements ChainScanner {
  chain: SupportedChain = "solana";

  protected getHeliusUrl(): string {
    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      throw new Error("HELIUS_API_KEY not configured");
    }
    return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  }

  /**
   * Fetch all token accounts using Helius DAS API (getAssetsByOwner)
   */
  private async fetchTokenAccounts(address: string): Promise<HeliusAsset[]> {
    const url = this.getHeliusUrl();
    const allAssets: HeliusAsset[] = [];
    let page = 1;
    const limit = 1000;

    // Paginate through all assets
    while (true) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `assets-${page}`,
          method: "getAssetsByOwner",
          params: {
            ownerAddress: address,
            page,
            limit,
            displayOptions: {
              showFungible: true,
              showNativeBalance: true,
            },
          },
        }),
      });

      const data = await response.json() as { error?: { message: string }; result: HeliusGetAssetsByOwnerResponse };

      if (data.error) {
        throw new Error(`Helius error: ${data.error.message}`);
      }

      const result: HeliusGetAssetsByOwnerResponse = data.result;
      
      // Filter for fungible tokens only (exclude NFTs)
      const fungibleAssets = result.items.filter(
        (asset) =>
          asset.interface === "FungibleToken" ||
          asset.interface === "FungibleAsset"
      );

      allAssets.push(...fungibleAssets);

      // Check if we need to fetch more pages
      if (result.items.length < limit) {
        break;
      }
      page++;
    }

    return allAssets;
  }

  /**
   * Fetch native SOL balance
   */
  private async fetchNativeBalance(address: string): Promise<bigint> {
    const url = this.getHeliusUrl();

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "balance",
        method: "getBalance",
        params: [address],
      }),
    });

    const data = await response.json() as { error?: { message: string }; result: { value: number } };

    if (data.error) {
      throw new Error(`Helius error: ${data.error.message}`);
    }

    return BigInt(data.result.value);
  }

  /**
   * Get SOL price
   */
  private async getSolPrice(): Promise<number> {
    // Wrapped SOL address for price lookup
    const wsolAddress = "So11111111111111111111111111111111111111112";
    const priceData = await getValidatedPrice(wsolAddress, "solana");
    return priceData.price;
  }

  /**
   * Convert Helius asset to WalletToken
   */
  private async assetToToken(asset: HeliusAsset): Promise<WalletToken | null> {
    const tokenInfo = asset.token_info;
    if (!tokenInfo || tokenInfo.balance === 0) {
      return null;
    }

    const decimals = tokenInfo.decimals || 0;
    const balance = BigInt(Math.floor(tokenInfo.balance));
    const balanceFormatted = (tokenInfo.balance / Math.pow(10, decimals)).toString();

    // Use Helius price if available, otherwise fetch from price service
    let valueUsd = tokenInfo.price_info?.total_price || 0;
    
    if (valueUsd === 0) {
      try {
        const priceData = await getValidatedPrice(asset.id, "solana");
        valueUsd = parseFloat(balanceFormatted) * priceData.price;
      } catch {
        // Price not available
        valueUsd = 0;
      }
    }

    const isDust = valueUsd < DUST_THRESHOLD_USD && valueUsd > 0;

    return {
      address: asset.id,
      symbol: asset.content.metadata.symbol || "???",
      name: asset.content.metadata.name || "Unknown Token",
      decimals,
      balance: balance.toString(),
      balanceFormatted,
      valueUsd,
      isDust,
      logoUrl: asset.content.links?.image,
    };
  }

  /**
   * Main scan function - scans Solana wallet for all SPL tokens
   */
  async scan(address: string): Promise<ChainBalance> {
    // Fetch token accounts and native balance in parallel
    const [assets, nativeBalance, solPrice] = await Promise.all([
      this.fetchTokenAccounts(address),
      this.fetchNativeBalance(address),
      this.getSolPrice(),
    ]);

    // Convert assets to tokens
    const tokenPromises = assets.map((asset) => this.assetToToken(asset));
    const tokensWithNulls = await Promise.all(tokenPromises);
    
    // Filter out null tokens
    const tokens = tokensWithNulls.filter((t): t is WalletToken => t !== null);

    // Calculate native SOL value (9 decimals on Solana)
    const nativeBalanceFormatted = (Number(nativeBalance) / 1e9).toString();
    const nativeValueUsd = parseFloat(nativeBalanceFormatted) * solPrice;

    // Calculate totals
    const totalValueUsd = tokens.reduce((sum, t) => sum + t.valueUsd, 0) + nativeValueUsd;
    const dustTokens = tokens.filter((t) => t.isDust);
    const dustValueUsd = dustTokens.reduce((sum, t) => sum + t.valueUsd, 0);

    return {
      chain: "solana",
      address: address,
      tokens,
      nativeBalance: nativeBalance.toString(),
      nativeValueUsd,
      totalValueUsd,
      dustValueUsd,
      dustTokenCount: dustTokens.length,
      scannedAt: Date.now(),
    };
  }
}

// Export singleton instance
export const solanaScanner = new SolanaScanner();

// ============================================================
// Extended Solana Scanner with Vacant Account Detection
// ============================================================

export class ExtendedSolanaScanner extends SolanaScanner {
  /**
   * Fetch all token accounts including vacant ones using Helius RPC
   */
  async fetchAllTokenAccounts(address: string): Promise<{
    accounts: SolanaTokenAccount[];
    vacantAccounts: VacantTokenAccount[];
  }> {
    const url = this.getHeliusUrl();
    const accounts: SolanaTokenAccount[] = [];
    const vacantAccounts: VacantTokenAccount[] = [];

    // Fetch for both token programs
    for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
      const isToken2022 = programId === TOKEN_2022_PROGRAM_ID;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `token-accounts-${programId}`,
          method: "getTokenAccountsByOwner",
          params: [
            address,
            { programId },
            {
              encoding: "jsonParsed",
              commitment: "confirmed",
            },
          ],
        }),
      });

      const data = (await response.json()) as {
        error?: { message: string };
        result: {
          value: Array<{
            pubkey: string;
            account: {
              data: {
                parsed: {
                  info: {
                    mint: string;
                    owner: string;
                    tokenAmount: {
                      amount: string;
                      decimals: number;
                      uiAmount: number;
                    };
                  };
                  type: string;
                };
                program: string;
              };
              lamports: number;
            };
          }>;
        };
      };

      if (data.error) {
        console.error(`Error fetching ${programId} accounts:`, data.error.message);
        continue;
      }

      for (const item of data.result.value) {
        const parsedInfo = item.account.data.parsed.info;
        const balance = BigInt(parsedInfo.tokenAmount.amount);
        const rentLamports = BigInt(item.account.lamports);

        const accountData: SolanaTokenAccount = {
          address: item.pubkey,
          mint: parsedInfo.mint,
          owner: parsedInfo.owner,
          balance,
          decimals: parsedInfo.tokenAmount.decimals,
          rentLamports,
          isToken2022,
          programId,
        };

        accounts.push(accountData);

        // Check if this is a vacant account (zero balance)
        if (balance === 0n) {
          vacantAccounts.push({
            address: item.pubkey,
            mint: parsedInfo.mint,
            owner: parsedInfo.owner,
            rentLamports,
            isToken2022,
            programId,
          });
        }
      }
    }

    return { accounts, vacantAccounts };
  }

  /**
   * Calculate total recoverable rent from vacant accounts
   */
  calculateRecoverableRent(vacantAccounts: VacantTokenAccount[]): bigint {
    return vacantAccounts.reduce(
      (total, account) => total + account.rentLamports,
      0n
    );
  }

  /**
   * Get token metadata for multiple mints
   */
  async getTokenMetadata(
    mints: string[]
  ): Promise<Map<string, { name: string; symbol: string; logoUri?: string }>> {
    const url = this.getHeliusUrl();
    const metadataMap = new Map<
      string,
      { name: string; symbol: string; logoUri?: string }
    >();

    // Batch requests in chunks of 100
    const chunkSize = 100;
    for (let i = 0; i < mints.length; i += chunkSize) {
      const chunk = mints.slice(i, i + chunkSize);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `metadata-batch-${i}`,
          method: "getAssetBatch",
          params: {
            ids: chunk,
          },
        }),
      });

      const data = (await response.json()) as {
        error?: { message: string };
        result: Array<{
          id: string;
          content?: {
            metadata?: {
              name: string;
              symbol: string;
            };
            links?: {
              image?: string;
            };
          };
        }>;
      };

      if (!data.error && data.result) {
        for (const asset of data.result) {
          if (asset.content?.metadata) {
            metadataMap.set(asset.id, {
              name: asset.content.metadata.name || "Unknown",
              symbol: asset.content.metadata.symbol || "???",
              logoUri: asset.content.links?.image,
            });
          }
        }
      }
    }

    return metadataMap;
  }

  /**
   * Extended scan function - includes vacant account detection
   */
  async scanExtended(address: string): Promise<SolanaScanResult> {
    // Fetch all data in parallel
    const [basicScan, tokenAccountsResult, solPrice] = await Promise.all([
      this.scan(address),
      this.fetchAllTokenAccounts(address),
      this.getSolPrice(),
    ]);

    const { accounts, vacantAccounts } = tokenAccountsResult;
    const totalRecoverableRent = this.calculateRecoverableRent(vacantAccounts);

    // Calculate recoverable rent in USD
    const recoverableRentSol = Number(totalRecoverableRent) / 1e9;
    const recoverableRentUsd = recoverableRentSol * solPrice;

    return {
      ...basicScan,
      vacantAccounts,
      totalRecoverableRent,
      tokenAccounts: accounts,
      // Add recoverable rent to dust value
      dustValueUsd: basicScan.dustValueUsd + recoverableRentUsd,
    };
  }

  /**
   * Make getSolPrice accessible to extended methods
   */
  async getSolPrice(): Promise<number> {
    const wsolAddress = "So11111111111111111111111111111111111111112";
    const priceData = await getValidatedPrice(wsolAddress, "solana");
    return priceData.price;
  }
}

// Export extended scanner instance
export const extendedSolanaScanner = new ExtendedSolanaScanner();