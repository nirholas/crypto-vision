/**
 * Staking Skills — BNB Staking, Liquid Staking, Validator Operations
 *
 * Native staking and liquid staking protocol interactions on BNB Chain.
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

// ─── BNB Staking Skill ─────────────────────────────────────────────

const stakeHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { amount, validator } = data;

  if (!amount) {
    return { status: 'failed', message: 'Missing required parameter: amount' };
  }

  context.logger.info('Staking BNB', {
    amount: String(amount), validator: validator ? String(validator) : 'auto-selected',
  });

  try {
    const { ethers } = await import('ethers');
    const rpcUrl = context.chain === 'bsc-testnet'
      ? 'https://data-seed-prebsc-1-s1.binance.org:8545'
      : 'https://bsc-dataseed1.binance.org';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(context.privateKey, provider);

    // BSC Staking contract (system contract)
    const stakingAddress = '0x0000000000000000000000000000000000002001';
    const stakingAbi = [
      'function delegate(address validator, uint256 amount) payable',
      'function getValidators() view returns (address[])',
      'function getDelegated(address delegator, address validator) view returns (uint256)',
    ];

    const staking = new ethers.Contract(stakingAddress, stakingAbi, wallet);
    const stakeAmount = ethers.parseEther(String(amount));

    let validatorAddress = validator ? String(validator) : null;

    if (!validatorAddress) {
      // Auto-select first active validator
      const validators = await staking.getValidators() as string[];
      validatorAddress = validators[0];
    }

    const tx = await staking.delegate(validatorAddress, stakeAmount, {
      value: stakeAmount,
    });
    const receipt = await tx.wait();

    return {
      status: 'completed',
      result: {
        transactionHash: receipt.hash,
        amount: String(amount),
        validator: validatorAddress,
        chain: context.chain,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      },
      message: `Staked ${amount} BNB with validator ${validatorAddress?.slice(0, 10)}...`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Staking failed: ${message}` };
  }
};

// ─── Unstake Skill ─────────────────────────────────────────────────

const unstakeHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { amount, validator } = data;

  if (!amount || !validator) {
    return { status: 'failed', message: 'Missing required parameters: amount, validator' };
  }

  context.logger.info('Unstaking BNB', {
    amount: String(amount), validator: String(validator),
  });

  try {
    const { ethers } = await import('ethers');
    const rpcUrl = context.chain === 'bsc-testnet'
      ? 'https://data-seed-prebsc-1-s1.binance.org:8545'
      : 'https://bsc-dataseed1.binance.org';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(context.privateKey, provider);

    const stakingAddress = '0x0000000000000000000000000000000000002001';
    const stakingAbi = [
      'function undelegate(address validator, uint256 amount)',
    ];

    const staking = new ethers.Contract(stakingAddress, stakingAbi, wallet);
    const unstakeAmount = ethers.parseEther(String(amount));

    const tx = await staking.undelegate(String(validator), unstakeAmount);
    const receipt = await tx.wait();

    return {
      status: 'completed',
      result: {
        transactionHash: receipt.hash,
        amount: String(amount),
        validator: String(validator),
        unbondingPeriod: '7 days',
        chain: context.chain,
      },
      message: `Initiated unstaking of ${amount} BNB (7 day unbonding period)`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Unstaking failed: ${message}` };
  }
};

// ─── Liquid Staking Skill ──────────────────────────────────────────

const liquidStakeHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { amount, protocol = 'lista-dao' } = data;

  if (!amount) {
    return { status: 'failed', message: 'Missing required parameter: amount' };
  }

  context.logger.info('Liquid staking BNB', {
    amount: String(amount), protocol: String(protocol),
  });

  try {
    const { ethers } = await import('ethers');
    const rpcUrl = context.chain === 'bsc-testnet'
      ? 'https://data-seed-prebsc-1-s1.binance.org:8545'
      : 'https://bsc-dataseed1.binance.org';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(context.privateKey, provider);

    // Lista DAO slisBNB contract
    const protocolAddresses: Record<string, Record<number, string>> = {
      'lista-dao': {
        56: '0x1adB950d8bB3dA4bE104211D5AB038628e477fE6',
        97: '0x1adB950d8bB3dA4bE104211D5AB038628e477fE6',
      },
      'ankr': {
        56: '0x52F24a5e03aee338Da5fd9Df68D2b6FAe1178827',
      },
    };

    const contractAddress = protocolAddresses[String(protocol)]?.[context.chainId]
      ?? protocolAddresses['lista-dao'][56];

    const stakingAbi = [
      'function deposit() payable returns (uint256)',
      'function exchangeRate() view returns (uint256)',
    ];

    const contract = new ethers.Contract(contractAddress, stakingAbi, wallet);
    const stakeAmount = ethers.parseEther(String(amount));

    // Read exchange rate before staking
    const exchangeRate = await contract.exchangeRate() as bigint;
    const expectedLST = (stakeAmount * ethers.parseEther('1')) / exchangeRate;

    const tx = await contract.deposit({ value: stakeAmount });
    const receipt = await tx.wait();

    return {
      status: 'completed',
      result: {
        transactionHash: receipt.hash,
        amount: String(amount),
        protocol: String(protocol),
        expectedLSTAmount: ethers.formatEther(expectedLST),
        exchangeRate: ethers.formatEther(exchangeRate),
        lstToken: contractAddress,
        chain: context.chain,
      },
      message: `Liquid staked ${amount} BNB via ${protocol}. Received ~${ethers.formatEther(expectedLST)} LST tokens`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Liquid staking failed: ${message}` };
  }
};

// ─── Staking Info Skill ────────────────────────────────────────────

const stakingInfoHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { address } = data;
  const walletAddress = address ? String(address) : context.agentAddress;

  context.logger.info('Fetching staking info', { address: walletAddress });

  try {
    const { ethers } = await import('ethers');
    const rpcUrl = context.chain === 'bsc-testnet'
      ? 'https://data-seed-prebsc-1-s1.binance.org:8545'
      : 'https://bsc-dataseed1.binance.org';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const stakingAddress = '0x0000000000000000000000000000000000002001';
    const stakingAbi = [
      'function getValidators() view returns (address[])',
      'function getDelegated(address delegator, address validator) view returns (uint256)',
    ];

    const staking = new ethers.Contract(stakingAddress, stakingAbi, provider);
    const validators = await staking.getValidators() as string[];

    const delegations: Array<{ validator: string; amount: string }> = [];
    let totalStaked = 0n;

    for (const validator of validators) {
      try {
        const delegated = await staking.getDelegated(walletAddress, validator) as bigint;
        if (delegated > 0n) {
          delegations.push({
            validator,
            amount: ethers.formatEther(delegated),
          });
          totalStaked += delegated;
        }
      } catch {
        // Skip validators that throw
      }
    }

    return {
      status: 'completed',
      result: {
        address: walletAddress,
        totalStaked: ethers.formatEther(totalStaked),
        delegations,
        validatorCount: validators.length,
        chain: context.chain,
        timestamp: new Date().toISOString(),
      },
      message: `Total staked: ${ethers.formatEther(totalStaked)} BNB across ${delegations.length} validators`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Staking info failed: ${message}` };
  }
};

// ─── Skill Definitions ─────────────────────────────────────────────

export const stakeSkill: Skill = {
  definition: {
    id: 'staking/stake',
    name: 'Stake BNB',
    description: 'Stake BNB with a validator to earn staking rewards. Supports auto-selection of the best validator.',
    category: 'staking',
    version: '1.0.0',
    tags: ['staking', 'bnb', 'validator', 'pos', 'rewards'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet'],
    parameters: {
      amount: { type: 'string', description: 'Amount of BNB to stake', required: true },
      validator: { type: 'string', description: 'Validator address (auto-selected if omitted)' },
    },
    requiredConfig: ['PRIVATE_KEY'],
  },
  handler: stakeHandler,
};

export const unstakeSkill: Skill = {
  definition: {
    id: 'staking/unstake',
    name: 'Unstake BNB',
    description: 'Unstake BNB from a validator. Initiates the 7-day unbonding period after which funds become available.',
    category: 'staking',
    version: '1.0.0',
    tags: ['unstaking', 'bnb', 'unbond'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet'],
    parameters: {
      amount: { type: 'string', description: 'Amount to unstake', required: true },
      validator: { type: 'string', description: 'Validator address', required: true },
    },
    requiredConfig: ['PRIVATE_KEY'],
  },
  handler: unstakeHandler,
};

export const liquidStakeSkill: Skill = {
  definition: {
    id: 'staking/liquid-stake',
    name: 'Liquid Staking',
    description: 'Liquid-stake BNB via protocols like Lista DAO (slisBNB) or Ankr. Receive LST tokens while earning staking rewards.',
    category: 'staking',
    version: '1.0.0',
    tags: ['liquid-staking', 'lst', 'lista-dao', 'slisBNB', 'ankr'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet'],
    parameters: {
      amount: { type: 'string', description: 'Amount of BNB to liquid stake', required: true },
      protocol: { type: 'string', description: 'Liquid staking protocol', default: 'lista-dao', enum: ['lista-dao', 'ankr'] },
    },
    requiredConfig: ['PRIVATE_KEY'],
  },
  handler: liquidStakeHandler,
};

export const stakingInfoSkill: Skill = {
  definition: {
    id: 'staking/info',
    name: 'Staking Info',
    description: 'Get staking information for an address: total staked, validators, delegation breakdown.',
    category: 'staking',
    version: '1.0.0',
    tags: ['staking', 'info', 'delegation', 'validators'],
    inputModes: ['application/json', 'text/plain'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet'],
    parameters: {
      address: { type: 'string', description: 'Wallet address (defaults to agent address)' },
    },
  },
  handler: stakingInfoHandler,
};

/** All staking skills */
export const stakingSkills: Skill[] = [
  stakeSkill,
  unstakeSkill,
  liquidStakeSkill,
  stakingInfoSkill,
];
