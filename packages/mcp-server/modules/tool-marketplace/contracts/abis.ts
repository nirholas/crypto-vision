/**
 * @file abis.ts
 * @author nichxbt
 * @copyright (c) 2026 nirholas
 * @repository universal-crypto-mcp
 * 
 * Contract ABIs for the marketplace contracts
 */

// ═══════════════════════════════════════════════════════════════
//  ToolRegistry ABI
// ═══════════════════════════════════════════════════════════════

export const TOOL_REGISTRY_ABI = [
  // Events
  {
    type: 'event',
    name: 'ToolRegistered',
    inputs: [
      { name: 'toolId', type: 'bytes32', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'endpoint', type: 'string', indexed: false },
      { name: 'pricePerCall', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ToolUpdated',
    inputs: [
      { name: 'toolId', type: 'bytes32', indexed: true },
      { name: 'metadataURI', type: 'string', indexed: false },
      { name: 'pricePerCall', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ToolPaused',
    inputs: [{ name: 'toolId', type: 'bytes32', indexed: true }],
  },
  {
    type: 'event',
    name: 'ToolActivated',
    inputs: [{ name: 'toolId', type: 'bytes32', indexed: true }],
  },
  {
    type: 'event',
    name: 'ToolVerified',
    inputs: [
      { name: 'toolId', type: 'bytes32', indexed: true },
      { name: 'verifier', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      { name: 'toolId', type: 'bytes32', indexed: true },
      { name: 'previousOwner', type: 'address', indexed: true },
      { name: 'newOwner', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'UsageRecorded',
    inputs: [
      { name: 'toolId', type: 'bytes32', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'totalCalls', type: 'uint256', indexed: false },
    ],
  },
  
  // Functions
  {
    type: 'function',
    name: 'registerTool',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'metadataURI', type: 'string' },
      { name: 'pricePerCall', type: 'uint256' },
      { name: 'revenueRecipients', type: 'address[]' },
      { name: 'revenueShares', type: 'uint256[]' },
    ],
    outputs: [{ name: 'toolId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateTool',
    inputs: [
      { name: 'toolId', type: 'bytes32' },
      { name: 'newMetadataURI', type: 'string' },
      { name: 'newPricePerCall', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateEndpoint',
    inputs: [
      { name: 'toolId', type: 'bytes32' },
      { name: 'newEndpoint', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pauseTool',
    inputs: [{ name: 'toolId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'activateTool',
    inputs: [{ name: 'toolId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [
      { name: 'toolId', type: 'bytes32' },
      { name: 'newOwner', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateRevenueSplit',
    inputs: [
      { name: 'toolId', type: 'bytes32' },
      { name: 'recipients', type: 'address[]' },
      { name: 'shares', type: 'uint256[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getTool',
    inputs: [{ name: 'toolId', type: 'bytes32' }],
    outputs: [
      {
        name: 'tool',
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'endpoint', type: 'string' },
          { name: 'metadataURI', type: 'string' },
          { name: 'pricePerCall', type: 'uint256' },
          { name: 'active', type: 'bool' },
          { name: 'verified', type: 'bool' },
          { name: 'totalCalls', type: 'uint256' },
          { name: 'totalRevenue', type: 'uint256' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'updatedAt', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRevenueSplit',
    inputs: [{ name: 'toolId', type: 'bytes32' }],
    outputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'shares', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'toolExists',
    inputs: [{ name: 'toolId', type: 'bytes32' }],
    outputs: [{ name: 'exists', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getToolId',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ name: 'toolId', type: 'bytes32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'getToolsByOwner',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: 'toolIds', type: 'bytes32[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalTools',
    inputs: [],
    outputs: [{ name: 'count', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAllTools',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [{ name: 'toolIds', type: 'bytes32[]' }],
    stateMutability: 'view',
  },
] as const;

// ═══════════════════════════════════════════════════════════════
//  RevenueRouter ABI
// ═══════════════════════════════════════════════════════════════

export const REVENUE_ROUTER_ABI = [
  // Events
  {
    type: 'event',
    name: 'PaymentReceived',
    inputs: [
      { name: 'toolId', type: 'bytes32', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'platformFee', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RevenueDistributed',
    inputs: [
      { name: 'toolId', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PayoutClaimed',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BatchPayoutExecuted',
    inputs: [
      { name: 'recipients', type: 'address[]', indexed: false },
      { name: 'amounts', type: 'uint256[]', indexed: false },
      { name: 'totalAmount', type: 'uint256', indexed: false },
    ],
  },
  
  // Functions
  {
    type: 'function',
    name: 'processPayment',
    inputs: [
      { name: 'toolId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'processPaymentWithAuthorization',
    inputs: [
      { name: 'toolId', type: 'bytes32' },
      { name: 'from', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimPayout',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeBatchPayout',
    inputs: [{ name: 'recipients', type: 'address[]' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getPendingBalance',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canClaim',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'calculatePlatformFee',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'platformFeeBps',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minimumPayoutThreshold',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalRevenueProcessed',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// ═══════════════════════════════════════════════════════════════
//  ToolStaking ABI
// ═══════════════════════════════════════════════════════════════

export const TOOL_STAKING_ABI = [
  // Events
  {
    type: 'event',
    name: 'Staked',
    inputs: [
      { name: 'staker', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'totalStake', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'UnstakeRequested',
    inputs: [
      { name: 'staker', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'unlockTime', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Unstaked',
    inputs: [
      { name: 'staker', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Slashed',
    inputs: [
      { name: 'staker', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
  
  // Functions
  {
    type: 'function',
    name: 'stake',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'requestUnstake',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancelUnstake',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unstake',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getStake',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getStakeInfo',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'amount', type: 'uint256' },
          { name: 'lockedUntil', type: 'uint256' },
          { name: 'pendingUnstake', type: 'uint256' },
          { name: 'unstakeRequestTime', type: 'uint256' },
          { name: 'hasActiveUnstake', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'meetsMinimumStake',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minimumStake',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalStaked',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'UNSTAKE_DELAY',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// ERC20 ABI (for token approvals)
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// EOF - nirholas | ucm:0x4E494348
