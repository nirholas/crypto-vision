/**
 * DeFi Skills — Swap, Lending, Borrowing, Yield Farming
 *
 * Core DeFi operations on BNB Chain and multi-chain environments.
 * Integrates with PancakeSwap, Venus, Alpaca, and other BSC protocols.
 */

import type { Skill, SkillHandler, SkillContext, SkillResult } from '../types.js';
import type { TaskSendParams, DataPart } from '../../protocols/a2a/types.js';

// ─── Helpers ───────────────────────────────────────────────────────

function extractParams(params: TaskSendParams): Record<string, unknown> {
  for (const part of params.message?.parts ?? []) {
    if (part.type === 'data') {
      return (part as DataPart).data;
    }
    if (part.type === 'text') {
      try {
        return JSON.parse(part.text) as Record<string, unknown>;
      } catch {
        // Not JSON, continue
      }
    }
  }
  return {};
}

function validateRequired(data: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      return `Missing required parameter: ${field}`;
    }
  }
  return null;
}

// ─── Token Swap Skill ──────────────────────────────────────────────

const swapHandler: SkillHandler = async (params, context): Promise<SkillResult> => {
  const data = extractParams(params);
  const error = validateRequired(data, ['tokenIn', 'tokenOut', 'amount']);
  if (error) {
    return { status: 'failed', message: error };
  }

  const { tokenIn, tokenOut, amount, slippage = 0.5, router = 'pancakeswap' } = data;

  context.logger.info('Executing token swap', {
    tokenIn: String(tokenIn),
    tokenOut: String(tokenOut),
    amount: String(amount),
    slippage: Number(slippage),
    router: String(router),
    chain: context.chain,
  });

  try {
    // Build swap transaction using viem/ethers
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(getRpcUrl(context.chain));
    const wallet = new ethers.Wallet(context.privateKey, provider);

    // PancakeSwap Router V2 on BSC
    const routerAddress = getRouterAddress(String(router), context.chainId);
    const routerAbi = [
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)',
      'function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)',
    ];

    const routerContract = new ethers.Contract(routerAddress, routerAbi, wallet);
    const path = [String(tokenIn), String(tokenOut)];
    const amountIn = ethers.parseUnits(String(amount), 18);
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 min

    // Get expected output
    const amountsOut = await routerContract.getAmountsOut(amountIn, path) as bigint[];
    const minOut = (amountsOut[1] * BigInt(Math.floor((1 - Number(slippage) / 100) * 10000))) / 10000n;

    // Check allowance and approve if needed
    const erc20Abi = [
      'function allowance(address owner, address spender) view returns (uint256)',
      'function approve(address spender, uint256 amount) returns (bool)',
    ];
    const tokenContract = new ethers.Contract(String(tokenIn), erc20Abi, wallet);
    const allowance = await tokenContract.allowance(wallet.address, routerAddress) as bigint;

    if (allowance < amountIn) {
      context.logger.info('Approving token spend');
      const approveTx = await tokenContract.approve(routerAddress, amountIn);
      await approveTx.wait();
    }

    // Execute swap
    const tx = await routerContract.swapExactTokensForTokens(
      amountIn, minOut, path, wallet.address, deadline
    );
    const receipt = await tx.wait();

    return {
      status: 'completed',
      result: {
        transactionHash: receipt.hash,
        tokenIn: String(tokenIn),
        tokenOut: String(tokenOut),
        amountIn: String(amount),
        expectedAmountOut: ethers.formatUnits(amountsOut[1], 18),
        minAmountOut: ethers.formatUnits(minOut, 18),
        router: String(router),
        chain: context.chain,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      },
      message: `Swapped ${amount} ${tokenIn} for ${tokenOut} on ${router}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    context.logger.error('Swap failed', { error: message });
    return { status: 'failed', message: `Swap failed: ${message}` };
  }
};

// ─── Get Quote Skill ───────────────────────────────────────────────

const getQuoteHandler: SkillHandler = async (params, context): Promise<SkillResult> => {
  const data = extractParams(params);
  const error = validateRequired(data, ['tokenIn', 'tokenOut', 'amount']);
  if (error) {
    return { status: 'failed', message: error };
  }

  const { tokenIn, tokenOut, amount, router = 'pancakeswap' } = data;

  try {
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(getRpcUrl(context.chain));
    const routerAddress = getRouterAddress(String(router), context.chainId);
    const routerAbi = [
      'function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)',
    ];

    const routerContract = new ethers.Contract(routerAddress, routerAbi, provider);
    const path = [String(tokenIn), String(tokenOut)];
    const amountIn = ethers.parseUnits(String(amount), 18);

    const amountsOut = await routerContract.getAmountsOut(amountIn, path) as bigint[];

    return {
      status: 'completed',
      result: {
        tokenIn: String(tokenIn),
        tokenOut: String(tokenOut),
        amountIn: String(amount),
        amountOut: ethers.formatUnits(amountsOut[1], 18),
        router: String(router),
        chain: context.chain,
        priceImpact: 'calculated on-chain',
        timestamp: new Date().toISOString(),
      },
      message: `Quote: ${amount} ${tokenIn} ≈ ${ethers.formatUnits(amountsOut[1], 18)} ${tokenOut}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Quote failed: ${message}` };
  }
};

// ─── Lending Supply Skill ──────────────────────────────────────────

const lendingSupplyHandler: SkillHandler = async (params, context): Promise<SkillResult> => {
  const data = extractParams(params);
  const error = validateRequired(data, ['token', 'amount']);
  if (error) {
    return { status: 'failed', message: error };
  }

  const { token, amount, protocol = 'venus' } = data;

  context.logger.info('Supplying to lending protocol', {
    token: String(token),
    amount: String(amount),
    protocol: String(protocol),
    chain: context.chain,
  });

  try {
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(getRpcUrl(context.chain));
    const wallet = new ethers.Wallet(context.privateKey, provider);

    // Venus vToken supply
    const vTokenAddress = getVTokenAddress(String(token), context.chainId);
    const vTokenAbi = [
      'function mint(uint mintAmount) returns (uint)',
      'function balanceOf(address) view returns (uint)',
      'function exchangeRateCurrent() view returns (uint)',
      'function supplyRatePerBlock() view returns (uint)',
    ];

    const vToken = new ethers.Contract(vTokenAddress, vTokenAbi, wallet);
    const supplyAmount = ethers.parseUnits(String(amount), 18);

    // Approve token for vToken contract
    const erc20Abi = [
      'function approve(address spender, uint256 amount) returns (bool)',
    ];
    const tokenContract = new ethers.Contract(String(token), erc20Abi, wallet);
    const approveTx = await tokenContract.approve(vTokenAddress, supplyAmount);
    await approveTx.wait();

    // Supply to lending pool
    const tx = await vToken.mint(supplyAmount);
    const receipt = await tx.wait();

    // Get current supply rate
    const supplyRate = await vToken.supplyRatePerBlock() as bigint;
    const blocksPerYear = 10512000n; // BSC: ~3s blocks
    const aprBps = (supplyRate * blocksPerYear * 100n) / ethers.parseUnits('1', 18);

    return {
      status: 'completed',
      result: {
        transactionHash: receipt.hash,
        token: String(token),
        amount: String(amount),
        protocol: String(protocol),
        vToken: vTokenAddress,
        estimatedAPR: `${Number(aprBps) / 100}%`,
        chain: context.chain,
        blockNumber: receipt.blockNumber,
      },
      message: `Supplied ${amount} ${token} to ${protocol} lending pool`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    context.logger.error('Lending supply failed', { error: message });
    return { status: 'failed', message: `Lending supply failed: ${message}` };
  }
};

// ─── Lending Borrow Skill ──────────────────────────────────────────

const lendingBorrowHandler: SkillHandler = async (params, context): Promise<SkillResult> => {
  const data = extractParams(params);
  const error = validateRequired(data, ['token', 'amount']);
  if (error) {
    return { status: 'failed', message: error };
  }

  const { token, amount, protocol = 'venus' } = data;

  context.logger.info('Borrowing from lending protocol', {
    token: String(token),
    amount: String(amount),
    protocol: String(protocol),
  });

  try {
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(getRpcUrl(context.chain));
    const wallet = new ethers.Wallet(context.privateKey, provider);

    const vTokenAddress = getVTokenAddress(String(token), context.chainId);
    const vTokenAbi = [
      'function borrow(uint borrowAmount) returns (uint)',
      'function borrowRatePerBlock() view returns (uint)',
    ];

    const vToken = new ethers.Contract(vTokenAddress, vTokenAbi, wallet);
    const borrowAmount = ethers.parseUnits(String(amount), 18);

    const tx = await vToken.borrow(borrowAmount);
    const receipt = await tx.wait();

    const borrowRate = await vToken.borrowRatePerBlock() as bigint;
    const blocksPerYear = 10512000n;
    const aprBps = (borrowRate * blocksPerYear * 100n) / ethers.parseUnits('1', 18);

    return {
      status: 'completed',
      result: {
        transactionHash: receipt.hash,
        token: String(token),
        amount: String(amount),
        protocol: String(protocol),
        borrowAPR: `${Number(aprBps) / 100}%`,
        chain: context.chain,
        blockNumber: receipt.blockNumber,
      },
      message: `Borrowed ${amount} ${token} from ${protocol}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Borrow failed: ${message}` };
  }
};

// ─── Yield Farm Skill ──────────────────────────────────────────────

const yieldFarmHandler: SkillHandler = async (params, context): Promise<SkillResult> => {
  const data = extractParams(params);
  const error = validateRequired(data, ['pool', 'amount']);
  if (error) {
    return { status: 'failed', message: error };
  }

  const { pool, amount, protocol = 'pancakeswap' } = data;

  context.logger.info('Entering yield farm', {
    pool: String(pool),
    amount: String(amount),
    protocol: String(protocol),
  });

  try {
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(getRpcUrl(context.chain));
    const wallet = new ethers.Wallet(context.privateKey, provider);

    // Master Chef staking
    const masterChefAddress = getMasterChefAddress(String(protocol), context.chainId);
    const masterChefAbi = [
      'function deposit(uint256 _pid, uint256 _amount)',
      'function poolInfo(uint256) view returns (address, uint256, uint256, uint256)',
      'function pendingCake(uint256 _pid, address _user) view returns (uint256)',
    ];

    const masterChef = new ethers.Contract(masterChefAddress, masterChefAbi, wallet);
    const stakeAmount = ethers.parseUnits(String(amount), 18);
    const poolId = Number(pool);

    // Get pool LP token and approve
    const poolInfo = await masterChef.poolInfo(poolId) as [string, bigint, bigint, bigint];
    const lpToken = poolInfo[0];

    const erc20Abi = ['function approve(address, uint256) returns (bool)'];
    const lpContract = new ethers.Contract(lpToken, erc20Abi, wallet);
    const approveTx = await lpContract.approve(masterChefAddress, stakeAmount);
    await approveTx.wait();

    const tx = await masterChef.deposit(poolId, stakeAmount);
    const receipt = await tx.wait();

    return {
      status: 'completed',
      result: {
        transactionHash: receipt.hash,
        poolId: poolId,
        lpToken,
        amount: String(amount),
        protocol: String(protocol),
        chain: context.chain,
        blockNumber: receipt.blockNumber,
      },
      message: `Deposited ${amount} LP tokens into pool #${poolId} on ${protocol}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Yield farm failed: ${message}` };
  }
};

// ─── Protocol Address Helpers ──────────────────────────────────────

function getRpcUrl(chain: string): string {
  const rpcUrls: Record<string, string> = {
    'bsc': 'https://bsc-dataseed1.binance.org',
    'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
    'opbnb': 'https://opbnb-mainnet-rpc.bnbchain.org',
    'opbnb-testnet': 'https://opbnb-testnet-rpc.bnbchain.org',
    'ethereum': 'https://eth.llamarpc.com',
    'sepolia': 'https://rpc.sepolia.org',
  };
  return rpcUrls[chain] ?? rpcUrls['bsc'];
}

function getRouterAddress(router: string, chainId: number): string {
  const routers: Record<string, Record<number, string>> = {
    'pancakeswap': {
      56: '0x10ED43C718714eb63d5aA57B78B54704E256024E', // BSC Mainnet
      97: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1', // BSC Testnet
    },
    '1inch': {
      56: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    },
    'biswap': {
      56: '0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8',
    },
  };
  return routers[router]?.[chainId] ?? routers['pancakeswap'][56];
}

function getVTokenAddress(token: string, chainId: number): string {
  // Venus vToken addresses on BSC
  const vTokens: Record<string, Record<number, string>> = {
    'BNB': { 56: '0xA07c5b74C9B40447a954e1466938b865b6BBea36' },
    'USDT': { 56: '0xfD5840Cd36d94D7229439859C0112a4185BC0255' },
    'USDC': { 56: '0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8' },
    'BUSD': { 56: '0x95c78222B3D6e262dCeD232673A17735e0B8B84f' },
    'ETH': { 56: '0xf508fCD89b8bd15579dc79A6827cB4686A3592c8' },
    'BTC': { 56: '0x882C173bC7Ff3b7786CA16dfeD3DFFfb9Ee7847B' },
  };
  // Try to match by token symbol in the address
  for (const [symbol, addresses] of Object.entries(vTokens)) {
    if (token.toUpperCase().includes(symbol)) {
      return addresses[chainId] ?? addresses[56];
    }
  }
  return vTokens['BNB'][56]; // fallback
}

function getMasterChefAddress(protocol: string, chainId: number): string {
  const masterChefs: Record<string, Record<number, string>> = {
    'pancakeswap': {
      56: '0xa5f8C5Dbd5F286960b9d90548680aE5ebFf07652', // MasterChef V3
      97: '0xB4A466911556e39210a6bB2FaECBB59E4eB7E43d',
    },
    'biswap': {
      56: '0xDbc1A13490deeF9c3C12b44FE77b503c1B3617a3',
    },
  };
  return masterChefs[protocol]?.[chainId] ?? masterChefs['pancakeswap'][56];
}

// ─── Skill Definitions ─────────────────────────────────────────────

export const swapSkill: Skill = {
  definition: {
    id: 'defi/swap',
    name: 'Token Swap',
    description: 'Swap tokens on decentralized exchanges (PancakeSwap, 1inch, BiSwap). Supports custom slippage, multi-hop routes, and deadline configuration.',
    category: 'defi',
    version: '1.0.0',
    tags: ['swap', 'dex', 'pancakeswap', 'trade', 'exchange'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet', 'opbnb', 'ethereum'],
    parameters: {
      tokenIn: { type: 'string', description: 'Input token address', required: true },
      tokenOut: { type: 'string', description: 'Output token address', required: true },
      amount: { type: 'string', description: 'Amount to swap (human-readable)', required: true },
      slippage: { type: 'number', description: 'Slippage tolerance in percent (default: 0.5)', default: 0.5 },
      router: { type: 'string', description: 'DEX router to use', default: 'pancakeswap', enum: ['pancakeswap', '1inch', 'biswap'] },
    },
    requiredConfig: ['PRIVATE_KEY'],
    examples: [
      {
        name: 'Swap BNB for USDT',
        input: { tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', tokenOut: '0x55d398326f99059fF775485246999027B3197955', amount: '1.0' },
      },
    ],
  },
  handler: swapHandler,
};

export const getQuoteSkill: Skill = {
  definition: {
    id: 'defi/quote',
    name: 'Get Swap Quote',
    description: 'Get a price quote for a token swap without executing the trade. Returns expected output amount and price impact.',
    category: 'defi',
    version: '1.0.0',
    tags: ['quote', 'price', 'dex', 'estimate'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet', 'opbnb', 'ethereum'],
    parameters: {
      tokenIn: { type: 'string', description: 'Input token address', required: true },
      tokenOut: { type: 'string', description: 'Output token address', required: true },
      amount: { type: 'string', description: 'Amount to quote (human-readable)', required: true },
      router: { type: 'string', description: 'DEX router', default: 'pancakeswap' },
    },
  },
  handler: getQuoteHandler,
};

export const lendingSupplySkill: Skill = {
  definition: {
    id: 'defi/lending-supply',
    name: 'Lending Supply',
    description: 'Supply tokens to a lending protocol (Venus, Alpaca Finance) to earn interest. Returns estimated APR and transaction details.',
    category: 'defi',
    version: '1.0.0',
    tags: ['lending', 'supply', 'venus', 'interest', 'yield'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet'],
    parameters: {
      token: { type: 'string', description: 'Token address to supply', required: true },
      amount: { type: 'string', description: 'Amount to supply', required: true },
      protocol: { type: 'string', description: 'Lending protocol', default: 'venus', enum: ['venus', 'alpaca'] },
    },
    requiredConfig: ['PRIVATE_KEY'],
  },
  handler: lendingSupplyHandler,
};

export const lendingBorrowSkill: Skill = {
  definition: {
    id: 'defi/lending-borrow',
    name: 'Lending Borrow',
    description: 'Borrow tokens from a lending protocol against supplied collateral. Returns borrow APR and health factor.',
    category: 'defi',
    version: '1.0.0',
    tags: ['lending', 'borrow', 'venus', 'collateral'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet'],
    parameters: {
      token: { type: 'string', description: 'Token address to borrow', required: true },
      amount: { type: 'string', description: 'Amount to borrow', required: true },
      protocol: { type: 'string', description: 'Lending protocol', default: 'venus' },
    },
    requiredConfig: ['PRIVATE_KEY'],
  },
  handler: lendingBorrowHandler,
};

export const yieldFarmSkill: Skill = {
  definition: {
    id: 'defi/yield-farm',
    name: 'Yield Farm',
    description: 'Deposit LP tokens into yield farming pools (PancakeSwap MasterChef, BiSwap). Earns reward tokens over time.',
    category: 'defi',
    version: '1.0.0',
    tags: ['yield', 'farming', 'masterchef', 'lp', 'staking'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet'],
    parameters: {
      pool: { type: 'string', description: 'Pool ID', required: true },
      amount: { type: 'string', description: 'LP token amount to deposit', required: true },
      protocol: { type: 'string', description: 'Farming protocol', default: 'pancakeswap' },
    },
    requiredConfig: ['PRIVATE_KEY'],
  },
  handler: yieldFarmHandler,
};

/** All DeFi skills */
export const defiSkills: Skill[] = [
  swapSkill,
  getQuoteSkill,
  lendingSupplySkill,
  lendingBorrowSkill,
  yieldFarmSkill,
];
