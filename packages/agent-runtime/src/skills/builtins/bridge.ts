/**
 * Bridge Skills — Cross-Chain Token Transfers
 *
 * Bridge tokens between BNB Chain, opBNB, Ethereum, and other networks
 * using Stargate, LayerZero, and the official BSC Bridge.
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

// ─── Bridge Transfer Skill ─────────────────────────────────────────

const bridgeTransferHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { token, amount, sourceChain, destChain, recipient, bridge = 'stargate' } = data;

  if (!token || !amount || !destChain) {
    return { status: 'failed', message: 'Missing required parameters: token, amount, destChain' };
  }

  const source = sourceChain ? String(sourceChain) : context.chain;
  const dest = String(destChain);
  const to = recipient ? String(recipient) : context.agentAddress;

  context.logger.info('Initiating bridge transfer', {
    token: String(token), amount: String(amount),
    from: source, to: dest, bridge: String(bridge),
  });

  try {
    const { ethers } = await import('ethers');
    const rpcUrls: Record<string, string> = {
      'bsc': 'https://bsc-dataseed1.binance.org',
      'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
      'opbnb': 'https://opbnb-mainnet-rpc.bnbchain.org',
      'ethereum': 'https://eth.llamarpc.com',
    };

    const provider = new ethers.JsonRpcProvider(rpcUrls[source] ?? rpcUrls['bsc']);
    const wallet = new ethers.Wallet(context.privateKey, provider);

    // Stargate Router
    const stargateRouterAddress = getStargateRouter(source);
    const stargateAbi = [
      'function swap(uint16 _dstChainId, uint256 _srcPoolId, uint256 _dstPoolId, address payable _refundAddress, uint256 _amountLD, uint256 _minAmountLD, tuple(uint256 dstGasForCall, uint256 dstNativeAmount, bytes dstNativeAddr) _lzTxParams, bytes _to, bytes _payload) payable',
      'function quoteLayerZeroFee(uint16 _dstChainId, uint8 _functionType, bytes _toAddress, bytes _transferAndCallPayload, tuple(uint256 dstGasForCall, uint256 dstNativeAmount, bytes dstNativeAddr) _lzTxParams) view returns (uint256, uint256)',
    ];

    const router = new ethers.Contract(stargateRouterAddress, stargateAbi, wallet);
    const transferAmount = ethers.parseUnits(String(amount), 18);
    const dstChainId = getLayerZeroChainId(dest);
    const srcPoolId = getStargatePoolId(String(token), source);
    const dstPoolId = getStargatePoolId(String(token), dest);

    // Quote LayerZero fees
    const lzTxParams = { dstGasForCall: 0n, dstNativeAmount: 0n, dstNativeAddr: '0x' };
    const [nativeFee] = await router.quoteLayerZeroFee(
      dstChainId, 1, ethers.solidityPacked(['address'], [to]), '0x', lzTxParams
    ) as [bigint, bigint];

    // Approve token for router
    const erc20Abi = ['function approve(address, uint256) returns (bool)'];
    const tokenContract = new ethers.Contract(String(token), erc20Abi, wallet);
    const approveTx = await tokenContract.approve(stargateRouterAddress, transferAmount);
    await approveTx.wait();

    // Execute bridge swap
    const tx = await router.swap(
      dstChainId, srcPoolId, dstPoolId,
      wallet.address, transferAmount,
      (transferAmount * 995n) / 1000n, // 0.5% min
      lzTxParams,
      ethers.solidityPacked(['address'], [to]),
      '0x',
      { value: nativeFee }
    );
    const receipt = await tx.wait();

    return {
      status: 'completed',
      result: {
        transactionHash: receipt.hash,
        token: String(token),
        amount: String(amount),
        sourceChain: source,
        destChain: dest,
        recipient: to,
        bridge: String(bridge),
        nativeFee: ethers.formatEther(nativeFee),
        estimatedArrival: '5-15 minutes',
        blockNumber: receipt.blockNumber,
      },
      message: `Bridged ${amount} ${token} from ${source} to ${dest} via ${bridge}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Bridge transfer failed: ${message}` };
  }
};

// ─── Bridge Quote Skill ────────────────────────────────────────────

const bridgeQuoteHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { token, amount, sourceChain, destChain, bridge = 'stargate' } = data;

  if (!token || !amount || !destChain) {
    return { status: 'failed', message: 'Missing required parameters: token, amount, destChain' };
  }

  const source = sourceChain ? String(sourceChain) : context.chain;
  const dest = String(destChain);

  try {
    const { ethers } = await import('ethers');
    const rpcUrls: Record<string, string> = {
      'bsc': 'https://bsc-dataseed1.binance.org',
      'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
      'ethereum': 'https://eth.llamarpc.com',
    };

    const provider = new ethers.JsonRpcProvider(rpcUrls[source] ?? rpcUrls['bsc']);

    const stargateRouterAddress = getStargateRouter(source);
    const stargateAbi = [
      'function quoteLayerZeroFee(uint16 _dstChainId, uint8 _functionType, bytes _toAddress, bytes _transferAndCallPayload, tuple(uint256 dstGasForCall, uint256 dstNativeAmount, bytes dstNativeAddr) _lzTxParams) view returns (uint256, uint256)',
    ];

    const router = new ethers.Contract(stargateRouterAddress, stargateAbi, provider);
    const dstChainId = getLayerZeroChainId(dest);
    const lzTxParams = { dstGasForCall: 0n, dstNativeAmount: 0n, dstNativeAddr: '0x' };

    const [nativeFee] = await router.quoteLayerZeroFee(
      dstChainId, 1,
      ethers.solidityPacked(['address'], [context.agentAddress]),
      '0x', lzTxParams
    ) as [bigint, bigint];

    return {
      status: 'completed',
      result: {
        token: String(token),
        amount: String(amount),
        sourceChain: source,
        destChain: dest,
        bridge: String(bridge),
        nativeFee: ethers.formatEther(nativeFee),
        estimatedTime: '5-15 minutes',
        bridgeFeePercent: '0.06%',
        timestamp: new Date().toISOString(),
      },
      message: `Bridge quote: ${amount} ${token} (${source} → ${dest}), fee: ${ethers.formatEther(nativeFee)} native`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Bridge quote failed: ${message}` };
  }
};

// ─── Bridge Status Skill ───────────────────────────────────────────

const bridgeStatusHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { txHash, sourceChain } = data;

  if (!txHash) {
    return { status: 'failed', message: 'Missing required parameter: txHash' };
  }

  const source = sourceChain ? String(sourceChain) : context.chain;

  try {
    const { ethers } = await import('ethers');
    const rpcUrls: Record<string, string> = {
      'bsc': 'https://bsc-dataseed1.binance.org',
      'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
      'ethereum': 'https://eth.llamarpc.com',
    };

    const provider = new ethers.JsonRpcProvider(rpcUrls[source] ?? rpcUrls['bsc']);
    const receipt = await provider.getTransactionReceipt(String(txHash));

    if (!receipt) {
      return {
        status: 'completed',
        result: {
          txHash: String(txHash),
          status: 'pending',
          sourceChain: source,
        },
        message: 'Bridge transaction is pending',
      };
    }

    return {
      status: 'completed',
      result: {
        txHash: String(txHash),
        status: receipt.status === 1 ? 'confirmed-source' : 'failed',
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        sourceChain: source,
        note: 'Destination chain delivery typically takes 5-15 minutes after source confirmation',
      },
      message: receipt.status === 1
        ? `Bridge tx confirmed on ${source}. Awaiting destination delivery.`
        : 'Bridge transaction failed on source chain',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Status check failed: ${message}` };
  }
};

// ─── Helpers ───────────────────────────────────────────────────────

function getStargateRouter(chain: string): string {
  const routers: Record<string, string> = {
    'bsc': '0x4a364f8c717cAAD9A442737Eb7b8A55cc6cf18D8',
    'bsc-testnet': '0xbB0f1be1E9CE9cB27EA5b0c3a85B7cc3381d8176',
    'ethereum': '0x8731d54E9D02c286767d56ac03e8037C07e01e98',
    'opbnb': '0x4a364f8c717cAAD9A442737Eb7b8A55cc6cf18D8',
  };
  return routers[chain] ?? routers['bsc'];
}

function getLayerZeroChainId(chain: string): number {
  const chainIds: Record<string, number> = {
    'bsc': 102, 'bsc-testnet': 10102,
    'ethereum': 101, 'sepolia': 10161,
    'opbnb': 202,
    'arbitrum': 110, 'optimism': 111,
    'polygon': 109, 'base': 184,
  };
  return chainIds[chain] ?? chainIds['bsc'];
}

function getStargatePoolId(token: string, chain: string): bigint {
  // Pool IDs for common tokens
  const poolIds: Record<string, bigint> = {
    'USDT': 2n, 'USDC': 1n, 'BUSD': 5n,
    'ETH': 13n, 'BNB': 15n,
  };
  const symbol = token.toUpperCase();
  for (const [sym, id] of Object.entries(poolIds)) {
    if (symbol.includes(sym)) return id;
  }
  return 2n; // Default USDT
}

// ─── Skill Definitions ─────────────────────────────────────────────

export const bridgeTransferSkill: Skill = {
  definition: {
    id: 'bridge/transfer',
    name: 'Bridge Transfer',
    description: 'Bridge tokens across chains using Stargate/LayerZero. Supports BSC ↔ Ethereum, opBNB, Arbitrum, Optimism, Polygon, Base.',
    category: 'bridge',
    version: '1.0.0',
    tags: ['bridge', 'cross-chain', 'stargate', 'layerzero', 'transfer'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet', 'ethereum', 'opbnb', 'arbitrum', 'optimism', 'polygon', 'base'],
    parameters: {
      token: { type: 'string', description: 'Token address on source chain', required: true },
      amount: { type: 'string', description: 'Amount to bridge', required: true },
      destChain: { type: 'string', description: 'Destination chain', required: true },
      sourceChain: { type: 'string', description: 'Source chain (defaults to agent chain)' },
      recipient: { type: 'string', description: 'Recipient address (defaults to agent)' },
      bridge: { type: 'string', description: 'Bridge protocol', default: 'stargate', enum: ['stargate', 'layerzero'] },
    },
    requiredConfig: ['PRIVATE_KEY'],
    examples: [
      {
        name: 'Bridge USDT from BSC to Ethereum',
        input: { token: '0x55d398326f99059fF775485246999027B3197955', amount: '100', destChain: 'ethereum' },
      },
    ],
  },
  handler: bridgeTransferHandler,
};

export const bridgeQuoteSkill: Skill = {
  definition: {
    id: 'bridge/quote',
    name: 'Bridge Quote',
    description: 'Get a fee quote for a cross-chain bridge transfer without executing it.',
    category: 'bridge',
    version: '1.0.0',
    tags: ['bridge', 'quote', 'fee', 'estimate'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet', 'ethereum', 'opbnb'],
    parameters: {
      token: { type: 'string', description: 'Token address', required: true },
      amount: { type: 'string', description: 'Amount', required: true },
      destChain: { type: 'string', description: 'Destination chain', required: true },
      sourceChain: { type: 'string', description: 'Source chain' },
    },
  },
  handler: bridgeQuoteHandler,
};

export const bridgeStatusSkill: Skill = {
  definition: {
    id: 'bridge/status',
    name: 'Bridge Status',
    description: 'Check the status of a pending bridge transaction by its source chain transaction hash.',
    category: 'bridge',
    version: '1.0.0',
    tags: ['bridge', 'status', 'tracking'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet', 'ethereum', 'opbnb'],
    parameters: {
      txHash: { type: 'string', description: 'Source chain transaction hash', required: true },
      sourceChain: { type: 'string', description: 'Source chain' },
    },
  },
  handler: bridgeStatusHandler,
};

/** All bridge skills */
export const bridgeSkills: Skill[] = [
  bridgeTransferSkill,
  bridgeQuoteSkill,
  bridgeStatusSkill,
];
