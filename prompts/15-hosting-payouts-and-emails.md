# Prompt 15: MCP Hosting Platform — Real USDC Payouts & Stripe Email Notifications

## Agent Identity & Rules

```
You are implementing real USDC payout transfers and Stripe email notifications for the MCP Hosting Platform.
- Always work on the current branch
- Before any git commit or push, configure:
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
- Always use background terminals (isBackground: true)
- Always kill terminals after commands complete
- No mocks, no stubs, no placeholders — every function must do real work
- TypeScript strict mode — no `any` types, no `@ts-ignore`
```

## Objective

Fix two remaining placeholder implementations in the MCP Hosting Platform:

1. **`hosting/revenue.ts` → `processPayouts()`** — Currently returns a fake `txHash: "0x" + "0".repeat(64)` instead of sending real USDC transfers
2. **`hosting/stripe.ts` → invoice.payment_failed webhook** — Has `// TODO: Send email notification to user` with no implementation

## Context

### Problem 1: Fake Payouts in revenue.ts

In `packages/mcp-server/hosting/revenue.ts` (line ~519-543), the `processPayouts()` function:
- Correctly calculates payout amounts
- Correctly validates payout addresses and minimum thresholds
- But then does this:

```typescript
// TODO: Implement actual USDC transfer
Logger.warn(`Revenue: Payout processing not fully implemented. Would send $${payout.pendingAmount.toFixed(2)} to ${payout.payoutAddress}`)

// Mark payments as paid out without actually sending
results.push({
  userId: payout.userId,
  amount: payout.pendingAmount,
  txHash: "0x" + "0".repeat(64), // Placeholder  ← THIS IS FAKE
  chain,
  status: "success",
})
```

### Problem 2: Missing Email Notification in stripe.ts

In `packages/mcp-server/hosting/stripe.ts` (line ~161):
```typescript
case 'invoice.payment_failed': {
  const invoice = event.data.object as Stripe.Invoice;
  Logger.warn('Payment failed', { customerId: invoice.customer, invoiceId: invoice.id });
  // TODO: Send email notification to user  ← NOT IMPLEMENTED
  break;
}
```

### Available Infrastructure

The x402 module already has wallet/signing capabilities. Read these files for context:

- `packages/mcp-server/x402/client.ts` — exports `createEvmSigner()`, `createX402Client()`
- `packages/mcp-server/x402/sdk/client.ts` — `X402Client` class with `sendPayment()` method
- `packages/mcp-server/x402/config.ts` — chain configuration, USDC addresses, RPC URLs
- `packages/mcp-server/x402/verify.ts` — exports `USDC_ADDRESSES` with addresses per chain, `getUSDCAddress()`
- `packages/mcp-server/x402/sdk/types.ts` — `X402Chain`, `PaymentResult` types

The project uses viem for EVM interactions. Key patterns:
```typescript
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, arbitrum } from 'viem/chains'
```

### USDC Transfer Pattern

Standard USDC transfer via viem:
```typescript
const account = privateKeyToAccount(privateKey)
const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })

const txHash = await walletClient.writeContract({
  address: usdcAddress,
  abi: erc20Abi,
  functionName: 'transfer',
  args: [recipientAddress, parseUnits(amount, 6)], // USDC has 6 decimals
})
```

## Deliverables

### 1. Implement real USDC payouts in `hosting/revenue.ts`

Replace the placeholder in `processPayouts()` with actual on-chain USDC transfers:

```typescript
export async function processPayouts(
  userIds?: string[],
  chain: SupportedChainId = 8453 // Base
): Promise<PayoutResult[]> {
  // ... existing filtering logic stays the same ...
  
  for (const payout of payoutsToProcess) {
    // 1. Validate payout address is a valid Ethereum address
    // 2. Get the platform's wallet from env (HOSTING_PAYOUT_PRIVATE_KEY)
    // 3. Check platform wallet has sufficient USDC balance for the payout
    // 4. Execute real USDC transfer via viem writeContract
    // 5. Wait for transaction confirmation (1 block)
    // 6. Store the REAL txHash in the result
    // 7. Update payment records status to 'paid_out' with real txHash
    // 8. Handle failures: if tx reverts, set status to "failed" with error
  }
}
```

Requirements:
- Use `HOSTING_PAYOUT_PRIVATE_KEY` env var for the platform wallet that sends payouts
- Validate the private key exists before attempting any payouts
- Check USDC balance before each payout attempt (don't send if insufficient)
- Use proper gas estimation (don't hardcode gas limits)
- Add retry logic: if a payout fails due to nonce issues, retry once with incremented nonce
- Log every payout attempt with structured JSON: `{ userId, amount, recipient, txHash, chain }`
- Return real transaction hashes, never placeholder hashes
- If `HOSTING_PAYOUT_PRIVATE_KEY` is not set, return all payouts as failed with error "Platform payout wallet not configured"

### 2. Implement email notifications in `hosting/stripe.ts`

Add real email sending for failed payments. Use Resend (the project-preferred email provider) or fall back to Stripe's built-in email:

**Option A: Resend (preferred if RESEND_API_KEY is set)**
```typescript
// npm install resend (check if already in package.json)
import { Resend } from 'resend'

async function sendPaymentFailedEmail(customerId: string, invoiceId: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    Logger.warn('RESEND_API_KEY not set, skipping email notification')
    return
  }
  
  const resend = new Resend(resendKey)
  // Look up user email from customerId
  // Send professional HTML email about failed payment
  // Include link to update payment method
}
```

**Option B: Stripe-native (fallback)**
If RESEND_API_KEY is not available, use Stripe's built-in email receipts which are already configured.

The email should:
- Notify the user their payment failed
- Include the invoice amount and date
- Include a link to their Stripe Customer Portal to update payment method
- Include a deadline (subscription will be cancelled if not resolved in 7 days)
- Be professionally formatted HTML
- Use `noreply@agenti.cash` as the from address

### 3. Also handle these webhook events with email notifications:

- `customer.subscription.deleted` → Send "Your subscription has been cancelled" email
- `checkout.session.completed` → Send "Welcome to {tier}!" confirmation email

### 4. Create helper: `packages/mcp-server/hosting/email.ts`

Extract email logic into a reusable module:

```typescript
export async function sendEmail(options: {
  to: string
  subject: string
  html: string
  text?: string
}): Promise<boolean>

export async function sendPaymentFailedEmail(email: string, invoiceAmount: number): Promise<void>
export async function sendSubscriptionCancelledEmail(email: string, tier: string): Promise<void>
export async function sendWelcomeEmail(email: string, tier: string): Promise<void>
export async function sendPayoutSentEmail(email: string, amount: number, txHash: string, chain: string): Promise<void>
```

## Constraints

- Never log private keys or full wallet addresses in logs (mask them)
- The payout function must be idempotent — if called twice for the same payments, the second call should detect already-paid records and skip them
- Email sending must be non-blocking — don't let a failed email notification break the webhook handler
- Add rate limiting on payouts: max 100 payouts per batch, max $10,000 per batch
- All amounts in USDC (6 decimals)

## Verification

1. `grep -n "0.*repeat.*64" packages/mcp-server/hosting/revenue.ts` → zero matches (no more fake hashes)
2. `grep -n "TODO" packages/mcp-server/hosting/revenue.ts` → zero matches
3. `grep -n "TODO" packages/mcp-server/hosting/stripe.ts` → zero matches
4. `grep -n "placeholder" packages/mcp-server/hosting/revenue.ts` → zero matches (case-insensitive)
5. TypeScript compiles without errors
6. New email.ts has proper error handling and doesn't crash on missing env vars
