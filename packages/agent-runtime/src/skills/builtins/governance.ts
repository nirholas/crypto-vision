/**
 * Governance Skills — DAO Voting, Proposal Creation, Delegation
 *
 * Interact with on-chain governance systems (OpenZeppelin Governor, Snapshot).
 */

import type { Skill, SkillHandler } from '../types.js';
import type { DataPart, TaskSendParams } from '../../protocols/a2a/types.js';

function extractParams(params: TaskSendParams): Record<string, unknown> {
  for (const part of params.message?.parts ?? []) {
    if (part.type === 'data') return (part as DataPart).data;
    if (part.type === 'text') {
      try { return JSON.parse(part.text) as Record<string, unknown>; } catch { /* continue */ }
    }
  }
  return {};
}

// ─── Cast Vote Skill ───────────────────────────────────────────────

const castVoteHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { governor, proposalId, support, reason } = data;

  if (!governor || !proposalId || support === undefined) {
    return { status: 'failed', message: 'Missing required parameters: governor, proposalId, support' };
  }

  context.logger.info('Casting governance vote', {
    governor: String(governor), proposalId: String(proposalId), support: Number(support),
  });

  try {
    const { ethers } = await import('ethers');
    const rpcUrls: Record<string, string> = {
      'bsc': 'https://bsc-dataseed1.binance.org',
      'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
    };
    const provider = new ethers.JsonRpcProvider(rpcUrls[context.chain] ?? rpcUrls['bsc']);
    const wallet = new ethers.Wallet(context.privateKey, provider);

    const governorAbi = reason
      ? ['function castVoteWithReason(uint256 proposalId, uint8 support, string reason) returns (uint256)']
      : ['function castVote(uint256 proposalId, uint8 support) returns (uint256)'];

    const contract = new ethers.Contract(String(governor), governorAbi, wallet);

    const tx = reason
      ? await contract.castVoteWithReason(BigInt(String(proposalId)), Number(support), String(reason))
      : await contract.castVote(BigInt(String(proposalId)), Number(support));

    const receipt = await tx.wait();

    const supportLabels: Record<number, string> = { 0: 'Against', 1: 'For', 2: 'Abstain' };

    return {
      status: 'completed',
      result: {
        transactionHash: receipt.hash,
        governor: String(governor),
        proposalId: String(proposalId),
        vote: supportLabels[Number(support)] ?? String(support),
        reason: reason ? String(reason) : null,
        voter: wallet.address,
        chain: context.chain,
      },
      message: `Voted "${supportLabels[Number(support)] ?? support}" on proposal ${proposalId}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Vote failed: ${message}` };
  }
};

// ─── Get Proposal Info Skill ───────────────────────────────────────

const proposalInfoHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { governor, proposalId } = data;

  if (!governor || !proposalId) {
    return { status: 'failed', message: 'Missing required parameters: governor, proposalId' };
  }

  try {
    const { ethers } = await import('ethers');
    const rpcUrls: Record<string, string> = {
      'bsc': 'https://bsc-dataseed1.binance.org',
      'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
    };
    const provider = new ethers.JsonRpcProvider(rpcUrls[context.chain] ?? rpcUrls['bsc']);

    const governorAbi = [
      'function state(uint256 proposalId) view returns (uint8)',
      'function proposalVotes(uint256 proposalId) view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)',
      'function proposalDeadline(uint256 proposalId) view returns (uint256)',
      'function proposalSnapshot(uint256 proposalId) view returns (uint256)',
    ];

    const contract = new ethers.Contract(String(governor), governorAbi, provider);
    const pid = BigInt(String(proposalId));

    const state = await contract.state(pid) as number;
    const [againstVotes, forVotes, abstainVotes] = await contract.proposalVotes(pid) as [bigint, bigint, bigint];
    const deadline = await contract.proposalDeadline(pid) as bigint;
    const snapshot = await contract.proposalSnapshot(pid) as bigint;

    const stateLabels: Record<number, string> = {
      0: 'Pending', 1: 'Active', 2: 'Canceled', 3: 'Defeated',
      4: 'Succeeded', 5: 'Queued', 6: 'Expired', 7: 'Executed',
    };

    const totalVotes = forVotes + againstVotes + abstainVotes;

    return {
      status: 'completed',
      result: {
        governor: String(governor),
        proposalId: String(proposalId),
        state: stateLabels[state] ?? `Unknown (${state})`,
        votes: {
          for: ethers.formatEther(forVotes),
          against: ethers.formatEther(againstVotes),
          abstain: ethers.formatEther(abstainVotes),
          total: ethers.formatEther(totalVotes),
          forPercent: totalVotes > 0n ? Number((forVotes * 10000n) / totalVotes) / 100 : 0,
        },
        snapshot: snapshot.toString(),
        deadline: deadline.toString(),
        chain: context.chain,
        timestamp: new Date().toISOString(),
      },
      message: `Proposal ${proposalId}: ${stateLabels[state]} — For: ${Number(ethers.formatEther(forVotes)).toFixed(0)}, Against: ${Number(ethers.formatEther(againstVotes)).toFixed(0)}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Proposal info failed: ${message}` };
  }
};

// ─── Delegate Voting Power Skill ───────────────────────────────────

const delegateHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { token, delegatee } = data;

  if (!token || !delegatee) {
    return { status: 'failed', message: 'Missing required parameters: token, delegatee' };
  }

  context.logger.info('Delegating voting power', {
    token: String(token), delegatee: String(delegatee),
  });

  try {
    const { ethers } = await import('ethers');
    const rpcUrls: Record<string, string> = {
      'bsc': 'https://bsc-dataseed1.binance.org',
      'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
    };
    const provider = new ethers.JsonRpcProvider(rpcUrls[context.chain] ?? rpcUrls['bsc']);
    const wallet = new ethers.Wallet(context.privateKey, provider);

    const tokenAbi = [
      'function delegate(address delegatee)',
      'function delegates(address account) view returns (address)',
      'function getVotes(address account) view returns (uint256)',
    ];

    const contract = new ethers.Contract(String(token), tokenAbi, wallet);
    const tx = await contract.delegate(String(delegatee));
    const receipt = await tx.wait();

    // Check new delegation
    const newDelegate = await contract.delegates(wallet.address) as string;
    const votes = await contract.getVotes(String(delegatee)) as bigint;

    return {
      status: 'completed',
      result: {
        transactionHash: receipt.hash,
        token: String(token),
        from: wallet.address,
        delegatee: String(delegatee),
        confirmedDelegate: newDelegate,
        delegateVotingPower: ethers.formatEther(votes),
        chain: context.chain,
      },
      message: `Delegated voting power to ${String(delegatee).slice(0, 10)}...`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Delegation failed: ${message}` };
  }
};

// ─── Skill Definitions ─────────────────────────────────────────────

export const castVoteSkill: Skill = {
  definition: {
    id: 'governance/vote',
    name: 'Cast Vote',
    description: 'Cast a vote on an on-chain governance proposal (OpenZeppelin Governor compatible). Supports For, Against, and Abstain with optional reason.',
    category: 'governance',
    version: '1.0.0',
    tags: ['governance', 'vote', 'dao', 'proposal'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet', 'ethereum'],
    parameters: {
      governor: { type: 'string', description: 'Governor contract address', required: true },
      proposalId: { type: 'string', description: 'Proposal ID', required: true },
      support: { type: 'number', description: '0 = Against, 1 = For, 2 = Abstain', required: true },
      reason: { type: 'string', description: 'Optional vote reason' },
    },
    requiredConfig: ['PRIVATE_KEY'],
  },
  handler: castVoteHandler,
};

export const proposalInfoSkill: Skill = {
  definition: {
    id: 'governance/proposal-info',
    name: 'Proposal Info',
    description: 'Get detailed information about a governance proposal: state, vote counts, deadline, and participation.',
    category: 'governance',
    version: '1.0.0',
    tags: ['governance', 'proposal', 'info', 'dao'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet', 'ethereum'],
    parameters: {
      governor: { type: 'string', description: 'Governor contract address', required: true },
      proposalId: { type: 'string', description: 'Proposal ID', required: true },
    },
  },
  handler: proposalInfoHandler,
};

export const delegateSkill: Skill = {
  definition: {
    id: 'governance/delegate',
    name: 'Delegate Voting Power',
    description: 'Delegate your governance token voting power to another address.',
    category: 'governance',
    version: '1.0.0',
    tags: ['governance', 'delegate', 'voting-power', 'dao'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet', 'ethereum'],
    parameters: {
      token: { type: 'string', description: 'Governance token address', required: true },
      delegatee: { type: 'string', description: 'Address to delegate to', required: true },
    },
    requiredConfig: ['PRIVATE_KEY'],
  },
  handler: delegateHandler,
};

/** All governance skills */
export const governanceSkills: Skill[] = [
  castVoteSkill,
  proposalInfoSkill,
  delegateSkill,
];
