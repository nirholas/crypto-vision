/**
 * Portfolio Skills — Balance Tracking, P&L, Holdings Analysis
 *
 * Portfolio management and analytics for on-chain assets.
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

// ─── Portfolio Balance Skill ───────────────────────────────────────

const balanceHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { address, tokens } = data;
  const walletAddress = address ? String(address) : context.agentAddress;

  context.logger.info('Fetching portfolio balances', { address: walletAddress });

  try {
    const { ethers } = await import('ethers');
    const rpcUrls: Record<string, string> = {
      'bsc': 'https://bsc-dataseed1.binance.org',
      'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
      'opbnb': 'https://opbnb-mainnet-rpc.bnbchain.org',
      'ethereum': 'https://eth.llamarpc.com',
    };
    const provider = new ethers.JsonRpcProvider(rpcUrls[context.chain] ?? rpcUrls['bsc']);

    // Get native balance
    const nativeBalance = await provider.getBalance(walletAddress);
    const nativeSymbol = context.chain.startsWith('bsc') || context.chain === 'opbnb' ? 'BNB' : 'ETH';

    // Common BSC tokens to check
    const defaultTokens = [
      { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', decimals: 18 },
      { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', decimals: 18 },
      { address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', symbol: 'CAKE', decimals: 18 },
      { address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', symbol: 'ETH', decimals: 18 },
      { address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', symbol: 'BTCB', decimals: 18 },
    ];

    const tokenList = Array.isArray(tokens) ? tokens as Array<{address: string; symbol: string; decimals: number}> : defaultTokens;
    const erc20Abi = [
      'function balanceOf(address) view returns (uint256)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
    ];

    const holdings: Array<{ symbol: string; address: string; balance: string; decimals: number }> = [
      { symbol: nativeSymbol, address: 'native', balance: ethers.formatEther(nativeBalance), decimals: 18 },
    ];

    for (const token of tokenList) {
      try {
        const contract = new ethers.Contract(token.address, erc20Abi, provider);
        const balance = await contract.balanceOf(walletAddress) as bigint;
        if (balance > 0n) {
          holdings.push({
            symbol: token.symbol,
            address: token.address,
            balance: ethers.formatUnits(balance, token.decimals),
            decimals: token.decimals,
          });
        }
      } catch {
        // Skip tokens that fail
      }
    }

    return {
      status: 'completed',
      result: {
        address: walletAddress,
        chain: context.chain,
        holdings,
        totalAssets: holdings.length,
        timestamp: new Date().toISOString(),
      },
      message: `Portfolio: ${holdings.length} assets on ${context.chain}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Balance fetch failed: ${message}` };
  }
};

// ─── Transaction History Skill ─────────────────────────────────────

const txHistoryHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { address, limit = 20 } = data;
  const walletAddress = address ? String(address) : context.agentAddress;

  context.logger.info('Fetching transaction history', { address: walletAddress, limit: Number(limit) });

  try {
    // Use BSCScan API
    const apiKey = context.getConfig('BSCSCAN_API_KEY') ?? '';
    const baseUrl = context.chain === 'bsc-testnet'
      ? 'https://api-testnet.bscscan.com/api'
      : 'https://api.bscscan.com/api';

    const response = await fetch(
      `${baseUrl}?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&page=1&offset=${Number(limit)}&sort=desc&apikey=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`BSCScan API error: ${response.status}`);
    }

    const result = await response.json() as { status: string; result: Array<Record<string, string>> };

    if (result.status !== '1' || !Array.isArray(result.result)) {
      return {
        status: 'completed',
        result: { address: walletAddress, transactions: [], count: 0 },
        message: 'No transactions found',
      };
    }

    const transactions = result.result.map((tx: Record<string, string>) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value ? (Number(tx.value) / 1e18).toFixed(6) : '0',
      gasUsed: tx.gasUsed,
      timestamp: new Date(Number(tx.timeStamp) * 1000).toISOString(),
      status: tx.isError === '0' ? 'success' : 'failed',
      method: tx.functionName?.split('(')[0] ?? 'transfer',
    }));

    return {
      status: 'completed',
      result: {
        address: walletAddress,
        chain: context.chain,
        transactions,
        count: transactions.length,
        timestamp: new Date().toISOString(),
      },
      message: `Found ${transactions.length} transactions for ${walletAddress.slice(0, 10)}...`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Transaction history failed: ${message}` };
  }
};

// ─── Token Approval Audit Skill ────────────────────────────────────

const approvalAuditHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { address } = data;
  const walletAddress = address ? String(address) : context.agentAddress;

  context.logger.info('Auditing token approvals', { address: walletAddress });

  try {
    const apiKey = context.getConfig('BSCSCAN_API_KEY') ?? '';
    const baseUrl = context.chain === 'bsc-testnet'
      ? 'https://api-testnet.bscscan.com/api'
      : 'https://api.bscscan.com/api';

    // Fetch ERC20 transfer events to find approved contracts
    const response = await fetch(
      `${baseUrl}?module=account&action=tokentx&address=${walletAddress}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc&apikey=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`BSCScan API error: ${response.status}`);
    }

    const result = await response.json() as { status: string; result: Array<Record<string, string>> };
    const tokenTxs = Array.isArray(result.result) ? result.result : [];

    // Unique tokens interacted with
    const uniqueTokens = new Set<string>();
    for (const tx of tokenTxs) {
      if (tx.contractAddress) {
        uniqueTokens.add(tx.contractAddress);
      }
    }

    // Check current approvals for each token
    const { ethers } = await import('ethers');
    const rpcUrls: Record<string, string> = {
      'bsc': 'https://bsc-dataseed1.binance.org',
      'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
    };
    const provider = new ethers.JsonRpcProvider(rpcUrls[context.chain] ?? rpcUrls['bsc']);

    const approvalAbi = [
      'function allowance(address owner, address spender) view returns (uint256)',
      'function symbol() view returns (string)',
    ];

    // Well-known spender contracts to check
    const spenders = [
      { name: 'PancakeSwap Router', address: '0x10ED43C718714eb63d5aA57B78B54704E256024E' },
      { name: 'Venus', address: '0xfD36E2c2a6789Db23113685031d7F16329158384' },
      { name: '1inch', address: '0x1111111254EEB25477B68fb85Ed929f73A960582' },
    ];

    const approvals: Array<{ token: string; symbol: string; spender: string; spenderName: string; allowance: string; risk: string }> = [];

    for (const tokenAddress of Array.from(uniqueTokens).slice(0, 20)) {
      const tokenContract = new ethers.Contract(tokenAddress, approvalAbi, provider);

      let symbol = 'UNKNOWN';
      try { symbol = await tokenContract.symbol() as string; } catch { /* skip */ }

      for (const spender of spenders) {
        try {
          const allowance = await tokenContract.allowance(walletAddress, spender.address) as bigint;
          if (allowance > 0n) {
            const maxUint = ethers.MaxUint256;
            const isUnlimited = allowance >= maxUint / 2n;

            approvals.push({
              token: tokenAddress,
              symbol,
              spender: spender.address,
              spenderName: spender.name,
              allowance: isUnlimited ? 'UNLIMITED' : ethers.formatUnits(allowance, 18),
              risk: isUnlimited ? 'HIGH' : 'LOW',
            });
          }
        } catch {
          // Skip on error
        }
      }
    }

    const highRisk = approvals.filter((a) => a.risk === 'HIGH');

    return {
      status: 'completed',
      result: {
        address: walletAddress,
        chain: context.chain,
        approvals,
        totalApprovals: approvals.length,
        highRiskApprovals: highRisk.length,
        recommendation: highRisk.length > 0
          ? 'Review and revoke unlimited approvals to reduce risk'
          : 'No unlimited approvals found',
        timestamp: new Date().toISOString(),
      },
      message: `Found ${approvals.length} approvals (${highRisk.length} unlimited/high-risk)`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Approval audit failed: ${message}` };
  }
};

// ─── Skill Definitions ─────────────────────────────────────────────

export const balanceSkill: Skill = {
  definition: {
    id: 'portfolio/balance',
    name: 'Portfolio Balance',
    description: 'Get the complete portfolio balance for a wallet address — native tokens and all major ERC-20 holdings.',
    category: 'portfolio',
    version: '1.0.0',
    tags: ['balance', 'holdings', 'portfolio', 'wallet'],
    inputModes: ['application/json', 'text/plain'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet', 'opbnb', 'ethereum'],
    parameters: {
      address: { type: 'string', description: 'Wallet address (defaults to agent address)' },
      tokens: { type: 'array', description: 'Custom token list to check' },
    },
  },
  handler: balanceHandler,
};

export const txHistorySkill: Skill = {
  definition: {
    id: 'portfolio/tx-history',
    name: 'Transaction History',
    description: 'Get recent transaction history for a wallet address from blockchain explorer APIs.',
    category: 'portfolio',
    version: '1.0.0',
    tags: ['transactions', 'history', 'activity'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet'],
    parameters: {
      address: { type: 'string', description: 'Wallet address' },
      limit: { type: 'number', description: 'Max transactions to return', default: 20 },
    },
  },
  handler: txHistoryHandler,
};

export const approvalAuditSkill: Skill = {
  definition: {
    id: 'portfolio/approval-audit',
    name: 'Token Approval Audit',
    description: 'Audit all token approvals (allowances) for a wallet. Identifies unlimited/high-risk approvals that could be exploited.',
    category: 'portfolio',
    version: '1.0.0',
    tags: ['approvals', 'security', 'audit', 'allowance', 'revoke'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet'],
    parameters: {
      address: { type: 'string', description: 'Wallet address to audit' },
    },
  },
  handler: approvalAuditHandler,
};

/** All portfolio skills */
export const portfolioSkills: Skill[] = [
  balanceSkill,
  txHistorySkill,
  approvalAuditSkill,
];
