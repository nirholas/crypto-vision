import { erc20Abi, formatUnits, type Address } from "viem";
import { getViemClient } from "../utils/viem.js";
import { CHAIN_CONFIG, type SupportedChain } from "../config/chains.js";
import type { TokenBalance } from "../types/index.js";
import { cacheGetOrFetch } from "../utils/redis.js";

const ERC20_ABI = erc20Abi;

// Well-known token lists
const TOKEN_LISTS: Record<string, string> = {
  ethereum: "https://tokens.coingecko.com/uniswap/all.json",
  base: "https://tokens.coingecko.com/base/all.json",
  arbitrum: "https://tokens.coingecko.com/arbitrum-one/all.json",
  polygon: "https://tokens.coingecko.com/polygon-pos/all.json",
  bsc: "https://tokens.coingecko.com/binance-smart-chain/all.json",
  optimism: "https://tokens.coingecko.com/optimistic-ethereum/all.json",
};

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

// ============================================================
// Wallet Balance Scanner
// ============================================================

export async function getWalletTokenBalances(
  walletAddress: Address,
  chain: Exclude<SupportedChain, "solana">
): Promise<TokenBalance[]> {
  const client = getViemClient(chain);
  const config = CHAIN_CONFIG[chain];

  // Get token list for this chain
  const tokens = await getTokenList(chain);

  // Batch multicall to get all balances
  const balanceCalls = tokens.map((token) => ({
    address: token.address as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [walletAddress],
  }));

  // Split into chunks of 100 to avoid RPC limits
  const chunkSize = 100;
  const results: TokenBalance[] = [];

  for (let i = 0; i < balanceCalls.length; i += chunkSize) {
    const chunk = balanceCalls.slice(i, i + chunkSize);
    const tokenChunk = tokens.slice(i, i + chunkSize);

    try {
      const balances = await client.multicall({
        contracts: chunk,
        allowFailure: true,
      });

      for (let j = 0; j < balances.length; j++) {
        const result = balances[j];
        const token = tokenChunk[j];

        if (result.status === "success" && result.result) {
          const balance = result.result as bigint;

          if (balance > 0n) {
            results.push({
              address: token.address,
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals,
              balance: balance.toString(),
              chain,
            });
          }
        }
      }
    } catch (e) {
      console.error(`Error fetching balances for chunk ${i}:`, e);
    }
  }

  // Also get native token balance
  const nativeBalance = await client.getBalance({ address: walletAddress });
  if (nativeBalance > 0n) {
    results.push({
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // Native token placeholder
      symbol: config.nativeToken,
      name: config.nativeToken,
      decimals: 18,
      balance: nativeBalance.toString(),
      chain,
    });
  }

  return results;
}

// ============================================================
// Multi-Chain Scanner
// ============================================================

export async function scanAllChains(
  walletAddress: Address
): Promise<Record<string, TokenBalance[]>> {
  const chains = Object.keys(CHAIN_CONFIG) as Exclude<SupportedChain, "solana">[];

  const results = await Promise.allSettled(
    chains.map(async (chain) => {
      try {
        const balances = await getWalletTokenBalances(walletAddress, chain);
        return { chain, balances };
      } catch (e) {
        console.error(`Error scanning ${chain}:`, e);
        return { chain, balances: [] };
      }
    })
  );

  const output: Record<string, TokenBalance[]> = {};

  for (const result of results) {
    if (result.status === "fulfilled") {
      output[result.value.chain] = result.value.balances;
    }
  }

  return output;
}

// ============================================================
// Token List Management
// ============================================================

async function getTokenList(chain: string): Promise<TokenInfo[]> {
  const cacheKey = `token-list:${chain}`;

  return cacheGetOrFetch(cacheKey, async () => {
    const url = TOKEN_LISTS[chain];
    if (!url) return [];

    try {
      const response = await fetch(url);
      const data = await response.json() as { tokens?: Array<{ address: string; symbol: string; name: string; decimals: number }> };

      return (data.tokens || []).map((t: any) => ({
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
      }));
    } catch (e) {
      console.error(`Error fetching token list for ${chain}:`, e);
      return [];
    }
  }, 86400); // Cache for 24 hours
}

// ============================================================
// Alchemy Enhanced API (faster, if available)
// ============================================================

export async function getWalletTokenBalancesAlchemy(
  walletAddress: Address,
  chain: Exclude<SupportedChain, "solana">
): Promise<TokenBalance[]> {
  const alchemyKey = process.env.ALCHEMY_API_KEY;
  if (!alchemyKey) {
    // Fall back to multicall method
    return getWalletTokenBalances(walletAddress, chain);
  }

  const alchemyChain = getAlchemyChainName(chain);
  const url = `https://${alchemyChain}.g.alchemy.com/v2/${alchemyKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "alchemy_getTokenBalances",
        params: [walletAddress, "erc20"],
        id: 1,
      }),
    });

    const data = await response.json() as { result?: { tokenBalances?: Array<{ contractAddress: string; tokenBalance: string }> } };
    const tokenBalances = data.result?.tokenBalances || [];

    // Filter non-zero balances and get metadata
    const nonZero = tokenBalances.filter(
      (t: any) => t.tokenBalance !== "0x0" && t.tokenBalance !== "0x"
    );

    // Get token metadata in parallel
    const results: TokenBalance[] = await Promise.all(
      nonZero.map(async (t: any) => {
        const metadata = await getTokenMetadata(t.contractAddress, chain);
        return {
          address: t.contractAddress,
          symbol: metadata?.symbol || "UNKNOWN",
          name: metadata?.name || "Unknown Token",
          decimals: metadata?.decimals || 18,
          balance: BigInt(t.tokenBalance).toString(),
          chain,
        };
      })
    );

    return results;
  } catch (e) {
    console.error(`Alchemy API error for ${chain}:`, e);
    return getWalletTokenBalances(walletAddress, chain);
  }
}

async function getTokenMetadata(
  tokenAddress: Address,
  chain: Exclude<SupportedChain, "solana">
): Promise<TokenInfo | null> {
  const cacheKey = `token-metadata:${chain}:${tokenAddress.toLowerCase()}`;

  return cacheGetOrFetch(cacheKey, async () => {
    const client = getViemClient(chain);

    try {
      const [symbol, name, decimals] = await Promise.all([
        client.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "symbol",
        }),
        client.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "name",
        }),
        client.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "decimals",
        }),
      ]);

      return {
        address: tokenAddress,
        symbol: symbol as string,
        name: name as string,
        decimals: decimals as number,
      };
    } catch {
      return null;
    }
  }, 86400);
}

function getAlchemyChainName(chain: string): string {
  const mapping: Record<string, string> = {
    ethereum: "eth-mainnet",
    base: "base-mainnet",
    arbitrum: "arb-mainnet",
    polygon: "polygon-mainnet",
    optimism: "opt-mainnet",
  };
  return mapping[chain] || "eth-mainnet";
}
