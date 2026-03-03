import { createPublicClient, http, type PublicClient } from "viem";
import { CHAIN_CONFIG, type SupportedChain } from "../config/chains.js";

const clients = new Map<string, PublicClient>();

export function getViemClient(chain: Exclude<SupportedChain, "solana">): PublicClient {
  const existing = clients.get(chain);
  if (existing) return existing;

  const config = CHAIN_CONFIG[chain];
  const rpcUrl = process.env[config.rpcEnvKey];

  if (!rpcUrl) {
    throw new Error(`Missing RPC URL for chain: ${chain}. Set ${config.rpcEnvKey} env var.`);
  }

  const client = createPublicClient({
    chain: config.chain,
    transport: http(rpcUrl),
    batch: {
      multicall: true,
    },
  });

  clients.set(chain, client);
  return client;
}

export function getAllClients(): Map<string, PublicClient> {
  const chains = Object.keys(CHAIN_CONFIG) as Exclude<SupportedChain, "solana">[];
  
  for (const chain of chains) {
    try {
      getViemClient(chain);
    } catch {
      // Skip chains without configured RPC
    }
  }
  
  return clients;
}
