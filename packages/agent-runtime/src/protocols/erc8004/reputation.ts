/**
 * ERC-8004 Reputation Management
 *
 * Query and submit reputation feedback on-chain.
 */

import { type ChainConfig, resolveChain } from '../../utils/chains.js';
import {
  reputationRegistry,
  createSigner,
  createProvider,
} from '../../utils/contracts.js';
import type { Feedback, ReputationSummary } from './types.js';

export class ReputationManager {
  private readonly chain: ChainConfig;
  private readonly privateKey?: string;

  constructor(chain: string | number, privateKey?: string) {
    this.chain = resolveChain(chain);
    this.privateKey = privateKey;
  }

  /**
   * Get reputation summary for an agent.
   */
  async getSummary(agentId: number): Promise<ReputationSummary> {
    const registry = reputationRegistry(this.chain);

    const [feedbackCount, averageScore] = await Promise.all([
      registry.getFeedbackCount(agentId),
      registry.getAverageScore(agentId),
    ]);

    const count = Number(feedbackCount);
    const recentCount = Math.min(count, 10);
    const recentFeedback: Feedback[] = [];

    for (let i = count - recentCount; i < count; i++) {
      const [reviewer, score, comment, timestamp] =
        await registry.getFeedback(agentId, i);
      recentFeedback.push({
        reviewer,
        score: Number(score),
        comment,
        timestamp: Number(timestamp),
      });
    }

    return {
      agentId,
      averageScore: Number(averageScore),
      feedbackCount: count,
      recentFeedback,
    };
  }

  /**
   * Submit feedback for an agent.
   */
  async submitFeedback(
    agentId: number,
    score: number,
    comment: string
  ): Promise<string> {
    if (!this.privateKey) {
      throw new Error('Private key required to submit feedback');
    }
    if (score < -128 || score > 127) {
      throw new Error('Score must be between -128 and 127');
    }

    const signer = createSigner(this.privateKey, this.chain);
    const registry = reputationRegistry(this.chain, signer);

    const tx = await registry.submitFeedback(agentId, score, comment);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Get the average score for an agent.
   */
  async getAverageScore(agentId: number): Promise<number> {
    const registry = reputationRegistry(this.chain);
    const score = await registry.getAverageScore(agentId);
    return Number(score);
  }

  /**
   * Get total feedback count for an agent.
   */
  async getFeedbackCount(agentId: number): Promise<number> {
    const registry = reputationRegistry(this.chain);
    const count = await registry.getFeedbackCount(agentId);
    return Number(count);
  }
}
