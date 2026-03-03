/**
 * x402 Payment Client Factory
 * @description Creates x402 clients with automatic EVM/SVM signer detection
 * @author nirholas
 * @license Apache-2.0
 * 
 * This module wraps the official @x402/* packages to provide:
 * - Unified client creation for both EVM and Solana
 * - Auto-detection of chain type from CAIP-2 identifiers
 * - Automatic axios/fetch wrapping for 402 payment handling
 * 
 * @example
 * ```typescript
 * import { createX402Client, wrapAxios } from "@/x402/client.js"
 * 
 * // Create client with auto-detected signers
 * const client = await createX402Client()
 * 
 * // Wrap axios for automatic payment handling
 * const api = wrapAxios(axios.create(), client)
 * const response = await api.get('https://api.example.com/paid-endpoint')
 * ```
 */

import axios, { type AxiosInstance } from "axios"
import { privateKeyToAccount } from "viem/accounts"
import { x402Client as X402CoreClient } from "@x402/core/client"
import { wrapAxiosWithPayment } from "@x402/axios"
import { wrapFetchWithPayment } from "@x402/fetch"
import { ExactEvmScheme, toClientEvmSigner, type ClientEvmSigner } from "@x402/evm"
import { ExactSvmScheme, toClientSvmSigner, type ClientSvmSigner } from "@x402/svm"
import bs58 from "bs58"

import {
  loadX402Config,
  isEvmConfigured,
  isSvmConfigured,
  getChainType,
  getCaip2FromChain,
  getChainFromCaip2,
  EVM_CHAINS,
  SVM_CHAINS,
  SUPPORTED_CHAINS,
  type X402Network,
  type X402Config,
} from "./config.js"
import Logger from "@/utils/logger.js"

// ============================================================================
// Types
// ============================================================================

/**
 * Payment policy function type (filter/transform payment requirements)
 */
export type PaymentPolicy = (x402Version: number, paymentRequirements: unknown[]) => unknown[]

/**
 * Options for creating an x402 client
 */
export interface CreateX402ClientOptions {
  /** Override config (uses env vars if not provided) */
  config?: Partial<X402Config>
  /** Specific networks to enable (enables all configured by default) */
  networks?: X402Network[]
  /** Custom payment policies */
  policies?: PaymentPolicy[]
}

/**
 * Wrapper around the x402 client with additional utilities
 */
export interface X402ClientWrapper {
  /** The underlying x402 client */
  client: X402CoreClient
  /** Configured EVM signer (if available) */
  evmSigner?: ClientEvmSigner
  /** Configured SVM signer (if available) */
  svmSigner?: ClientSvmSigner
  /** List of registered network CAIP-2 identifiers */
  registeredNetworks: string[]
  /** Create an axios instance wrapped with payment handling */
  wrapAxios: (axiosInstance?: AxiosInstance) => AxiosInstance
  /** Create a fetch function wrapped with payment handling */
  wrapFetch: (fetchFn?: typeof fetch) => typeof fetch
  /** Check if a network is registered */
  hasNetwork: (network: X402Network | string) => boolean
}

// ============================================================================
// Signer Creation
// ============================================================================

/**
 * Create an EVM signer from a private key
 */
export function createEvmSigner(privateKey: `0x${string}`): ClientEvmSigner {
  const account = privateKeyToAccount(privateKey)
  return toClientEvmSigner(account)
}

/**
 * Create an SVM (Solana) signer from a base58 private key
 */
export function createSvmSigner(privateKeyBase58: string): ClientSvmSigner {
  // Decode base58 private key to bytes
  const privateKeyBytes = bs58.decode(privateKeyBase58)
  return toClientSvmSigner(privateKeyBytes)
}

// ============================================================================
// Chain Detection
// ============================================================================

/**
 * Detect chain type from a CAIP-2 identifier
 * 
 * @example
 * detectChainType("eip155:8453")  // "evm"
 * detectChainType("solana:mainnet")  // "svm"
 */
export function detectChainType(caip2: string): "evm" | "svm" {
  if (caip2.startsWith("eip155:")) {
    return "evm"
  }
  if (caip2.startsWith("solana:")) {
    return "svm"
  }
  // Default to EVM for unknown identifiers
  return "evm"
}

/**
 * Check if a CAIP-2 identifier matches any supported EVM network
 */
export function isEvmNetwork(caip2: string): boolean {
  // Check for wildcard
  if (caip2 === "eip155:*") return true
  
  // Check specific networks
  for (const config of Object.values(EVM_CHAINS)) {
    if (config.caip2 === caip2) return true
  }
  
  // Check if it's an EIP-155 format
  return caip2.startsWith("eip155:")
}

/**
 * Check if a CAIP-2 identifier matches any supported SVM network
 */
export function isSvmNetwork(caip2: string): boolean {
  // Check for wildcard
  if (caip2 === "solana:*") return true
  
  // Check specific networks
  for (const config of Object.values(SVM_CHAINS)) {
    if (config.caip2 === caip2) return true
  }
  
  // Check if it's a Solana format
  return caip2.startsWith("solana:")
}

// ============================================================================
// Client Creation
// ============================================================================

/**
 * Create an x402 client with automatic EVM and SVM signer configuration
 * 
 * The client will:
 * 1. Load configuration from environment variables
 * 2. Create signers for configured keys (EVM and/or Solana)
 * 3. Register appropriate payment schemes for each network
 * 4. Support both v1 and v2 of the x402 protocol
 * 
 * @example
 * ```typescript
 * // Basic usage - uses environment variables
 * const { client, wrapAxios } = await createX402Client()
 * 
 * // With custom options
 * const { client } = await createX402Client({
 *   networks: ['base', 'solana-mainnet'],
 *   config: { maxPaymentPerRequest: '5.00' }
 * })
 * ```
 */
export async function createX402Client(
  options: CreateX402ClientOptions = {}
): Promise<X402ClientWrapper> {
  const config = { ...loadX402Config(), ...options.config }
  const registeredNetworks: string[] = []

  // Determine which networks to enable
  const enabledNetworks = options.networks || (Object.keys(SUPPORTED_CHAINS) as X402Network[])
  
  // Create the base client
  const client = new X402CoreClient()

  // Create signers
  let evmSigner: ClientEvmSigner | undefined
  let svmSigner: ClientSvmSigner | undefined

  // Setup EVM signer if configured
  if (config.evmPrivateKey && isEvmConfigured()) {
    try {
      evmSigner = createEvmSigner(config.evmPrivateKey)
      Logger.debug("x402: EVM signer created")
    } catch (error) {
      Logger.error("x402: Failed to create EVM signer:", error)
    }
  }

  // Setup SVM signer if configured
  if (config.svmPrivateKey && isSvmConfigured()) {
    try {
      svmSigner = createSvmSigner(config.svmPrivateKey)
      Logger.debug("x402: SVM signer created")
    } catch (error) {
      Logger.error("x402: Failed to create SVM signer:", error)
    }
  }

  // Register EVM networks
  if (evmSigner) {
    for (const network of enabledNetworks) {
      const chainConfig = SUPPORTED_CHAINS[network]
      if (chainConfig?.chainType === "evm") {
        const scheme = new ExactEvmScheme(evmSigner)
        client.register(chainConfig.caip2 as `eip155:${string}`, scheme)
        registeredNetworks.push(chainConfig.caip2)
        Logger.debug(`x402: Registered EVM network ${network} (${chainConfig.caip2})`)
      }
    }
    
    // Also register wildcard for any EVM network
    const evmScheme = new ExactEvmScheme(evmSigner)
    client.register("eip155:*", evmScheme)
  }

  // Register SVM networks
  if (svmSigner) {
    for (const network of enabledNetworks) {
      const chainConfig = SUPPORTED_CHAINS[network]
      if (chainConfig?.chainType === "svm") {
        const scheme = new ExactSvmScheme(svmSigner)
        client.register(chainConfig.caip2 as `solana:${string}`, scheme)
        registeredNetworks.push(chainConfig.caip2)
        Logger.debug(`x402: Registered SVM network ${network} (${chainConfig.caip2})`)
      }
    }
    
    // Also register wildcard for any Solana network
    const svmScheme = new ExactSvmScheme(svmSigner)
    client.register("solana:*", svmScheme)
  }

  // Apply custom policies
  if (options.policies) {
    for (const policy of options.policies) {
      client.registerPolicy(policy)
    }
  }

  // Create wrapper functions
  const wrapAxiosFn = (axiosInstance?: AxiosInstance): AxiosInstance => {
    const instance = axiosInstance || axios.create()
    return wrapAxiosWithPayment(instance, client)
  }

  const wrapFetchFn = (fetchFn?: typeof fetch): typeof fetch => {
    return wrapFetchWithPayment(fetchFn || globalThis.fetch, client)
  }

  const hasNetwork = (network: X402Network | string): boolean => {
    const caip2 = network.includes(":") ? network : getCaip2FromChain(network as X402Network)
    return registeredNetworks.includes(caip2)
  }

  return {
    client,
    evmSigner,
    svmSigner,
    registeredNetworks,
    wrapAxios: wrapAxiosFn,
    wrapFetch: wrapFetchFn,
    hasNetwork,
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create an axios instance wrapped with automatic 402 payment handling
 * 
 * @example
 * ```typescript
 * const api = await createPaymentAxios()
 * const response = await api.get('https://api.example.com/paid-endpoint')
 * ```
 */
export async function createPaymentAxios(
  options: CreateX402ClientOptions = {}
): Promise<AxiosInstance> {
  const { wrapAxios } = await createX402Client(options)
  return wrapAxios()
}

/**
 * Create a fetch function wrapped with automatic 402 payment handling
 * 
 * @example
 * ```typescript
 * const fetchWithPay = await createPaymentFetch()
 * const response = await fetchWithPay('https://api.example.com/paid-endpoint')
 * ```
 */
export async function createPaymentFetch(
  options: CreateX402ClientOptions = {}
): Promise<typeof fetch> {
  const { wrapFetch } = await createX402Client(options)
  return wrapFetch()
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _defaultClient: X402ClientWrapper | null = null

/**
 * Get or create the default x402 client singleton
 * 
 * Uses environment variables for configuration.
 * Call resetDefaultClient() to force recreation.
 */
export async function getDefaultClient(): Promise<X402ClientWrapper> {
  if (!_defaultClient) {
    _defaultClient = await createX402Client()
  }
  return _defaultClient
}

/**
 * Reset the default client singleton
 * 
 * Useful when environment variables change or for testing.
 */
export function resetDefaultClient(): void {
  _defaultClient = null
}

// ============================================================================
// Re-exports from @x402 packages
// ============================================================================

export { X402CoreClient as x402Client }
export { wrapAxiosWithPayment, wrapFetchWithPayment }
export { ExactEvmScheme, toClientEvmSigner }
export { ExactSvmScheme, toClientSvmSigner }
export type { ClientEvmSigner, ClientSvmSigner }
