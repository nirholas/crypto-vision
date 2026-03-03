# Prompt 030 — Security Routes (Token Audit & Contract Security)

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** 2. **TypeScript strict mode** — no `any`. 3. **Always kill terminals** after every command. 4. **Commit and push as `nirholas`.** 5. **If close to hallucinating — tell the prompter.** 6. **Run `npx tsc --noEmit` and `npx vitest run`.** 7. **Improve any existing code you touch.**

---

## Task

Build / improve `src/routes/security.ts` — token and contract security analysis using GoPlus, on-chain data, and DeFi hack databases.

### Source Imports

```typescript
import { Hono } from 'hono';
import * as goplus from '../sources/goplus.js';
import * as llama from '../sources/defillama.js';
import { ApiError } from '../lib/api-error.js';

export const securityRoutes = new Hono();
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/token/:chainId/:address` | Full token security audit |
| GET | `/approval/:chainId/:address` | Token approval security check |
| GET | `/nft/:chainId/:address` | NFT contract security |
| GET | `/address/:address` | Address reputation check |
| GET | `/dapp/:url` | dApp/phishing site check |
| GET | `/hacks` | Major DeFi hacks/exploits |
| GET | `/hacks/:protocol` | Specific protocol hack details |
| GET | `/rugpull-check/:chainId/:address` | Rug pull risk assessment |
| GET | `/honeypot/:chainId/:address` | Honeypot detection |
| GET | `/risk-score/:chainId/:address` | Aggregate risk score (0-100) |
| GET | `/audit-report/:protocol` | Known audit reports for protocol |
| GET | `/recent-exploits` | Recent exploit timeline |

### Token Security Audit

```typescript
securityRoutes.get('/token/:chainId/:address', async (c) => {
  const { chainId, address } = c.req.param();
  
  const security = await goplus.getTokenSecurity(Number(chainId), address);
  
  // Transform GoPlus "0"/"1" strings to booleans and compute aggregate risk
  const risks: string[] = [];
  const warnings: string[] = [];
  
  if (security.is_honeypot === '1') risks.push('HONEYPOT: Cannot sell this token');
  if (security.is_mintable === '1') warnings.push('Token supply can be increased by owner');
  if (security.can_take_back_ownership === '1') risks.push('Owner can reclaim ownership after renouncing');
  if (security.hidden_owner === '1') risks.push('Contract has a hidden owner');
  if (security.self_destruct === '1') risks.push('Contract can self-destruct');
  if (Number(security.buy_tax) > 0.1) warnings.push(`High buy tax: ${Number(security.buy_tax) * 100}%`);
  if (Number(security.sell_tax) > 0.1) warnings.push(`High sell tax: ${Number(security.sell_tax) * 100}%`);
  if (security.is_proxy === '1') warnings.push('Contract is upgradeable (proxy)');
  if (security.external_call === '1') warnings.push('Contract makes external calls');
  if (security.is_open_source !== '1') warnings.push('Contract source code is not verified');
  
  const riskScore = computeTokenRiskScore(security);
  
  return c.json({
    data: {
      address,
      chainId: Number(chainId),
      tokenName: security.token_name,
      tokenSymbol: security.token_symbol,
      totalSupply: security.total_supply,
      holderCount: Number(security.holder_count),
      lpHolderCount: Number(security.lp_holder_count),
      
      // Boolean flags
      isOpenSource: security.is_open_source === '1',
      isProxy: security.is_proxy === '1',
      isMintable: security.is_mintable === '1',
      isHoneypot: security.is_honeypot === '1',
      hasHiddenOwner: security.hidden_owner === '1',
      canSelfDestruct: security.self_destruct === '1',
      hasExternalCalls: security.external_call === '1',
      
      // Tax
      buyTax: Number(security.buy_tax),
      sellTax: Number(security.sell_tax),
      
      // Risk assessment
      riskScore,
      riskLevel: riskScore >= 80 ? 'critical' : riskScore >= 60 ? 'high' : riskScore >= 30 ? 'medium' : 'low',
      risks,
      warnings,
      
      // Owner info
      ownerAddress: security.owner_address,
      creatorAddress: security.creator_address,
      
      // Top holders
      holders: security.holders?.map(h => ({
        address: h.address,
        balance: h.balance,
        percent: h.percent,
        isContract: h.is_contract === 1,
        isLocked: h.is_locked === 1,
        tag: h.tag,
      })) ?? [],
      
      // LP info
      lpHolders: security.lp_holders?.map(lp => ({
        address: lp.address,
        balance: lp.balance,
        percent: lp.percent,
        isContract: lp.is_contract === 1,
        isLocked: lp.is_locked === 1,
        tag: lp.tag,
        nftList: lp.NFT_list,
      })) ?? [],
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Risk Score Algorithm

```typescript
function computeTokenRiskScore(security: GoPlusTokenSecurity): number {
  let score = 0;
  
  // Critical (20 points each)
  if (security.is_honeypot === '1') score += 20;
  if (security.hidden_owner === '1') score += 20;
  if (security.self_destruct === '1') score += 20;
  if (security.can_take_back_ownership === '1') score += 20;
  
  // High (10 points each)
  if (security.is_mintable === '1') score += 10;
  if (Number(security.sell_tax) > 0.1) score += 10;
  if (Number(security.buy_tax) > 0.1) score += 10;
  if (security.is_open_source !== '1') score += 10;
  if (security.owner_change_balance === '1') score += 10;
  
  // Medium (5 points each)
  if (security.is_proxy === '1') score += 5;
  if (security.external_call === '1') score += 5;
  if (Number(security.holder_count) < 100) score += 5;
  if (Number(security.lp_holder_count) < 3) score += 5;
  
  // LP concentration
  const topLpPercent = security.lp_holders?.[0]?.percent;
  if (topLpPercent && Number(topLpPercent) > 0.9) score += 15;
  else if (topLpPercent && Number(topLpPercent) > 0.7) score += 10;
  
  return Math.min(score, 100);
}
```

### DeFi Hacks Timeline

```typescript
securityRoutes.get('/hacks', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') || 50), 200);
  const chain = c.req.query('chain');
  const minAmount = Number(c.req.query('min_amount') || 0);
  
  let hacks = await llama.getHacks();
  
  if (chain) hacks = hacks.filter(h => h.chain?.toLowerCase() === chain.toLowerCase());
  if (minAmount) hacks = hacks.filter(h => h.amount >= minAmount);
  
  hacks.sort((a, b) => b.date - a.date);
  
  return c.json({
    data: {
      hacks: hacks.slice(0, limit).map(h => ({
        name: h.name,
        amount: h.amount,
        chain: h.chain,
        classification: h.classification,    // 'Exploit', 'Rug Pull', 'Flash Loan', etc.
        technique: h.technique,
        date: new Date(h.date * 1000).toISOString(),
        link: h.link,
      })),
      totalStolen: hacks.reduce((sum, h) => sum + h.amount, 0),
      hackCount: hacks.length,
      byClassification: groupBy(hacks, 'classification'),
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Rug Pull Risk Assessment

```typescript
securityRoutes.get('/rugpull-check/:chainId/:address', async (c) => {
  const { chainId, address } = c.req.param();
  
  const [tokenSecurity, approvalSecurity] = await Promise.allSettled([
    goplus.getTokenSecurity(Number(chainId), address),
    goplus.getApprovalSecurity(Number(chainId), address),
  ]);
  
  // Compute rug pull probability based on:
  // 1. Owner holds large % of supply
  // 2. LP is not locked
  // 3. Contract is upgradeable
  // 4. Token is mintable
  // 5. Sell tax > 50%
  // 6. Few holders
  // 7. No verified source code
  
  return c.json({
    data: {
      address,
      chainId: Number(chainId),
      rugPullRisk: riskLevel,
      rugPullProbability: probability, // percentage
      factors: riskFactors,
      recommendation: probability > 70 ? 'DO NOT BUY' : probability > 40 ? 'EXTREME CAUTION' : probability > 20 ? 'MODERATE RISK' : 'LOW RISK',
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Acceptance Criteria

- [ ] All 12 endpoints compile and return JSON
- [ ] GoPlus token security properly parsed ("0"/"1" to booleans)
- [ ] Risk score algorithm covers all major vectors
- [ ] DeFi hacks data from DefiLlama properly formatted
- [ ] Rug pull assessment combines multiple security signals
- [ ] Honeypot detection returns clear warnings
- [ ] Chain ID validation covers supported networks
- [ ] Tests pass, committed and pushed as `nirholas`, terminals killed

### Hallucination Warning

GoPlus API returns ALL fields as strings (not numbers or booleans). `is_honeypot` is "0" or "1" (string). `buy_tax` and `sell_tax` are decimal strings like "0.05". The `holders` array has `is_contract` and `is_locked` as numbers (0 or 1), not strings. LP data has an `NFT_list` field (capital N-F-T). If unsure about GoPlus response structure, tell the prompter.
