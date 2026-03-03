/**
 * ERC-8004 Agent Identity Management
 *
 * Handles on-chain agent registration, URI management, and metadata.
 */

import { ethers } from 'ethers';
import { type ChainConfig, resolveChain } from '../../utils/chains.js';
import {
  identityRegistry,
  createSigner,
  encodeAsDataURI,
} from '../../utils/contracts.js';
import type {
  AgentIdentity,
  ERC8004Registration,
  ERC8004Service,
  TrustModel,
  MetadataEntry,
} from './types.js';

export interface IdentityManagerConfig {
  privateKey: string;
  chain: string | number;
}

export class IdentityManager {
  private readonly signer: ethers.Wallet;
  private readonly chain: ChainConfig;
  private readonly registry: ethers.Contract;
  private _agentId: number | null = null;

  constructor(config: IdentityManagerConfig) {
    this.chain = resolveChain(config.chain);
    this.signer = createSigner(config.privateKey, this.chain);
    this.registry = identityRegistry(this.chain, this.signer);
  }

  get address(): string {
    return this.signer.address;
  }

  get agentId(): number | null {
    return this._agentId;
  }

  get chainConfig(): ChainConfig {
    return this.chain;
  }

  /**
   * Register a new agent on-chain with ERC-8004 registration JSON.
   */
  async register(params: {
    name: string;
    description: string;
    image?: string;
    services?: ERC8004Service[];
    x402Support?: boolean;
    trust?: TrustModel[];
    metadata?: MetadataEntry[];
  }): Promise<AgentIdentity> {
    // Build registration JSON
    const registration: ERC8004Registration = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: params.name,
      description: params.description,
      image: params.image,
      services: params.services ?? [],
      x402Support: params.x402Support ?? false,
      active: true,
      registrations: [], // Will be populated after registration
      supportedTrust: params.trust ?? ['reputation'],
    };

    const agentURI = encodeAsDataURI(registration as unknown as Record<string, unknown>);

    let tx: ethers.ContractTransactionResponse;
    if (params.metadata && params.metadata.length > 0) {
      const metadataEntries = params.metadata.map((m) => ({
        metadataKey: m.metadataKey,
        metadataValue: ethers.toUtf8Bytes(m.metadataValue),
      }));
      tx = await this.registry['register(string,tuple(string,bytes)[])'](
        agentURI,
        metadataEntries
      );
    } else {
      tx = await this.registry['register(string)'](agentURI);
    }

    const receipt = await tx.wait();
    if (!receipt) throw new Error('Transaction failed: no receipt');

    // Extract agentId from Registered event
    const registeredEvent = receipt.logs
      .map((log: ethers.Log) => {
        try {
          return this.registry.interface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });
        } catch {
          return null;
        }
      })
      .find((e: ethers.LogDescription | null) => e?.name === 'Registered');

    if (!registeredEvent) {
      throw new Error('Registration event not found in transaction receipt');
    }

    this._agentId = Number(registeredEvent.args[0]);

    // Update registration with on-chain data
    registration.registrations = [
      {
        agentId: this._agentId,
        agentRegistry: this.chain.agentRegistry,
      },
    ];

    // Update URI with populated registration
    const updatedURI = encodeAsDataURI(registration as unknown as Record<string, unknown>);
    const updateTx = await this.registry.setAgentURI(this._agentId, updatedURI);
    await updateTx.wait();

    return {
      agentId: this._agentId,
      owner: this.signer.address,
      agentURI: updatedURI,
      chain: this.chain.name,
      registrationData: registration,
    };
  }

  /**
   * Check if the current wallet already has a registered agent.
   */
  async getExistingAgent(): Promise<AgentIdentity | null> {
    try {
      const balance = await this.registry.balanceOf(this.signer.address);
      if (Number(balance) === 0) return null;

      // Find the agent's token by checking Transfer events
      const filter = this.registry.filters.Transfer(
        ethers.ZeroAddress,
        this.signer.address
      );
      const events = await this.registry.queryFilter(filter);
      if (events.length === 0) return null;

      const latestEvent = events[events.length - 1];
      const parsedLog = this.registry.interface.parseLog({
        topics: [...latestEvent.topics],
        data: latestEvent.data,
      });
      if (!parsedLog) return null;

      const agentId = Number(parsedLog.args[2]); // tokenId
      this._agentId = agentId;

      const agentURI = await this.registry.tokenURI(agentId);

      return {
        agentId,
        owner: this.signer.address,
        agentURI,
        chain: this.chain.name,
      };
    } catch {
      return null;
    }
  }

  /**
   * Update the agent's URI on-chain.
   */
  async updateURI(registration: ERC8004Registration): Promise<void> {
    if (!this._agentId) throw new Error('No agent registered');
    const uri = encodeAsDataURI(registration as unknown as Record<string, unknown>);
    const tx = await this.registry.setAgentURI(this._agentId, uri);
    await tx.wait();
  }

  /**
   * Set metadata on the agent.
   */
  async setMetadata(key: string, value: string): Promise<void> {
    if (!this._agentId) throw new Error('No agent registered');
    const tx = await this.registry.setMetadata(
      this._agentId,
      key,
      ethers.toUtf8Bytes(value)
    );
    await tx.wait();
  }

  /**
   * Get metadata from the agent.
   */
  async getMetadata(key: string): Promise<string | null> {
    if (!this._agentId) throw new Error('No agent registered');
    try {
      const data = await this.registry.getMetadata(this._agentId, key);
      return ethers.toUtf8String(data);
    } catch {
      return null;
    }
  }
}
