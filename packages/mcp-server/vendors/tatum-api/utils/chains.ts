/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
/**
 * Chain protocol mapping utility
 */

export interface ChainApiConfig {
  basePathPrefix?: string;
  defaultEndpoints?: string[];
  errorHandling?: 'strict' | 'lenient';
  responseFormat?: 'json' | 'text' | 'binary';
}

export const chainProtocolMap: Record<string, 'rest' | 'jsonrpc'> = {
  // REST-based chains
  'ton-mainnet': 'rest',
  'ton-testnet': 'rest',
  'stellar-mainnet': 'rest',
  'stellar-testnet': 'rest',
  'algorand-mainnet': 'rest',
  'algorand-testnet': 'rest',
  'cardano-mainnet': 'rest',
  'cardano-testnet': 'rest',
  'flow-mainnet': 'rest',
  'flow-testnet': 'rest',
  'kadena-mainnet': 'rest',
  'kadena-testnet': 'rest',
  'tezos-mainnet': 'rest',
  'tezos-testnet': 'rest',
  'vechain-mainnet': 'rest',
  'vechain-testnet': 'rest',

  // JSON-RPC based chains
  'ethereum-mainnet': 'jsonrpc',
  'ethereum-sepolia': 'jsonrpc',
  'ethereum-holesky': 'jsonrpc',
  'polygon-mainnet': 'jsonrpc',
  'polygon-amoy': 'jsonrpc',
  'bsc-mainnet': 'jsonrpc',
  'bsc-testnet': 'jsonrpc',
  'avalanche-mainnet': 'jsonrpc',
  'avalanche-testnet': 'jsonrpc',
  'fantom-mainnet': 'jsonrpc',
  'fantom-testnet': 'jsonrpc',
  'celo-mainnet': 'jsonrpc',
  'celo-testnet': 'jsonrpc',
  'cronos-mainnet': 'jsonrpc',
  'cronos-testnet': 'jsonrpc',
  'klaytn-mainnet': 'jsonrpc',
  'klaytn-testnet': 'jsonrpc',
  'flare-mainnet': 'jsonrpc',
  'flare-testnet': 'jsonrpc',
  'haqq-mainnet': 'jsonrpc',
  'haqq-testnet': 'jsonrpc',
  'arbitrum-mainnet': 'jsonrpc',
  'arbitrum-testnet': 'jsonrpc',
  'optimism-mainnet': 'jsonrpc',
  'optimism-testnet': 'jsonrpc',
  'base-mainnet': 'jsonrpc',
  'base-testnet': 'jsonrpc',
  'bitcoin-mainnet': 'jsonrpc',
  'bitcoin-testnet': 'jsonrpc',
  'litecoin-mainnet': 'jsonrpc',
  'litecoin-testnet': 'jsonrpc',
  'dogecoin-mainnet': 'jsonrpc',
  'dogecoin-testnet': 'jsonrpc',
  'zcash-mainnet': 'jsonrpc',
  'zcash-testnet': 'jsonrpc',
  'solana-mainnet': 'jsonrpc',
  'solana-testnet': 'jsonrpc',
  'tron-mainnet': 'jsonrpc',
  'tron-testnet': 'jsonrpc'
};

/**
 * Chain-specific API configurations
 */
export const chainApiConfigs: Record<string, ChainApiConfig> = {
  'cardano-mainnet': {
    basePathPrefix: '/api/v0',
    defaultEndpoints: ['/blocks/latest', '/epochs/latest', '/network'],
    errorHandling: 'strict',
    responseFormat: 'json'
  },
  'cardano-testnet': {
    basePathPrefix: '/api/v0',
    defaultEndpoints: ['/blocks/latest', '/epochs/latest', '/network'],
    errorHandling: 'strict',
    responseFormat: 'json'
  },
  'flow-mainnet': {
    basePathPrefix: '/v1',
    defaultEndpoints: ['/blocks', '/network/parameters', '/node/version_info'],
    errorHandling: 'lenient',
    responseFormat: 'json'
  },
  'flow-testnet': {
    basePathPrefix: '/v1',
    defaultEndpoints: ['/blocks', '/network/parameters', '/node/version_info'],
    errorHandling: 'lenient',
    responseFormat: 'json'
  },
  'kadena-mainnet': {
    basePathPrefix: '/chainweb/0.0/mainnet01',
    defaultEndpoints: ['/config', '/cut', '/chain/0/header'],
    errorHandling: 'lenient',
    responseFormat: 'json'
  },
  'kadena-testnet': {
    basePathPrefix: '/chainweb/0.0/testnet04',
    defaultEndpoints: ['/config', '/cut', '/chain/0/header'],
    errorHandling: 'lenient',
    responseFormat: 'json'
  }
};

/**
 * Get the protocol type for a given chain
 */
export function getChainProtocol(chainName: string): 'rest' | 'jsonrpc' | undefined {
  return chainProtocolMap[chainName];
}

/**
 * Check if a chain uses REST protocol
 */
export function isRestChain(chainName: string): boolean {
  return chainProtocolMap[chainName] === 'rest';
}

/**
 * Check if a chain uses JSON-RPC protocol
 */
export function isJsonRpcChain(chainName: string): boolean {
  return chainProtocolMap[chainName] === 'jsonrpc';
}

/**
 * Get all supported chain names
 */
export function getSupportedChains(): string[] {
  return Object.keys(chainProtocolMap);
}

/**
 * Get API configuration for a specific chain
 */
export function getChainApiConfig(chainName: string): ChainApiConfig {
  return chainApiConfigs[chainName] || {
    errorHandling: 'lenient',
    responseFormat: 'json'
  };
}

/**
 * Get chains by protocol type
 */
export function getChainsByProtocol(protocol: 'rest' | 'jsonrpc'): string[] {
  return Object.entries(chainProtocolMap)
    .filter(([, proto]) => proto === protocol)
    .map(([chain]) => chain);
}