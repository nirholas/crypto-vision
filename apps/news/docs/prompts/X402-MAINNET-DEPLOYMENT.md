# x402 Mainnet Deployment

**Priority:** Medium | **Effort:** 1-2 days | **Impact:** High  
**Dependency:** None (testnet infrastructure already complete)

---

## Objective

Transition x402 crypto payments from Base Sepolia testnet to Base mainnet for production use. The entire x402 system is already built (17 files across `src/lib/x402/` and `src/components/x402/`). This task flips the network config, sets up production facilitator (CDP), verifies payment flows, and adds production monitoring.

---

## Implementation Prompt

> Transition the x402 payment system from Base Sepolia testnet to Base mainnet. The system is fully built in `src/lib/x402/` (config, server, pricing, rate-limit, features, auth, routes) and `src/components/x402/` (PaymentProvider, PaywallBanner, PaymentSuccessToast). The config in `src/lib/x402/config.ts` already has mainnet constants — just needs env vars set and production verification.

### Current State

The x402 system already handles:
- Network detection: `IS_PRODUCTION` → `BASE_MAINNET`, else `BASE_SEPOLIA`
- Facilitator selection: Production → CDP (`api.cdp.coinbase.com`), Dev → x402.org
- Payment address: `X402_PAYMENT_ADDRESS` env var
- USDC token addresses: Both mainnet (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) and Sepolia configured
- Pricing tiers: Free, Basic ($0.01/req), Pro ($0.05/req), Enterprise ($0.10/req)
- PaymentProvider React component with wallet connection (wagmi/viem)
- PaywallBanner component for premium content gating

### Checklist

#### 1. Environment Variables (Production)
```env
# Required for mainnet
X402_PAYMENT_ADDRESS=0x<your-mainnet-wallet>     # Real USDC receiving wallet
X402_TESTNET=false                                # Disable testnet mode
X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
CDP_API_KEY=<your-cdp-api-key>                    # Coinbase Developer Platform key
CDP_API_SECRET=<your-cdp-api-secret>

# Optional overrides
X402_NETWORK=eip155:8453                          # Explicit Base mainnet
X402_MAX_AMOUNT_USDC=1.00                         # Safety cap per request
```

#### 2. Code Changes Required

- **`src/lib/x402/config.ts`**: Add production safety checks
  - Validate `X402_PAYMENT_ADDRESS` is not zero address in production
  - Add `X402_MAX_AMOUNT_USDC` safety cap (prevent overcharging bugs)
  - Log network mode on startup (mainnet vs testnet) at warn level
  
- **`src/lib/x402/server.ts`**: Add production middleware
  - Request logging: log all payment attempts (amount, payer, status)
  - Receipt verification: double-check facilitator receipts on mainnet
  - Idempotency: prevent double-charging (track payment IDs)
  
- **`src/components/x402/PaymentProvider.tsx`**: Update UI
  - Remove "⚠️ Testnet mode" banner when on mainnet
  - Show real USDC amounts (not test tokens)
  - Add confirmation dialog before payment: "You are about to pay $X.XX USDC on Base"
  - Add transaction explorer link (basescan.org) after payment

- **`src/components/x402/PaywallBanner.tsx`**: Production polish
  - Show tier pricing clearly
  - Add "Powered by x402" footer link
  - Indicate real money vs test tokens based on network

- **`src/app/[locale]/pricing/upgrade/page.tsx`**: Remove testnet warnings
  - Line 325: Conditionally show "⚠️ Testnet mode - using Base Sepolia" only when `IS_TESTNET`
  - Show Base Mainnet info for production

#### 3. Production Safety

- [ ] **Amount cap**: Max $1.00 USDC per single request (configurable via env)
- [ ] **Rate limiting**: Max 100 paid requests per wallet per hour
- [ ] **Refund mechanism**: Admin endpoint to trigger refund for failed deliveries
- [ ] **Monitoring**: Alert if payment volume exceeds $100/day (unusual for early launch)
- [ ] **Kill switch**: `X402_PAYMENTS_ENABLED=false` to instantly disable all payments
- [ ] **Audit log**: Persist all transactions to `data/x402/transactions.jsonl`

#### 4. Testing Before Launch

```bash
# 1. Verify mainnet config detection
curl https://cryptocurrency.cv/.well-known/x402 | jq '.network'
# Expected: "eip155:8453"

# 2. Test payment discovery
curl https://cryptocurrency.cv/api/.well-known/x402 | jq '.'
# Should show mainnet USDC address and pricing

# 3. Test premium endpoint without payment (should get 402)
curl -I https://cryptocurrency.cv/api/v1/premium/analysis
# Expected: HTTP 402 Payment Required

# 4. Test with real micropayment (manual)
# Use browser wallet on Base mainnet, submit $0.01 USDC payment
# Verify: receipt returned, premium content delivered, transaction logged
```

#### 5. Deployment Steps

1. Set production env vars in Vercel dashboard
2. Deploy to preview branch first — test with real wallet on mainnet
3. Verify CDP facilitator connection successful
4. Run through payment flow manually with $0.01 test payment
5. Check audit log captures transaction correctly
6. Merge to main for production deployment
7. Monitor first 24 hours: check transaction logs, error rates, facilitator responses

#### 6. Rollback Plan

- If issues: Set `X402_PAYMENTS_ENABLED=false` in Vercel env → instant disable
- If facilitator down: Set `X402_FACILITATOR_URL` back to x402.org → falls back to testnet
- If overcharging bug: Set `X402_MAX_AMOUNT_USDC=0` → blocks all payments

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/x402/config.ts` | Add safety cap, startup warning, address validation |
| `src/lib/x402/server.ts` | Add payment logging, receipt verification, idempotency |
| `src/components/x402/PaymentProvider.tsx` | Mainnet UI, confirmation dialog, explorer links |
| `src/components/x402/PaywallBanner.tsx` | Production pricing display |
| `src/app/[locale]/pricing/upgrade/page.tsx` | Conditional testnet banner |
| `.env.production` (new) | Template with required mainnet env vars |

### Monitoring Dashboard

After launch, track:
- Total transactions per day
- Revenue per day (USDC)
- Payment success rate (%)
- Average time to payment confirmation
- Facilitator response times
- Failed payment reasons breakdown
