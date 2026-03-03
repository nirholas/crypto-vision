/**
 * ERC-8004 Validation Management
 *
 * Validator hook integration for attestation and verification.
 */

import { ethers } from 'ethers';
import { type ChainConfig, resolveChain } from '../../utils/chains.js';
import {
  validationRegistry,
  createSigner,
} from '../../utils/contracts.js';
import type { ValidationRecord, ValidationStatus } from './types.js';

export class ValidationManager {
  private readonly chain: ChainConfig;
  private readonly privateKey?: string;

  constructor(chain: string | number, privateKey?: string) {
    this.chain = resolveChain(chain);
    this.privateKey = privateKey;
  }

  /**
   * Check if an agent is validated for a given attestation type.
   */
  async isValidated(
    agentId: number,
    attestationType: string
  ): Promise<boolean> {
    if (!this.chain.contracts.validation) {
      throw new Error(`Validation registry not deployed on ${this.chain.name}`);
    }
    const registry = validationRegistry(this.chain);
    return registry.isValidated(agentId, attestationType);
  }

  /**
   * Get validation details for an agent.
   */
  async getValidation(
    agentId: number,
    attestationType: string
  ): Promise<ValidationRecord | null> {
    if (!this.chain.contracts.validation) {
      throw new Error(`Validation registry not deployed on ${this.chain.name}`);
    }
    const registry = validationRegistry(this.chain);
    try {
      const [validator, attestationData, timestamp] =
        await registry.getValidation(agentId, attestationType);
      return {
        validator,
        attestationType,
        attestationData: ethers.hexlify(attestationData),
        timestamp: Number(timestamp),
      };
    } catch {
      return null;
    }
  }

  /**
   * Submit a validation attestation for an agent.
   * Note: Only authorized validators can call this.
   */
  async validate(
    agentId: number,
    attestationType: string,
    attestationData: string
  ): Promise<string> {
    if (!this.privateKey) {
      throw new Error('Private key required to submit validation');
    }
    if (!this.chain.contracts.validation) {
      throw new Error(`Validation registry not deployed on ${this.chain.name}`);
    }

    const signer = createSigner(this.privateKey, this.chain);
    const registry = validationRegistry(this.chain, signer);

    const tx = await registry.validate(
      agentId,
      attestationType,
      ethers.toUtf8Bytes(attestationData)
    );
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Get full validation status for an agent across common attestation types.
   */
  async getStatus(agentId: number): Promise<ValidationStatus> {
    const commonTypes = ['identity', 'capability', 'security', 'compliance'];
    const records: ValidationRecord[] = [];

    for (const type of commonTypes) {
      try {
        const isValid = await this.isValidated(agentId, type);
        if (isValid) {
          const record = await this.getValidation(agentId, type);
          if (record) records.push(record);
        }
      } catch {
        // Skip attestation types that fail
      }
    }

    return {
      agentId,
      validated: records.length > 0,
      records,
    };
  }
}
