# Security Tools

Tools for blockchain security analysis including honeypot detection, rug pull checks, token safety, and wallet security via GoPlus Security API.

---

## security_check_token

Comprehensive token security analysis including honeypot detection, owner analysis, and risk assessment.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `tokenAddress` | string | Yes | - | Token contract address |

### Response Schema

```typescript
{
  token: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
  };
  security: {
    isHoneypot: boolean;
    honeypotReason?: string;
    buyTax: string;
    sellTax: string;
    cannotBuy: boolean;
    cannotSellAll: boolean;
    tradingCooldown: boolean;
    transferPausable: boolean;
    isBlacklisted: boolean;
    isWhitelisted: boolean;
    isAntiWhale: boolean;
    antiWhaleModifiable: boolean;
    slippageModifiable: boolean;
    personalSlippageModifiable: boolean;
  };
  contract: {
    isOpenSource: boolean;
    isProxy: boolean;
    isMintable: boolean;
    canTakeBackOwnership: boolean;
    ownerChangeBalance: boolean;
    hiddenOwner: boolean;
    selfDestruct: boolean;
    externalCall: boolean;
    gasAbuse: boolean;
  };
  ownership: {
    ownerAddress: string;
    ownerPercent: string;
    ownerChangeBalance: boolean;
    creatorAddress: string;
    creatorPercent: string;
  };
  holders: {
    holderCount: number;
    top10HolderPercent: string;
    top10HolderBalance: string;
    lpHolderCount: number;
    lpTotalSupply: string;
    isLpLocked: boolean;
    lpLockDays?: number;
  };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;           // 0-100 (lower is safer)
  warnings: string[];
}
```

### Example Usage

```typescript
const result = await client.callTool('security_check_token', {
  network: 'ethereum',
  tokenAddress: '0x6B175474E89094C44Da98b954EescdeCB5BE40'
});

// Response for DAI (safe token)
{
  "token": {
    "address": "0x6B175474E89094C44Da98b954EeD3c3eB5BE40",
    "name": "Dai Stablecoin",
    "symbol": "DAI",
    "decimals": 18,
    "totalSupply": "5000000000"
  },
  "security": {
    "isHoneypot": false,
    "buyTax": "0%",
    "sellTax": "0%",
    "cannotBuy": false,
    "cannotSellAll": false,
    "tradingCooldown": false,
    "transferPausable": false,
    "isBlacklisted": false,
    "isWhitelisted": false,
    "isAntiWhale": false,
    "antiWhaleModifiable": false,
    "slippageModifiable": false,
    "personalSlippageModifiable": false
  },
  "contract": {
    "isOpenSource": true,
    "isProxy": false,
    "isMintable": true,
    "canTakeBackOwnership": false,
    "ownerChangeBalance": false,
    "hiddenOwner": false,
    "selfDestruct": false,
    "externalCall": false,
    "gasAbuse": false
  },
  "ownership": {
    "ownerAddress": "0x0000000000000000000000000000000000000000",
    "ownerPercent": "0%",
    "ownerChangeBalance": false,
    "creatorAddress": "0x...",
    "creatorPercent": "0%"
  },
  "holders": {
    "holderCount": 500000,
    "top10HolderPercent": "25%",
    "isLpLocked": true,
    "lpLockDays": 365
  },
  "riskLevel": "LOW",
  "riskScore": 5,
  "warnings": []
}
```

### Risk Level Interpretation

| Level | Score | Description |
|-------|-------|-------------|
| LOW | 0-25 | Safe to interact, established token |
| MEDIUM | 26-50 | Proceed with caution, some concerns |
| HIGH | 51-75 | Significant risks, avoid large positions |
| CRITICAL | 76-100 | Likely scam/honeypot, do not interact |

---

## security_check_honeypot

Quick honeypot detection for a token.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `tokenAddress` | string | Yes | - | Token contract address |

### Response Schema

```typescript
{
  token: string;
  isHoneypot: boolean;
  honeypotType?: string;
  reason?: string;
  simulationResult: {
    buySuccess: boolean;
    sellSuccess: boolean;
    buyTax: string;
    sellTax: string;
    buyGas: number;
    sellGas: number;
  };
  pair: {
    address: string;
    token0: string;
    token1: string;
    liquidity: string;
  };
}
```

### Example Usage

```typescript
const result = await client.callTool('security_check_honeypot', {
  network: 'bsc',
  tokenAddress: '0xSuspiciousToken...'
});

// Response for honeypot token
{
  "token": "0xSuspiciousToken...",
  "isHoneypot": true,
  "honeypotType": "SELL_BLOCKED",
  "reason": "Selling is not possible - transfer function fails for all users except owner",
  "simulationResult": {
    "buySuccess": true,
    "sellSuccess": false,
    "buyTax": "5%",
    "sellTax": "100%",
    "buyGas": 150000,
    "sellGas": 0
  },
  "pair": {
    "address": "0x...",
    "token0": "0xSuspiciousToken...",
    "token1": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    "liquidity": "50000"
  }
}
```

---

## security_check_rug_pull

Analyze token for rug pull risk indicators.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `tokenAddress` | string | Yes | - | Token contract address |

### Response Schema

```typescript
{
  token: string;
  rugPullRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  indicators: {
    lpLocked: boolean;
    lpLockDays: number;
    ownershipRenounced: boolean;
    topHolderConcentration: string;
    suspiciousFunctions: string[];
    recentLargeTransfers: boolean;
    newContract: boolean;
    contractAge: number;        // days
  };
  warnings: string[];
  recommendations: string[];
}
```

### Example Usage

```typescript
const result = await client.callTool('security_check_rug_pull', {
  network: 'ethereum',
  tokenAddress: '0xNewMemeToken...'
});

// Response
{
  "token": "0xNewMemeToken...",
  "rugPullRisk": "HIGH",
  "riskScore": 72,
  "indicators": {
    "lpLocked": false,
    "lpLockDays": 0,
    "ownershipRenounced": false,
    "topHolderConcentration": "85%",
    "suspiciousFunctions": ["mint", "blacklistAddress", "setFee"],
    "recentLargeTransfers": true,
    "newContract": true,
    "contractAge": 2
  },
  "warnings": [
    "Liquidity is not locked",
    "Top 10 holders control 85% of supply",
    "Contract has mint function accessible to owner",
    "Contract is only 2 days old",
    "Large transfers detected in last 24h"
  ],
  "recommendations": [
    "Wait for liquidity to be locked",
    "Monitor owner wallet activity",
    "Start with very small position if investing",
    "Set stop-loss orders"
  ]
}
```

---

## security_check_address

Check if an address is associated with known scams, exploits, or malicious activity.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `address` | string | Yes | - | Address to check |

### Response Schema

```typescript
{
  address: string;
  isMalicious: boolean;
  riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  tags: string[];
  details: {
    isContract: boolean;
    isEOA: boolean;
    hasPhishingActivity: boolean;
    hasBlacklistActivity: boolean;
    hasMixerActivity: boolean;
    hasStolenFunds: boolean;
    associatedProtocols: string[];
  };
  history?: {
    firstSeen: string;
    transactionCount: number;
    uniqueInteractions: number;
  };
  warnings: string[];
}
```

### Example Usage

```typescript
const result = await client.callTool('security_check_address', {
  network: 'ethereum',
  address: '0xKnownScammer...'
});

// Response
{
  "address": "0xKnownScammer...",
  "isMalicious": true,
  "riskLevel": "CRITICAL",
  "tags": ["phishing", "scam", "mixer-user"],
  "details": {
    "isContract": false,
    "isEOA": true,
    "hasPhishingActivity": true,
    "hasBlacklistActivity": true,
    "hasMixerActivity": true,
    "hasStolenFunds": true,
    "associatedProtocols": ["Tornado Cash"]
  },
  "history": {
    "firstSeen": "2023-06-15",
    "transactionCount": 245,
    "uniqueInteractions": 1523
  },
  "warnings": [
    "Address is flagged for phishing activity",
    "Has interacted with known mixers",
    "Associated with stolen funds"
  ]
}
```

---

## security_check_approval

Check token approvals for security risks.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `address` | string | Yes | - | Wallet address to check |

### Response Schema

```typescript
{
  address: string;
  totalApprovals: number;
  riskyApprovals: number;
  approvals: Array<{
    token: {
      address: string;
      symbol: string;
      name: string;
    };
    spender: {
      address: string;
      name?: string;
      isContract: boolean;
      isVerified: boolean;
    };
    allowance: string;
    allowanceUSD: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    warnings: string[];
  }>;
  totalExposureUSD: string;
  recommendations: string[];
}
```

### Example Usage

```typescript
const result = await client.callTool('security_check_approval', {
  network: 'ethereum',
  address: '0xMyWallet...'
});

// Response
{
  "address": "0xMyWallet...",
  "totalApprovals": 15,
  "riskyApprovals": 3,
  "approvals": [
    {
      "token": {
        "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "symbol": "USDC",
        "name": "USD Coin"
      },
      "spender": {
        "address": "0xUnknownContract...",
        "name": null,
        "isContract": true,
        "isVerified": false
      },
      "allowance": "unlimited",
      "allowanceUSD": "∞",
      "riskLevel": "HIGH",
      "warnings": [
        "Unlimited approval to unverified contract",
        "Contract is not verified on explorer"
      ]
    }
  ],
  "totalExposureUSD": "25,000.00",
  "recommendations": [
    "Revoke approval for 0xUnknownContract...",
    "Consider using exact amounts instead of unlimited approvals",
    "Review approvals periodically"
  ]
}
```

---

## security_check_dapp

Check if a dApp URL is associated with phishing or scams.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `url` | string | Yes | - | dApp URL to check |

### Response Schema

```typescript
{
  url: string;
  isSafe: boolean;
  riskLevel: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS';
  details: {
    isPhishing: boolean;
    isFake: boolean;
    hasRedirectRisk: boolean;
    sslValid: boolean;
    domainAge: number;          // days
    officialUrl?: string;
  };
  warnings: string[];
}
```

### Example Usage

```typescript
const result = await client.callTool('security_check_dapp', {
  url: 'https://uuniswap.com'  // Fake Uniswap
});

// Response
{
  "url": "https://uuniswap.com",
  "isSafe": false,
  "riskLevel": "DANGEROUS",
  "details": {
    "isPhishing": true,
    "isFake": true,
    "hasRedirectRisk": true,
    "sslValid": true,
    "domainAge": 15,
    "officialUrl": "https://app.uniswap.org"
  },
  "warnings": [
    "This is a phishing site impersonating Uniswap",
    "Domain registered only 15 days ago",
    "Do not connect your wallet"
  ]
}
```

---

## security_decode_signature

Decode and analyze a signature request for safety.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `data` | string | Yes | - | Signature data (hex) |
| `to` | string | No | - | Target contract address |

### Response Schema

```typescript
{
  type: 'message' | 'typed_data' | 'transaction' | 'permit';
  decoded: {
    method?: string;
    parameters?: Record<string, any>;
    message?: string;
    domain?: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: string;
    };
  };
  analysis: {
    isRisky: boolean;
    riskLevel: 'SAFE' | 'CAUTION' | 'DANGEROUS';
    warnings: string[];
    explanation: string;
  };
}
```

### Example Usage

```typescript
const result = await client.callTool('security_decode_signature', {
  network: 'ethereum',
  data: '0x095ea7b3000000000000000000000000...',
  to: '0xContractAddress...'
});

// Response for unlimited approval
{
  "type": "transaction",
  "decoded": {
    "method": "approve",
    "parameters": {
      "spender": "0xUnknownSpender...",
      "amount": "115792089237316195423570985008687907853269984665640564039457584007913129639935"
    }
  },
  "analysis": {
    "isRisky": true,
    "riskLevel": "CAUTION",
    "warnings": [
      "This is an UNLIMITED approval",
      "Spender contract is not verified"
    ],
    "explanation": "This transaction will approve unlimited spending of your tokens by the specified contract. Consider approving only the exact amount needed."
  }
}
```

---

## security_simulate_transaction

Simulate a transaction to check for safety issues before execution.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `from` | string | Yes | - | Sender address |
| `to` | string | Yes | - | Target address |
| `data` | string | Yes | - | Transaction data |
| `value` | string | No | `0` | ETH value to send |

### Response Schema

```typescript
{
  success: boolean;
  gasUsed: number;
  balanceChanges: Array<{
    address: string;
    token: string;
    symbol: string;
    before: string;
    after: string;
    change: string;
  }>;
  approvalChanges: Array<{
    token: string;
    spender: string;
    before: string;
    after: string;
  }>;
  riskAnalysis: {
    isRisky: boolean;
    riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH';
    warnings: string[];
  };
  error?: string;
}
```

---

## security_get_contract_info

Get security-relevant information about a contract.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `contractAddress` | string | Yes | - | Contract address |

### Response Schema

```typescript
{
  address: string;
  isVerified: boolean;
  isProxy: boolean;
  implementationAddress?: string;
  compilerVersion?: string;
  creatorAddress: string;
  creationTxHash: string;
  creationDate: string;
  ageInDays: number;
  balance: string;
  transactionCount: number;
  hasSourceCode: boolean;
  securityFeatures: {
    hasOwner: boolean;
    isOwnerRenounced: boolean;
    hasPausable: boolean;
    hasBlacklist: boolean;
    hasMint: boolean;
    hasBurn: boolean;
    hasProxyAdmin: boolean;
  };
  riskIndicators: string[];
}
```

---

## Error Handling

### Common Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| `TOKEN_NOT_FOUND` | Token doesn't exist | Verify contract address |
| `UNSUPPORTED_NETWORK` | Network not supported by GoPlus | Use supported network |
| `SIMULATION_FAILED` | Transaction simulation failed | Check parameters |
| `RATE_LIMIT` | Too many requests | Implement request throttling |

---

## Supported Networks

GoPlus security API supports:

- Ethereum (1)
- BNB Smart Chain (56)
- Polygon (137)
- Arbitrum (42161)
- Optimism (10)
- Avalanche (43114)
- Fantom (250)
- Base (8453)

---

## Best Practices

1. **Always check before interacting** - Verify tokens and contracts before transactions
2. **Check multiple indicators** - Don't rely on a single security check
3. **Be cautious with new tokens** - Contract age is a significant risk factor
4. **Review approvals regularly** - Revoke unnecessary approvals
5. **Verify dApp URLs** - Always check the URL before connecting wallet
6. **Simulate before signing** - Use transaction simulation for complex operations
7. **Monitor your wallets** - Set up alerts for suspicious activity
