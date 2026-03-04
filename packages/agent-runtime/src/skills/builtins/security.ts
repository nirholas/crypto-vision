/**
 * Security Skills — Contract Audit, Rug Pull Detection, Wallet Safety
 *
 * Security analysis and threat detection for smart contracts and tokens on BNB Chain.
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

// ─── Token Safety Check Skill ──────────────────────────────────────

const tokenSafetyHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { token } = data;

  if (!token) {
    return { status: 'failed', message: 'Missing required parameter: token' };
  }

  context.logger.info('Running token safety check', { token: String(token) });

  try {
    const { ethers } = await import('ethers');
    const rpcUrls: Record<string, string> = {
      'bsc': 'https://bsc-dataseed1.binance.org',
      'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
    };
    const provider = new ethers.JsonRpcProvider(rpcUrls[context.chain] ?? rpcUrls['bsc']);

    const tokenAddress = String(token);
    const tokenAbi = [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function totalSupply() view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function owner() view returns (address)',
      'function balanceOf(address) view returns (uint256)',
      'function getOwner() view returns (address)',
    ];

    const contract = new ethers.Contract(tokenAddress, tokenAbi, provider);

    let name = 'Unknown';
    let symbol = 'UNKNOWN';
    let totalSupply = 0n;
    let decimals = 18;
    let owner = ethers.ZeroAddress;

    try { name = await contract.name() as string; } catch { /* no name */ }
    try { symbol = await contract.symbol() as string; } catch { /* no symbol */ }
    try { totalSupply = await contract.totalSupply() as bigint; } catch { /* no supply */ }
    try { decimals = Number(await contract.decimals()); } catch { /* default 18 */ }
    try { owner = await contract.owner() as string; } catch {
      try { owner = await contract.getOwner() as string; } catch { /* no owner */ }
    }

    // Security checks
    const risks: Array<{ level: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'; description: string }> = [];

    // Check if contract is verified (proxy check via code size)
    const code = await provider.getCode(tokenAddress);
    if (code === '0x') {
      risks.push({ level: 'HIGH', description: 'Address has no contract code (EOA or self-destructed)' });
    }

    // Check owner renounced
    if (owner !== ethers.ZeroAddress) {
      risks.push({ level: 'MEDIUM', description: `Contract has an active owner (${owner.slice(0, 10)}...). Owner may have admin privileges.` });
    } else {
      risks.push({ level: 'INFO', description: 'Contract ownership renounced (owner is zero address)' });
    }

    // Check if owner holds majority supply
    if (owner !== ethers.ZeroAddress && totalSupply > 0n) {
      try {
        const ownerBalance = await contract.balanceOf(owner) as bigint;
        const ownerPercent = Number((ownerBalance * 10000n) / totalSupply) / 100;
        if (ownerPercent > 50) {
          risks.push({ level: 'HIGH', description: `Owner holds ${ownerPercent.toFixed(1)}% of total supply — high centralization risk` });
        } else if (ownerPercent > 10) {
          risks.push({ level: 'MEDIUM', description: `Owner holds ${ownerPercent.toFixed(1)}% of total supply` });
        }
      } catch {
        // Skip balance check
      }
    }

    // Check contract code for dangerous patterns
    if (code.length > 4) {
      // Check for selfdestruct opcode (0xff)
      if (code.includes('ff')) {
        risks.push({ level: 'MEDIUM', description: 'Contract bytecode may contain selfdestruct capability' });
      }
      // Very short bytecode is suspicious
      if (code.length < 200) {
        risks.push({ level: 'MEDIUM', description: 'Contract bytecode is unusually short — may be a proxy or minimal contract' });
      }
    }

    // Total supply check
    if (totalSupply === 0n) {
      risks.push({ level: 'HIGH', description: 'Token has zero total supply' });
    }

    const highRisks = risks.filter((r) => r.level === 'HIGH').length;
    const mediumRisks = risks.filter((r) => r.level === 'MEDIUM').length;
    const overallRisk = highRisks > 0 ? 'HIGH' : mediumRisks > 1 ? 'MEDIUM' : 'LOW';

    return {
      status: 'completed',
      result: {
        token: tokenAddress,
        name,
        symbol,
        decimals,
        totalSupply: ethers.formatUnits(totalSupply, decimals),
        owner,
        ownerRenounced: owner === ethers.ZeroAddress,
        hasCode: code !== '0x',
        codeSize: code.length / 2,
        risks,
        overallRisk,
        highRiskCount: highRisks,
        mediumRiskCount: mediumRisks,
        chain: context.chain,
        timestamp: new Date().toISOString(),
      },
      message: `Token ${symbol}: Overall risk = ${overallRisk} (${highRisks} high, ${mediumRisks} medium risks)`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Token safety check failed: ${message}` };
  }
};

// ─── Contract Audit Skill ──────────────────────────────────────────

const contractAuditHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { contract: contractAddress } = data;

  if (!contractAddress) {
    return { status: 'failed', message: 'Missing required parameter: contract' };
  }

  context.logger.info('Running contract audit', { contract: String(contractAddress) });

  try {
    const { ethers } = await import('ethers');
    const rpcUrls: Record<string, string> = {
      'bsc': 'https://bsc-dataseed1.binance.org',
      'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
    };
    const provider = new ethers.JsonRpcProvider(rpcUrls[context.chain] ?? rpcUrls['bsc']);
    const address = String(contractAddress);

    // Get contract code and metadata
    const code = await provider.getCode(address);
    const balance = await provider.getBalance(address);
    const txCount = await provider.getTransactionCount(address);

    if (code === '0x') {
      return {
        status: 'completed',
        result: {
          contract: address,
          status: 'NOT_A_CONTRACT',
          message: 'Address is not a contract (EOA)',
        },
        message: `${address} is not a contract`,
      };
    }

    const findings: Array<{ severity: string; title: string; description: string }> = [];

    // Bytecode analysis
    const codeBytes = code.length / 2;

    if (codeBytes < 100) {
      findings.push({
        severity: 'HIGH',
        title: 'Minimal Contract',
        description: 'Contract has very little bytecode. May be a proxy with hidden implementation.',
      });
    }

    // Check for common proxy patterns
    const proxyPatterns = [
      { pattern: '363d3d373d3d3d363d73', name: 'EIP-1167 Minimal Proxy' },
      { pattern: '5c60da1b', name: 'EIP-1967 Proxy (implementation slot)' },
    ];

    for (const proxy of proxyPatterns) {
      if (code.toLowerCase().includes(proxy.pattern)) {
        findings.push({
          severity: 'INFO',
          title: `Proxy Pattern: ${proxy.name}`,
          description: 'Contract uses a proxy pattern. The implementation contract should also be audited.',
        });
      }
    }

    // Check for delegatecall (0xf4)
    if (code.includes('f4')) {
      findings.push({
        severity: 'MEDIUM',
        title: 'Delegatecall Usage',
        description: 'Contract bytecode contains delegatecall. This can be dangerous if the target is not fixed.',
      });
    }

    // Verified source check via BSCScan
    const apiKey = context.getConfig('BSCSCAN_API_KEY') ?? '';
    if (apiKey) {
      try {
        const response = await fetch(
          `https://api.bscscan.com/api?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`
        );
        const result = await response.json() as { result: Array<{ ABI: string; SourceCode: string; CompilerVersion: string; ContractName: string }> };
        const source = result.result?.[0];

        if (source?.SourceCode) {
          findings.push({
            severity: 'INFO',
            title: 'Source Verified',
            description: `Contract source verified on BSCScan: ${source.ContractName} (${source.CompilerVersion})`,
          });
        } else {
          findings.push({
            severity: 'HIGH',
            title: 'Unverified Source',
            description: 'Contract source code is not verified on BSCScan. Cannot inspect logic.',
          });
        }
      } catch {
        // Skip BSCScan check
      }
    }

    return {
      status: 'completed',
      result: {
        contract: address,
        codeSize: codeBytes,
        balance: ethers.formatEther(balance),
        transactionCount: txCount,
        findings,
        findingsSummary: {
          high: findings.filter((f) => f.severity === 'HIGH').length,
          medium: findings.filter((f) => f.severity === 'MEDIUM').length,
          low: findings.filter((f) => f.severity === 'LOW').length,
          info: findings.filter((f) => f.severity === 'INFO').length,
        },
        chain: context.chain,
        timestamp: new Date().toISOString(),
      },
      message: `Audit: ${findings.length} findings for ${address.slice(0, 10)}...`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Contract audit failed: ${message}` };
  }
};

// ─── Whale Tracking Skill ──────────────────────────────────────────

const whaleTrackHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { token, minAmount = '100000' } = data;

  if (!token) {
    return { status: 'failed', message: 'Missing required parameter: token' };
  }

  context.logger.info('Tracking whale movements', {
    token: String(token), minAmount: String(minAmount),
  });

  try {
    const apiKey = context.getConfig('BSCSCAN_API_KEY') ?? '';
    const response = await fetch(
      `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${String(token)}&page=1&offset=50&sort=desc&apikey=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`BSCScan API error: ${response.status}`);
    }

    const result = await response.json() as { status: string; result: Array<Record<string, string>> };
    const txs = Array.isArray(result.result) ? result.result : [];

    const minWei = BigInt(Number(minAmount) * 1e18);
    const whaleTransfers = txs
      .filter((tx: Record<string, string>) => {
        const value = BigInt(tx.value ?? '0');
        return value >= minWei;
      })
      .map((tx: Record<string, string>) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: (Number(tx.value) / 1e18).toFixed(2),
        timestamp: new Date(Number(tx.timeStamp) * 1000).toISOString(),
        tokenSymbol: tx.tokenSymbol,
      }));

    return {
      status: 'completed',
      result: {
        token: String(token),
        minAmount: String(minAmount),
        whaleTransfers,
        count: whaleTransfers.length,
        chain: context.chain,
        timestamp: new Date().toISOString(),
      },
      message: `Found ${whaleTransfers.length} whale transfers (≥${minAmount}) for ${token}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Whale tracking failed: ${message}` };
  }
};

// ─── Skill Definitions ─────────────────────────────────────────────

export const tokenSafetySkill: Skill = {
  definition: {
    id: 'security/token-safety',
    name: 'Token Safety Check',
    description: 'Analyze a token contract for security risks: ownership, supply concentration, code patterns, proxy detection, and rug pull indicators.',
    category: 'security',
    version: '1.0.0',
    tags: ['security', 'audit', 'rug-pull', 'token', 'safety'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet'],
    parameters: {
      token: { type: 'string', description: 'Token contract address', required: true },
    },
    examples: [
      {
        name: 'Check CAKE token safety',
        input: { token: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' },
      },
    ],
  },
  handler: tokenSafetyHandler,
};

export const contractAuditSkill: Skill = {
  definition: {
    id: 'security/contract-audit',
    name: 'Contract Audit',
    description: 'Perform a security audit of a smart contract — bytecode analysis, proxy detection, verification status, and common vulnerability patterns.',
    category: 'security',
    version: '1.0.0',
    tags: ['audit', 'smart-contract', 'security', 'bytecode', 'verification'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet'],
    parameters: {
      contract: { type: 'string', description: 'Contract address to audit', required: true },
    },
  },
  handler: contractAuditHandler,
};

export const whaleTrackSkill: Skill = {
  definition: {
    id: 'security/whale-tracker',
    name: 'Whale Tracker',
    description: 'Track large token transfers (whale movements) for a specific token. Identifies large holders buying/selling.',
    category: 'security',
    version: '1.0.0',
    tags: ['whale', 'tracking', 'large-holders', 'alerts'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet'],
    parameters: {
      token: { type: 'string', description: 'Token contract address', required: true },
      minAmount: { type: 'string', description: 'Min transfer amount to track', default: '100000' },
    },
  },
  handler: whaleTrackHandler,
};

/** All security skills */
export const securitySkills: Skill[] = [
  tokenSafetySkill,
  contractAuditSkill,
  whaleTrackSkill,
];
