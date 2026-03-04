/**
 * Wallet Skills — Send Tokens, Gas Estimation, ENS/Space ID Resolution
 *
 * Core wallet operations for BNB Chain agents.
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

// ─── Send Native Token Skill ───────────────────────────────────────

const sendNativeHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { to, amount } = data;

  if (!to || !amount) {
    return { status: 'failed', message: 'Missing required parameters: to, amount' };
  }

  context.logger.info('Sending native token', {
    to: String(to), amount: String(amount), chain: context.chain,
  });

  try {
    const { ethers } = await import('ethers');
    const rpcUrls: Record<string, string> = {
      'bsc': 'https://bsc-dataseed1.binance.org',
      'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
      'opbnb': 'https://opbnb-mainnet-rpc.bnbchain.org',
      'ethereum': 'https://eth.llamarpc.com',
    };

    const provider = new ethers.JsonRpcProvider(rpcUrls[context.chain] ?? rpcUrls['bsc']);
    const wallet = new ethers.Wallet(context.privateKey, provider);

    const tx = await wallet.sendTransaction({
      to: String(to),
      value: ethers.parseEther(String(amount)),
    });
    const receipt = await tx.wait();

    if (!receipt) {
      return { status: 'failed', message: 'Transaction receipt not received' };
    }

    return {
      status: 'completed',
      result: {
        transactionHash: receipt.hash,
        from: wallet.address,
        to: String(to),
        amount: String(amount),
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        chain: context.chain,
      },
      message: `Sent ${amount} native tokens to ${String(to).slice(0, 10)}...`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Send failed: ${message}` };
  }
};

// ─── Send ERC-20 Token Skill ───────────────────────────────────────

const sendTokenHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { token, to, amount } = data;

  if (!token || !to || !amount) {
    return { status: 'failed', message: 'Missing required parameters: token, to, amount' };
  }

  context.logger.info('Sending ERC-20 token', {
    token: String(token), to: String(to), amount: String(amount),
  });

  try {
    const { ethers } = await import('ethers');
    const rpcUrls: Record<string, string> = {
      'bsc': 'https://bsc-dataseed1.binance.org',
      'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
      'opbnb': 'https://opbnb-mainnet-rpc.bnbchain.org',
      'ethereum': 'https://eth.llamarpc.com',
    };

    const provider = new ethers.JsonRpcProvider(rpcUrls[context.chain] ?? rpcUrls['bsc']);
    const wallet = new ethers.Wallet(context.privateKey, provider);

    const erc20Abi = [
      'function transfer(address to, uint256 amount) returns (bool)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)',
      'function balanceOf(address) view returns (uint256)',
    ];

    const contract = new ethers.Contract(String(token), erc20Abi, wallet);

    // Get token info
    let decimals = 18;
    let symbol = 'TOKEN';
    try { decimals = Number(await contract.decimals()); } catch { /* default */ }
    try { symbol = await contract.symbol() as string; } catch { /* default */ }

    // Check balance
    const balance = await contract.balanceOf(wallet.address) as bigint;
    const transferAmount = ethers.parseUnits(String(amount), decimals);

    if (balance < transferAmount) {
      return {
        status: 'failed',
        message: `Insufficient ${symbol} balance: ${ethers.formatUnits(balance, decimals)} < ${amount}`,
      };
    }

    const tx = await contract.transfer(String(to), transferAmount);
    const receipt = await tx.wait();

    return {
      status: 'completed',
      result: {
        transactionHash: receipt.hash,
        token: String(token),
        symbol,
        from: wallet.address,
        to: String(to),
        amount: String(amount),
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        chain: context.chain,
      },
      message: `Sent ${amount} ${symbol} to ${String(to).slice(0, 10)}...`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Token send failed: ${message}` };
  }
};

// ─── Gas Estimator Skill ───────────────────────────────────────────

const gasEstimateHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { to, value = '0', calldata = '0x' } = data;

  context.logger.info('Estimating gas', { to: String(to ?? 'new-contract') });

  try {
    const { ethers } = await import('ethers');
    const rpcUrls: Record<string, string> = {
      'bsc': 'https://bsc-dataseed1.binance.org',
      'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
      'opbnb': 'https://opbnb-mainnet-rpc.bnbchain.org',
      'ethereum': 'https://eth.llamarpc.com',
    };

    const provider = new ethers.JsonRpcProvider(rpcUrls[context.chain] ?? rpcUrls['bsc']);

    // Get current gas price
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? 0n;

    // Estimate gas for the transaction
    const txRequest: Record<string, unknown> = {
      from: context.agentAddress,
      data: String(calldata),
    };
    if (to) txRequest.to = String(to);
    if (value !== '0') txRequest.value = ethers.parseEther(String(value));

    let gasEstimate = 21000n; // Default for simple transfer
    try {
      gasEstimate = await provider.estimateGas(txRequest);
    } catch {
      // Use default if estimation fails
    }

    const gasCostWei = gasEstimate * gasPrice;

    return {
      status: 'completed',
      result: {
        gasEstimate: gasEstimate.toString(),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
        gasCostNative: ethers.formatEther(gasCostWei),
        gasCostGwei: ethers.formatUnits(gasCostWei, 'gwei'),
        maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') : null,
        maxPriorityFee: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : null,
        chain: context.chain,
        timestamp: new Date().toISOString(),
      },
      message: `Gas estimate: ${gasEstimate.toString()} units × ${ethers.formatUnits(gasPrice, 'gwei')} gwei = ${ethers.formatEther(gasCostWei)} native`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Gas estimation failed: ${message}` };
  }
};

// ─── Resolve Name Skill (Space ID / ENS) ───────────────────────────

const resolveNameHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { name } = data;

  if (!name) {
    return { status: 'failed', message: 'Missing required parameter: name' };
  }

  const domainName = String(name);
  context.logger.info('Resolving name', { name: domainName });

  try {
    const { ethers } = await import('ethers');

    // Determine resolver based on TLD
    if (domainName.endsWith('.bnb')) {
      // Space ID resolver on BSC
      const provider = new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org');
      const spaceIdAddress = '0x08CEd32a7f3eeC915Ba84415e9C07a7286977956';
      const resolverAbi = [
        'function addr(bytes32 node) view returns (address)',
      ];

      const resolver = new ethers.Contract(spaceIdAddress, resolverAbi, provider);
      const nameHash = ethers.namehash(domainName);
      const address = await resolver.addr(nameHash) as string;

      return {
        status: 'completed',
        result: {
          name: domainName,
          address,
          resolver: 'Space ID',
          chain: 'bsc',
          timestamp: new Date().toISOString(),
        },
        message: `${domainName} → ${address}`,
      };
    } else if (domainName.endsWith('.eth')) {
      // ENS resolver on Ethereum
      const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
      const address = await provider.resolveName(domainName);

      return {
        status: 'completed',
        result: {
          name: domainName,
          address: address ?? 'not-resolved',
          resolver: 'ENS',
          chain: 'ethereum',
          timestamp: new Date().toISOString(),
        },
        message: address ? `${domainName} → ${address}` : `${domainName} not found`,
      };
    }

    return {
      status: 'failed',
      message: `Unsupported TLD for domain: ${domainName}. Supported: .bnb, .eth`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Name resolution failed: ${message}` };
  }
};

// ─── Skill Definitions ─────────────────────────────────────────────

export const sendNativeSkill: Skill = {
  definition: {
    id: 'wallet/send-native',
    name: 'Send Native Token',
    description: 'Send native tokens (BNB, ETH) to an address.',
    category: 'wallet',
    version: '1.0.0',
    tags: ['send', 'transfer', 'native', 'bnb', 'eth'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet', 'opbnb', 'ethereum'],
    parameters: {
      to: { type: 'string', description: 'Recipient address', required: true },
      amount: { type: 'string', description: 'Amount to send', required: true },
    },
    requiredConfig: ['PRIVATE_KEY'],
  },
  handler: sendNativeHandler,
};

export const sendTokenSkill: Skill = {
  definition: {
    id: 'wallet/send-token',
    name: 'Send ERC-20 Token',
    description: 'Send ERC-20 tokens to an address. Automatically handles decimals and balance checks.',
    category: 'wallet',
    version: '1.0.0',
    tags: ['send', 'transfer', 'erc20', 'token'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet', 'opbnb', 'ethereum'],
    parameters: {
      token: { type: 'string', description: 'Token contract address', required: true },
      to: { type: 'string', description: 'Recipient address', required: true },
      amount: { type: 'string', description: 'Amount to send', required: true },
    },
    requiredConfig: ['PRIVATE_KEY'],
  },
  handler: sendTokenHandler,
};

export const gasEstimateSkill: Skill = {
  definition: {
    id: 'wallet/gas-estimate',
    name: 'Gas Estimator',
    description: 'Estimate gas cost for a transaction. Returns gas units, gas price, and total cost in native tokens.',
    category: 'wallet',
    version: '1.0.0',
    tags: ['gas', 'estimate', 'fee', 'cost'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet', 'opbnb', 'ethereum'],
    parameters: {
      to: { type: 'string', description: 'Contract/recipient address' },
      value: { type: 'string', description: 'Native value to send', default: '0' },
      calldata: { type: 'string', description: 'Transaction calldata (hex)', default: '0x' },
    },
  },
  handler: gasEstimateHandler,
};

export const resolveNameSkill: Skill = {
  definition: {
    id: 'wallet/resolve-name',
    name: 'Resolve Name',
    description: 'Resolve a blockchain domain name (.bnb via Space ID, .eth via ENS) to its wallet address.',
    category: 'wallet',
    version: '1.0.0',
    tags: ['ens', 'space-id', 'domain', 'resolution', 'name'],
    inputModes: ['application/json', 'text/plain'],
    outputModes: ['application/json'],
    chains: ['bsc', 'ethereum'],
    parameters: {
      name: { type: 'string', description: 'Domain name (e.g., vitalik.eth, binance.bnb)', required: true },
    },
  },
  handler: resolveNameHandler,
};

/** All wallet skills */
export const walletSkills: Skill[] = [
  sendNativeSkill,
  sendTokenSkill,
  gasEstimateSkill,
  resolveNameSkill,
];
