/**
 * x402 Server Setup
 *
 * Creates and configures the x402 resource server
 * for payment verification and settlement.
 * Supports multiple EVM networks (Base, Polygon, Arbitrum, Optimism, Ethereum).
 */

import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { registerExactEvmScheme } from '@x402/evm/exact/server';
import { 
  FACILITATOR_URL, 
  CURRENT_NETWORK, 
  PAYMENT_ADDRESS,
  USDC_ADDRESSES,
  getSupportedNetworks,
} from './config';

// =============================================================================
// FACILITATOR CLIENT
// =============================================================================

/**
 * HTTP Facilitator Client
 * Connects to the facilitator service for payment verification and settlement
 */
export const facilitatorClient = new HTTPFacilitatorClient({
  url: FACILITATOR_URL,
});

// =============================================================================
// RESOURCE SERVER
// =============================================================================

/**
 * x402 Resource Server
 * Handles payment verification and resource access control
 */
export const x402Server = new x402ResourceServer(facilitatorClient);

// Register EVM payment scheme for all supported networks
registerExactEvmScheme(x402Server);

// =============================================================================
// MULTI-NETWORK SUPPORT
// =============================================================================

/**
 * Supported EVM networks for payments
 */
export const SUPPORTED_EVM_NETWORKS = [
  'eip155:8453',   // Base Mainnet
  'eip155:84532',  // Base Sepolia
  'eip155:137',    // Polygon
  'eip155:42161',  // Arbitrum
  'eip155:10',     // Optimism
  'eip155:1',      // Ethereum
] as const;

/**
 * Get payment requirements for multiple networks
 * Allows users to pay on their preferred network
 */
export function getMultiNetworkPaymentRequirements(
  priceUsdc: string,
  resource: string,
  description: string,
  options: { includeTestnets?: boolean } = {}
) {
  const networks = getSupportedNetworks(options.includeTestnets);

  return {
    x402Version: 2,
    accepts: networks.map((network) => ({
      scheme: 'exact' as const,
      network: network.id,
      asset: USDC_ADDRESSES[network.id],
      payTo: PAYMENT_ADDRESS,
      maxAmountRequired: priceUsdc,
      resource,
      description,
      mimeType: 'application/json',
      maxTimeoutSeconds: 300,
      extra: {
        networkName: network.name,
        gasCost: network.gasCost,
        recommended: network.recommended,
      },
    })),
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if the server is properly configured
 */
export function isServerConfigured(): boolean {
  return Boolean(FACILITATOR_URL && CURRENT_NETWORK && PAYMENT_ADDRESS !== '0x0000000000000000000000000000000000000000');
}

/**
 * Get server status for health checks
 */
export function getServerStatus() {
  const networks = getSupportedNetworks(process.env.NODE_ENV !== 'production');

  return {
    configured: isServerConfigured(),
    facilitator: FACILITATOR_URL,
    primaryNetwork: CURRENT_NETWORK,
    supportedNetworks: networks.map((n) => ({
      id: n.id,
      name: n.name,
      testnet: n.testnet,
      recommended: n.recommended,
    })),
    supportedSchemes: ['exact'],
    paymentAddress: PAYMENT_ADDRESS,
    status: isServerConfigured() ? 'ready' : 'not_configured',
  };
}

/**
 * Verify payment is from a supported network
 */
export function isPaymentNetworkSupported(networkId: string): boolean {
  return SUPPORTED_EVM_NETWORKS.includes(networkId as typeof SUPPORTED_EVM_NETWORKS[number]);
}

/**
 * Get recommended network for payments (lowest gas)
 */
export function getRecommendedNetwork() {
  const networks = getSupportedNetworks(false);
  return networks.find((n) => n.recommended) || networks[0];
}
