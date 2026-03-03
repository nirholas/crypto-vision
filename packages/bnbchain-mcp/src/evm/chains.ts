import { type Chain } from "viem"
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  // Mainnets
  bsc,
  bscTestnet,
  iotex,
  iotexTestnet,
  mainnet,
  opBNB,
  opBNBTestnet,
  optimism,
  optimismSepolia,
  polygon,
  polygonAmoy,
  // Testnets
  sepolia
} from "viem/chains"

// Default configuration values
export const DEFAULT_RPC_URL = "https://eth.llamarpc.com"
export const DEFAULT_CHAIN_ID = 1

// Map chain IDs to chains
export const chainMap: Record<number, Chain> = {
  // Mainnets
  1: mainnet,
  10: optimism,
  42161: arbitrum,
  8453: base,
  137: polygon,
  56: bsc,
  204: opBNB,
  4689: iotex,
  // Testnets
  11155111: sepolia,
  11155420: optimismSepolia,
  421614: arbitrumSepolia,
  84532: baseSepolia,
  80002: polygonAmoy,
  97: bscTestnet,
  5611: opBNBTestnet,
  4690: iotexTestnet
}

// Map network names to chain IDs for easier reference
export const networkNameMap: Record<string, number> = {
  // Mainnets
  ethereum: 1,
  mainnet: 1,
  eth: 1,
  optimism: 10,
  op: 10,
  arbitrum: 42161,
  arb: 42161,
  base: 8453,
  polygon: 137,
  matic: 137,
  binance: 56,
  bsc: 56,
  opbnb: 204,
  iotex: 4689,

  // Testnets
  sepolia: 11155111,
  "optimism-sepolia": 11155420,
  optimismsepolia: 11155420,
  "arbitrum-sepolia": 421614,
  arbitrumsepolia: 421614,
  "base-sepolia": 84532,
  basesepolia: 84532,
  "polygon-amoy": 80002,
  polygonamoy: 80002,
  "bsc-testnet": 97,
  bsctestnet: 97,
  "opbnb-testnet": 5611,
  opbnbtestnet: 5611,
  "iotex-testnet": 4690,
  iotextestnet: 4690
}

// Map chain IDs to RPC URLs
export const rpcUrlMap: Record<number, string> = {
  // Mainnets
  1: "https://eth.llamarpc.com",
  10: "https://mainnet.optimism.io",
  42161: "https://arb1.arbitrum.io/rpc",
  8453: "https://mainnet.base.org",
  137: "https://polygon-rpc.com",
  56: "https://bsc-dataseed.binance.org",
  204: "https://opbnb-mainnet-rpc.bnbchain.org",
  4689: "https://babel-api.mainnet.iotex.io",
  // Testnets
  11155111: "https://eth-sepolia.g.alchemy.com/v2/demo",
  11155420: "https://sepolia.optimism.io",
  421614: "https://sepolia-rollup.arbitrum.io/rpc",
  84532: "https://sepolia.base.org",
  80002: "https://polygon-amoy.infura.io",
  97: "https://data-seed-prebsc-1-s1.binance.org:8545",
  5611: "https://opbnb-testnet-rpc.bnbchain.org",
  4690: "https://babel-api.testnet.iotex.io"
}

/**
 * Resolves a chain identifier (number or string) to a chain ID
 * @param chainIdentifier Chain ID (number) or network name (string)
 * @returns The resolved chain ID
 */
export function resolveChainId(chainIdentifier: number | string): number {
  if (typeof chainIdentifier === "number") {
    return chainIdentifier
  }

  // Convert to lowercase for case-insensitive matching
  const networkName = chainIdentifier.toLowerCase()

  // Check if the network name is in our map
  if (networkName in networkNameMap) {
    return networkNameMap[networkName] as number
  }

  // Try parsing as a number
  const parsedId = parseInt(networkName)
  if (!isNaN(parsedId)) {
    return parsedId
  }

  // Default to mainnet if not found
  return DEFAULT_CHAIN_ID
}

/**
 * Returns the chain configuration for the specified chain ID or network name
 * @param chainIdentifier Chain ID (number) or network name (string)
 * @returns The chain configuration
 * @throws Error if the network is not supported (when string is provided)
 */
export function getChain(
  chainIdentifier: number | string = DEFAULT_CHAIN_ID
): Chain {
  if (typeof chainIdentifier === "string") {
    const networkName = chainIdentifier.toLowerCase()
    // Try to get from direct network name mapping first
    if (networkNameMap[networkName]) {
      return chainMap[networkNameMap[networkName]] || mainnet
    }

    // If not found, throw an error
    throw new Error(`Unsupported network: ${chainIdentifier}`)
  }

  // If it's a number, return the chain from chainMap
  return chainMap[chainIdentifier] || mainnet
}

/**
 * Gets the appropriate RPC URL for the specified chain ID or network name
 * @param chainIdentifier Chain ID (number) or network name (string)
 * @returns The RPC URL for the specified chain
 */
export function getRpcUrl(
  chainIdentifier: number | string = DEFAULT_CHAIN_ID
): string {
  const chainId =
    typeof chainIdentifier === "string"
      ? resolveChainId(chainIdentifier)
      : chainIdentifier

  return rpcUrlMap[chainId] || DEFAULT_RPC_URL
}

/**
 * Get a list of supported networks
 * @returns Array of supported network names (excluding short aliases)
 */
export function getSupportedNetworks(): string[] {
  return Object.keys(networkNameMap)
    .filter((name) => name.length > 2) // Filter out short aliases
    .sort()
}
