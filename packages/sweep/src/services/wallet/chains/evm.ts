import { createPublicClient, http, formatUnits, type Address, type PublicClient } from "viem";
import type { SupportedChain } from "../../../config/chains.js";
import { CHAIN_CONFIG } from "../../../config/chains.js";
import { getValidatedPrice } from "../../price.service.js";
import {
  type ChainBalance,
  type ChainScanner,
  type WalletToken,
  type AlchemyGetTokenBalancesResponse,
  type AlchemyTokenMetadata,
  DUST_THRESHOLD_USD,
} from "../types.js";

// ============================================================
// Base EVM Chain Scanner
// ============================================================

export abstract class EVMChainScanner implements ChainScanner {
  abstract chain: SupportedChain;
  protected client: PublicClient | null = null;

  protected abstract getAlchemyUrl(): string;
  protected abstract getRpcUrl(): string;

  protected getClient(): PublicClient {
    if (!this.client) {
      const config = CHAIN_CONFIG[this.chain as keyof typeof CHAIN_CONFIG];
      this.client = createPublicClient({
        chain: config.chain,
        transport: http(this.getRpcUrl()),
      });
    }
    return this.client;
  }

  /**
   * Fetch token balances using Alchemy's alchemy_getTokenBalances
   */
  protected async fetchTokenBalances(address: string): Promise<AlchemyGetTokenBalancesResponse> {
    const url = this.getAlchemyUrl();
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getTokenBalances",
        params: [address, "erc20"],
      }),
    });

    const data = await response.json() as { error?: { message: string }; result: AlchemyGetTokenBalancesResponse };
    
    if (data.error) {
      throw new Error(`Alchemy error: ${data.error.message}`);
    }

    return data.result;
  }

  /**
   * Fetch token metadata (name, symbol, decimals)
   */
  protected async fetchTokenMetadata(tokenAddress: string): Promise<AlchemyTokenMetadata> {
    const url = this.getAlchemyUrl();
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getTokenMetadata",
        params: [tokenAddress],
      }),
    });

    const data = await response.json() as { error?: { message: string }; result: AlchemyTokenMetadata };
    
    if (data.error) {
      // Fallback to defaults if metadata fetch fails
      return {
        name: "Unknown Token",
        symbol: "???",
        decimals: 18,
      };
    }

    return data.result;
  }

  /**
   * Fetch native token balance (ETH, MATIC, BNB, etc.)
   */
  protected async fetchNativeBalance(address: string): Promise<bigint> {
    const client = this.getClient();
    return client.getBalance({ address: address as Address });
  }

  /**
   * Get USD price for native token
   */
  protected async getNativeTokenPrice(): Promise<number> {
    // Use wrapped native token address for price lookup
    const wrappedNativeAddresses: Record<string, string> = {
      ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      base: "0x4200000000000000000000000000000000000006", // WETH
      arbitrum: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
      polygon: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
      bsc: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
      linea: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f", // WETH
      optimism: "0x4200000000000000000000000000000000000006", // WETH
    };

    const wrappedAddress = wrappedNativeAddresses[this.chain];
    if (!wrappedAddress) return 0;

    const priceData = await getValidatedPrice(wrappedAddress, this.chain);
    return priceData.price;
  }

  /**
   * Main scan function - scans wallet for all ERC-20 tokens
   */
  async scan(address: string): Promise<ChainBalance> {
    
    // Fetch token balances and native balance in parallel
    const [tokenBalancesResponse, nativeBalance, nativePrice] = await Promise.all([
      this.fetchTokenBalances(address),
      this.fetchNativeBalance(address),
      this.getNativeTokenPrice(),
    ]);

    // Filter out zero balances
    const nonZeroBalances = tokenBalancesResponse.tokenBalances.filter(
      (tb) => tb.tokenBalance && tb.tokenBalance !== "0x0" && BigInt(tb.tokenBalance) > 0n
    );

    // Fetch metadata and prices for all tokens in parallel
    const tokenPromises = nonZeroBalances.map(async (tb) => {
      const [metadata, priceData] = await Promise.all([
        this.fetchTokenMetadata(tb.contractAddress),
        getValidatedPrice(tb.contractAddress, this.chain),
      ]);

      const balance = BigInt(tb.tokenBalance);
      const balanceFormatted = formatUnits(balance, metadata.decimals);
      const valueUsd = parseFloat(balanceFormatted) * priceData.price;
      const isDust = valueUsd < DUST_THRESHOLD_USD && valueUsd > 0;

      const token: WalletToken = {
        address: tb.contractAddress.toLowerCase(),
        symbol: metadata.symbol,
        name: metadata.name,
        decimals: metadata.decimals,
        balance: balance.toString(),
        balanceFormatted,
        valueUsd,
        isDust,
        logoUrl: metadata.logo,
      };

      return token;
    });

    const tokens = await Promise.all(tokenPromises);

    // Filter out tokens with zero value (price couldn't be fetched)
    const validTokens = tokens.filter((t) => t.valueUsd > 0 || BigInt(t.balance) > 0n);

    // Calculate native token value
    const nativeBalanceFormatted = formatUnits(nativeBalance, 18);
    const nativeValueUsd = parseFloat(nativeBalanceFormatted) * nativePrice;

    // Calculate totals
    const totalValueUsd = validTokens.reduce((sum, t) => sum + t.valueUsd, 0) + nativeValueUsd;
    const dustTokens = validTokens.filter((t) => t.isDust);
    const dustValueUsd = dustTokens.reduce((sum, t) => sum + t.valueUsd, 0);

    return {
      chain: this.chain,
      address: address.toLowerCase(),
      tokens: validTokens,
      nativeBalance: nativeBalance.toString(),
      nativeValueUsd,
      totalValueUsd,
      dustValueUsd,
      dustTokenCount: dustTokens.length,
      scannedAt: Date.now(),
    };
  }
}

// ============================================================
// Generic Infura-based Scanner (for chains not on Alchemy)
// ============================================================

export abstract class InfuraEVMScanner extends EVMChainScanner {
  /**
   * For Infura chains, we use eth_call to query ERC-20 balances directly
   * since Infura doesn't have alchemy_getTokenBalances
   */
  protected async fetchTokenBalances(address: string): Promise<AlchemyGetTokenBalancesResponse> {
    // For BSC and other non-Alchemy chains, we need to use a different approach
    // Using block explorer APIs to get token list, then query balances
    const config = CHAIN_CONFIG[this.chain as keyof typeof CHAIN_CONFIG];
    const apiKey = process.env[`${this.chain.toUpperCase()}_SCAN_API_KEY`] || "";
    
    const url = `${config.blockExplorerApi}?module=account&action=tokentx&address=${address}&startblock=0&endblock=999999999&sort=desc&apikey=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json() as { status: string; result?: Array<{ contractAddress: string }> };
    
    if (data.status !== "1" || !data.result) {
      return { address, tokenBalances: [] };
    }

    // Get unique token addresses from transaction history
    const uniqueTokens = new Set<string>();
    for (const tx of data.result.slice(0, 100)) { // Limit to recent 100 txs
      uniqueTokens.add(tx.contractAddress.toLowerCase());
    }

    // Query current balance for each token
    const client = this.getClient();
    const balancePromises = Array.from(uniqueTokens).map(async (tokenAddress) => {
      try {
        const balance = await client.readContract({
          address: tokenAddress as Address,
          abi: [
            {
              name: "balanceOf",
              type: "function",
              inputs: [{ name: "account", type: "address" }],
              outputs: [{ name: "", type: "uint256" }],
              stateMutability: "view",
            },
          ],
          functionName: "balanceOf",
          args: [address as Address],
        });
        
        return {
          contractAddress: tokenAddress,
          tokenBalance: `0x${(balance as bigint).toString(16)}`,
        };
      } catch {
        return null;
      }
    });

    const balances = await Promise.all(balancePromises);
    const validBalances = balances.filter((b): b is NonNullable<typeof b> => b !== null);

    return {
      address,
      tokenBalances: validBalances,
    };
  }

  protected async fetchTokenMetadata(tokenAddress: string): Promise<AlchemyTokenMetadata> {
    const client = this.getClient();
    
    try {
      const [name, symbol, decimals] = await Promise.all([
        client.readContract({
          address: tokenAddress as Address,
          abi: [{ name: "name", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }],
          functionName: "name",
        }),
        client.readContract({
          address: tokenAddress as Address,
          abi: [{ name: "symbol", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }],
          functionName: "symbol",
        }),
        client.readContract({
          address: tokenAddress as Address,
          abi: [{ name: "decimals", type: "function", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" }],
          functionName: "decimals",
        }),
      ]);

      return {
        name: name as string,
        symbol: symbol as string,
        decimals: Number(decimals),
      };
    } catch {
      return {
        name: "Unknown Token",
        symbol: "???",
        decimals: 18,
      };
    }
  }
}
