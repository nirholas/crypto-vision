/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { normalize } from 'viem/ens';
import { getPublicClient } from './clients.js';
import { type Address } from 'viem';

/**
 * Resolves an ENS name to an Ethereum address or returns the original address if it's already valid
 * @param addressOrEns An Ethereum address or ENS name
 * @param network The network to use for ENS resolution (defaults to Ethereum mainnet)
 * @returns The resolved Ethereum address
 */
export async function resolveAddress(
  addressOrEns: string,
  network = 'ethereum'
): Promise<Address> {
  // If it's already a valid Ethereum address (0x followed by 40 hex chars), return it
  if (/^0x[a-fA-F0-9]{40}$/.test(addressOrEns)) {
    return addressOrEns as Address;
  }

  // If it looks like an ENS name (contains a dot), try to resolve it
  if (addressOrEns.includes('.')) {
    try {
      // Normalize the ENS name first
      const normalizedEns = normalize(addressOrEns);
      
      // Get the public client for the network
      const publicClient = getPublicClient(network);
      
      // Resolve the ENS name to an address
      const address = await publicClient.getEnsAddress({
        name: normalizedEns,
      });
      
      if (!address) {
        throw new Error(`ENS name ${addressOrEns} could not be resolved to an address`);
      }
      
      return address;
    } catch (error: any) {
      throw new Error(`Failed to resolve ENS name ${addressOrEns}: ${error.message}`);
    }
  }
  
  // If it's neither a valid address nor an ENS name, throw an error
  throw new Error(`Invalid address or ENS name: ${addressOrEns}`);
} 