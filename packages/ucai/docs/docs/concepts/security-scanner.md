---
title: Security Scanner
description: Detect smart contract risks before connecting your AI agent
---

# Security Scanner

The UCAI Security Scanner analyzes smart contracts for **50+ risk patterns** before you create an MCP server. It helps you avoid connecting Claude to malicious or risky contracts.

## Overview

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  🛡️ SECURITY REPORT                                         Score: 72/100    │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ⚠️  HIGH RISKS                                                                 │
│  ├── Mint Function — Owner may create unlimited tokens                        │
│  └── Pausable — Owner can freeze all transfers                                │
│                                                                                │
│  ⚡ MEDIUM RISKS                                                               │
│  ├── Proxy Contract — Logic can be upgraded                                   │
│  └── External Calls — Potential reentrancy vector                             │
│                                                                                │
│  ✅ POSITIVE INDICATORS                                                        │
│  ├── ✓ Contract verified on Etherscan                                         │
│  ├── ✓ Uses OpenZeppelin (audited library)                                    │
│  └── ✓ Has reentrancy protection                                              │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Risk Score

The scanner produces a score from **0 to 100**:

| Score | Level | Color | Meaning |
|-------|-------|-------|---------|
| 80-100 | Safe | 🟢 Green | Standard patterns, low risk |
| 60-79 | Caution | 🟡 Yellow | Some concerns, review before proceeding |
| 40-59 | Warning | 🟠 Orange | Multiple risks, proceed carefully |
| 0-39 | Danger | 🔴 Red | High risk, likely malicious |

### Scoring Logic

Each detected risk reduces the score:

| Severity | Points Deducted |
|----------|-----------------|
| Critical | -30 |
| High | -15 |
| Medium | -8 |
| Low | -3 |
| Info | -1 |

## Risk Categories

### 🚨 Critical Risks

These are the most dangerous patterns that often indicate malicious contracts:

| Risk | Pattern | Description |
|------|---------|-------------|
| Self-Destruct | `selfdestruct`, `suicide` | Contract can be destroyed, draining all funds |
| Arbitrary Delegatecall | `delegatecall(data)` | Can execute any code, complete takeover |
| tx.origin Auth | `tx.origin` | Vulnerable to phishing attacks |

### ⚠️ High Risks

Common rug pull and honeypot indicators:

| Risk | Pattern | Description |
|------|---------|-------------|
| Hidden Mint | `function mint()` | Owner can create unlimited tokens |
| Pause Function | `pause()`, `whenNotPaused` | Owner can freeze all transfers |
| Blacklist | `blacklist`, `banned` | Owner can block specific addresses |
| Adjustable Fees | `setFee()`, `setTax()` | Fees can be increased to 100% |
| Transaction Limits | `maxTx`, `maxWallet` | Limits on buy/sell (honeypot indicator) |
| Ownable | `Ownable` without `renounceOwnership` | Owner retains control |

### ⚡ Medium Risks

Potential issues that require careful review:

| Risk | Pattern | Description |
|------|---------|-------------|
| Transfer Restrictions | `require(!blacklist[])` | Transfers may be blocked |
| Hardcoded Owner | `owner = 0x...` | Owner is a fixed address |
| External Calls | `.call()`, `.send()` | Potential reentrancy if unguarded |
| Inline Assembly | `assembly { }` | Low-level code, harder to audit |
| Proxy Pattern | `Upgradeable`, `Proxy` | Logic can change after deployment |

### ℹ️ Low Risks

Minor issues or common patterns:

| Risk | Pattern | Description |
|------|---------|-------------|
| Timestamp Dependence | `block.timestamp` | Minor manipulation by miners |
| Unchecked Math | `unchecked { }` | Intentional gas optimization |

## Positive Indicators

The scanner also detects good practices:

| Indicator | Pattern | Meaning |
|-----------|---------|---------|
| ✓ Verified | API response | Source code publicly verified |
| ✓ OpenZeppelin | `@openzeppelin` | Uses audited library |
| ✓ Reentrancy Guard | `ReentrancyGuard` | Protected from reentrancy |
| ✓ Safe Math | `SafeMath`, `SafeERC20` | Overflow/underflow protection |
| ✓ Can Renounce | `renounceOwnership` | Owner can give up control |
| ✓ SPDX License | `SPDX-License-Identifier` | Proper licensing |
| ✓ Documentation | `@notice`, `@param` | NatSpec comments present |

## Usage

### Web Builder

1. Go to [mcp.ucai.tech](https://mcp.ucai.tech)
2. Enter a contract address
3. Click **Fetch ABI** (auto-triggers scan) or **🛡️ Scan**
4. Review the security report
5. Decide whether to proceed

### API

```bash
curl -X POST https://mcp.ucai.tech/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"address": "0x...", "network": "ethereum"}'
```

Response:
```json
{
  "securityReport": {
    "overallScore": 72,
    "riskLevel": "caution",
    "risks": [
      {
        "id": "hidden-mint",
        "severity": "high",
        "title": "Mint Function Detected",
        "description": "Owner may be able to create unlimited tokens"
      }
    ],
    "positives": [
      "✓ Contract is verified on block explorer",
      "✓ Uses OpenZeppelin (audited library)"
    ]
  }
}
```

## Proxy Contracts

The scanner automatically detects proxy contracts and:

1. Identifies the implementation address
2. Fetches the implementation's source code
3. Analyzes the actual logic (not just the proxy)

This ensures you see the real risks, not just `delegatecall`.

## Limitations

The security scanner is a **heuristic tool**, not a formal audit:

- **False positives:** Some patterns (like `mint`) are dangerous in tokens but normal in NFTs
- **False negatives:** Novel attack vectors may not be detected
- **Source required:** Unverified contracts get a "Source Not Available" warning
- **No runtime analysis:** Static analysis only, doesn't detect state-dependent issues

**Always DYOR (Do Your Own Research)** before interacting with any smart contract.

## Programmatic Access

The scanner logic is available in the `security-scanner.ts` module:

```typescript
import { 
  generateSecurityReport, 
  analyzeSourceCode,
  analyzeAbi,
  calculateScore 
} from '@/lib/security-scanner';

const report = generateSecurityReport(
  address,
  sourceCode,
  abi,
  isVerified,
  contractName
);

console.log(report.overallScore);  // 72
console.log(report.riskLevel);     // "caution"
console.log(report.risks);         // [{...}]
console.log(report.positives);     // ["✓ Verified", ...]
```

## Contributing

To add new risk patterns:

1. Edit `web-v2/src/lib/security-scanner.ts`
2. Add to `CRITICAL_PATTERNS`, `HIGH_PATTERNS`, `MEDIUM_PATTERNS`, or `LOW_PATTERNS`
3. Test with known malicious and legitimate contracts
4. Submit a PR

Example:
```typescript
{
  id: "new-risk",
  pattern: /dangerousPattern/gi,
  title: "Dangerous Pattern",
  description: "This pattern indicates...",
}
```
