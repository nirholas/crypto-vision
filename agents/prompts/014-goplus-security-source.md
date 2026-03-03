# Prompt 014 — GoPlus Security Source Adapter

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** Real implementations only.
2. **TypeScript strict mode** — no `any`, no `@ts-ignore`.
3. **Always kill terminals**, **commit and push as `nirholas`**.
4. **If close to hallucinating** — stop and tell the prompter.
5. **Run `npx tsc --noEmit` and `npx vitest run`** after changes.

---

## Task

Build `src/sources/goplus.ts` — adapter for GoPlus Security, a real-time token/contract security detection API. Essential for detecting honeypots, rug pulls, and malicious contracts.

### API Base URL

```
https://api.gopluslabs.io/api/v1    # v1 API
# No auth required for most endpoints
# Rate limit: ~5 req/sec
```

### Requirements

#### 1. Zod Schemas

- `TokenSecurityResult` — is_open_source, is_proxy, is_mintable, owner_address, creator_address, can_take_back_ownership, is_honeypot, honeypot_with_same_creator, transfer_pausable, trading_cooldown, buy_tax, sell_tax, is_anti_whale, anti_whale_modifiable, slippage_modifiable, is_blacklisted, is_whitelisted, holders[], lp_holders[], dex[], total_supply, holder_count, lp_holder_count, is_true_token, is_airdrop_scam, trust_list, other_potential_risks, note
- `AddressSecurityResult` — is_contract, is_malicious, is_phishing, contract_name, tag
- `ApprovalSecurityResult` — token_address, token_name, token_symbol, is_open_source, approved_amount, approved_spender, is_contract, tag
- `NFTSecurityResult` — nft_name, nft_symbol, nft_owner, is_open_source, privileged_burn, self_destruct, external_call, nft_erc, trust_list, averagePrice24h, highest_price, lowest_price24h
- `DexSecurityResult` — dex_name, pair_address, is_open_source, creator_address, creation_time, liquidity_type, initial_liquidity

#### 2. Exported Functions

**Token Security:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getTokenSecurity(chainId, addresses[])` | `/token_security/{chainId}?contract_addresses=` | 300s |
| `isHoneypot(chainId, address)` | Derived from token security | 300s |
| `getTokenRiskScore(chainId, address)` | Computed from all factors | 300s |

**Address Security:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getAddressSecurity(chainId, address)` | `/address_security/{chainId}?address=` | 300s |
| `isAddressMalicious(chainId, address)` | Derived | 300s |

**Approval Security:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getApprovalSecurity(chainId, address)` | `/approval_security/{chainId}?contract_addresses=` | 300s |
| `findRiskyApprovals(chainId, userAddress)` | Derived | 300s |

**NFT Security:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getNFTSecurity(chainId, address)` | `/nft_security/{chainId}?contract_addresses=` | 300s |

**DEX Security:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getDexSecurity(chainId, pairAddress)` | `/dex_security/{chainId}?contract_addresses=` | 300s |

**Phishing Site Detection:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `checkPhishingSite(url)` | `/phishing_site?url=` | 3600s |

#### 3. Risk Scoring Engine

```typescript
export function calculateTokenRiskScore(security: TokenSecurityResult): {
  score: number;          // 0-100 (higher = riskier)
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  risks: { factor: string; severity: 'low' | 'medium' | 'high' | 'critical'; description: string }[];
  summary: string;
}
// Scoring factors:
// - is_honeypot: +50
// - is_proxy + not_open_source: +30
// - sell_tax > 10%: +20
// - buy_tax > 10%: +15
// - is_mintable: +10
// - transfer_pausable: +10
// - is_anti_whale + anti_whale_modifiable: +10
// - holder_count < 50: +10
// - lp_holder_count < 3: +15
// - is_airdrop_scam: +40
// Grade: A (0-10), B (11-25), C (26-50), D (51-75), F (76-100)

export function batchSecurityCheck(chainId: string, addresses: string[]): Promise<Map<string, {
  address: string;
  score: number;
  grade: string;
  isHoneypot: boolean;
  topRisks: string[];
}>>
```

#### 4. Chain ID Mapping

```typescript
export const GOPLUS_CHAINS: Record<string, string> = {
  "1": "Ethereum",
  "56": "BSC",
  "137": "Polygon",
  "42161": "Arbitrum",
  "10": "Optimism",
  "8453": "Base",
  "43114": "Avalanche",
  "250": "Fantom",
  "25": "Cronos",
  "324": "zkSync Era",
  "59144": "Linea",
  "534352": "Scroll",
  "1101": "Polygon zkEVM",
  // ... all supported chains
}
export function resolveChainId(nameOrId: string): string
```

### Acceptance Criteria

- [ ] File compiles with zero errors
- [ ] All token, address, NFT, DEX, approval security functions work
- [ ] Risk scoring produces accurate, meaningful grades
- [ ] Batch operations handle multiple addresses efficiently
- [ ] Chain ID mapping covers all GoPlus-supported chains
- [ ] `src/routes/security.ts` imports work
- [ ] All tests pass, committed and pushed as `nirholas`, terminals killed

### Hallucination Warning

GoPlus returns boolean fields as STRING "0" or "1", NOT actual booleans. Tax fields are strings like "0.05" (5%), not decimals. The response wraps data in `{ code: 1, result: { address: { ... } } }` — the result keys are the contract addresses. If unsure, tell the prompter.
