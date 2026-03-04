# Prompt 16: x402 UCAI — Complete Gas Sponsorship, Transaction Simulation & Refund Logic

## Agent Identity & Rules

```
You are completing placeholder implementations in the x402 UCAI (Universal Contract AI) module.
- Always work on the current branch
- Before any git commit or push, configure:
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
- Always use background terminals (isBackground: true)
- Always kill terminals after commands complete
- No mocks, no stubs, no placeholders — every function must do real work
- TypeScript strict mode — no `any` types, no `@ts-ignore`
- Use viem for all EVM interactions (the project standard)
```

## Objective

Complete three files in `packages/mcp-server/x402/ucai/` that have placeholder implementations:

1. **`gas-sponsorship.ts`** — `getPaymasterData()` returns placeholder signature `"0".repeat(130)` and `hashUserOp()` uses simplified hashing
2. **`transaction-simulation.ts`** — `simulateWithTrace()` has placeholder comment: "real implementation would parse actual trace"
3. **`payment.ts`** — `refundPayment()` has `// TODO: Implement actual refund logic` and just returns `true`

## Context

### File 1: gas-sponsorship.ts (471 lines)

Read the full file at `packages/mcp-server/x402/ucai/gas-sponsorship.ts`.

Current placeholders:

**`getPaymasterData()` (line ~309-320):**
```typescript
private async getPaymasterData(userOp, paymasterAddress, network): Promise<Hex> {
  // For now, return a placeholder
  const validUntil = Math.floor(Date.now() / 1000) + 3600
  const validAfter = Math.floor(Date.now() / 1000) - 60
  const paymasterData = paymasterAddress + 
    validUntil.toString(16).padStart(12, "0") +
    validAfter.toString(16).padStart(12, "0") +
    "0".repeat(130) // Placeholder signature  ← FAKE
  return paymasterData as Hex
}
```

**`hashUserOp()` (line ~325-340):**
```typescript
private hashUserOp(userOp, network): Hash {
  // Simplified hash - real implementation would use proper encoding  ← FAKE
  const packed = [userOp.sender, userOp.nonce.toString(), ...].join("")
  return `0x${Buffer.from(packed).toString("hex").slice(0, 64).padEnd(64, "0")}` as Hash
}
```

### File 2: transaction-simulation.ts (505 lines)

Read the full file at `packages/mcp-server/x402/ucai/transaction-simulation.ts`.

Current placeholder in **`simulateWithTrace()` (line ~257):**
```typescript
// Try eth_simulateV1 (newer nodes)
const result = await client.request({ method: "eth_call", params: [...] })
// This is a placeholder - real implementation would parse actual trace  ← NOT PARSING
```

The function currently does `eth_call` but never parses the result into `stateChanges` and `events`. The returned arrays are always empty.

### File 3: payment.ts (799 lines)

Read the full file at `packages/mcp-server/x402/ucai/payment.ts`.

Current placeholder in **`refundPayment()` (line ~397-407):**
```typescript
async refundPayment(paymentId: string): Promise<boolean> {
  Logger.info(`Refund requested for payment ${paymentId}`)
  if (paymentId.startsWith("sim_")) { return true }
  // TODO: Implement actual refund logic  ← NOT IMPLEMENTED
  return true  // Always returns true without doing anything
}
```

## Deliverables

### 1. Complete `getPaymasterData()` in gas-sponsorship.ts

Implement proper ERC-4337 paymaster data signing:

```typescript
private async getPaymasterData(
  userOp: UserOperation,
  paymasterAddress: Address,
  network: string
): Promise<Hex> {
  // 1. Get the paymaster contract's signing key from env (UCAI_PAYMASTER_SIGNER_KEY)
  // 2. Construct the paymaster hash per ERC-4337 spec:
  //    keccak256(abi.encode(userOp.sender, userOp.nonce, keccak256(userOp.callData), 
  //    callGasLimit, verificationGasLimit, preVerificationGas, maxFeePerGas, 
  //    maxPriorityFeePerGas, validUntil, validAfter))
  // 3. Sign the hash with the paymaster signer key via viem's signMessage
  // 4. Encode: paymasterAddress + abi.encode(validUntil, validAfter) + signature
  // 5. Return as Hex
  
  // If UCAI_PAYMASTER_SIGNER_KEY is not set:
  // - Log warning
  // - Return encoded data without signature (will fail on-chain but won't crash)
}
```

Use viem's `encodePacked`, `keccak256`, and `signMessage` utilities.

### 2. Complete `hashUserOp()` in gas-sponsorship.ts

Implement the proper ERC-4337 UserOperation hash:

```typescript
private hashUserOp(userOp: UserOperation, network: string): Hash {
  const entryPoint = this.config.entryPointAddresses[network] ?? ENTRY_POINT_V07
  const chainId = CHAINS[network]?.id
  
  // Per ERC-4337 spec:
  // 1. Pack the UserOp fields: abi.encode(sender, nonce, hashCallData, callGasLimit, 
  //    verificationGasLimit, preVerificationGas, maxFeePerGas, maxPriorityFeePerGas, hashPaymasterData)
  // 2. Hash the packed data: keccak256(packed)
  // 3. Hash with entryPoint and chainId: keccak256(abi.encode(userOpHash, entryPoint, chainId))
  
  // Use viem's encodeAbiParameters and keccak256
}
```

### 3. Complete `simulateWithTrace()` in transaction-simulation.ts

Replace the placeholder with real trace parsing:

```typescript
private async simulateWithTrace(client, from, to, data, value, network) {
  const stateChanges: StateChange[] = []
  const events: SimulatedEvent[] = []

  try {
    // Strategy 1: Try debug_traceCall (Geth/Erigon nodes)
    const trace = await client.request({
      method: "debug_traceCall",
      params: [{ from, to, data, value: value ? `0x${value.toString(16)}` : "0x0" }, "latest", 
        { tracer: "callTracer", tracerConfig: { withLog: true } }],
    })
    
    // Parse trace.logs into SimulatedEvent[]
    // Parse trace.calls into nested call tree for state changes
    
  } catch {
    // Strategy 2: Fall back to eth_call + getLogs simulation
    try {
      // Use eth_call with state overrides to simulate
      const result = await client.request({ method: "eth_call", params: [...] })
      
      // Use eth_estimateGas to verify the transaction would succeed
      const gasUsed = await client.estimateGas({ from, to, data, value })
      
      return { stateChanges, events, gasUsed }
    } catch (callError) {
      // Strategy 3: Return what we can with error context
      Logger.debug("Both trace methods failed, returning partial results")
    }
  }

  return { stateChanges, events }
}
```

### 4. Complete `refundPayment()` in payment.ts

Implement real refund logic:

```typescript
async refundPayment(paymentId: string): Promise<boolean> {
  Logger.info(`Refund requested for payment ${paymentId}`)
  
  if (paymentId.startsWith("sim_")) {
    return true // Simulated payments don't need refunds
  }
  
  // 1. Look up the original payment by paymentId
  //    - Parse the paymentId format: "pay_{txHash}_{timestamp}"
  //    - Extract the original txHash
  
  // 2. Verify the original payment exists on-chain
  //    - Use publicClient.getTransactionReceipt(txHash)
  //    - Verify it was a USDC transfer
  //    - Extract sender and amount
  
  // 3. Execute refund transfer
  //    - Send USDC from platform wallet back to original sender
  //    - Use the same chain as the original payment
  //    - Handle insufficient balance gracefully
  
  // 4. Log the refund with the refund txHash
  
  // 5. If refund fails (insufficient balance, network error):
  //    - Log the failure
  //    - Return false
  //    - Don't crash — the caller handles the failure
  
  // If UCAI_REFUND_PRIVATE_KEY is not set, log warning and return false
}
```

## Constraints

- All EVM interactions must use viem (not ethers.js)
- Private keys come from environment variables, never hardcode them
- If env vars for signing keys are missing, functions should degrade gracefully (log warning + return error) not crash
- The trace parsing in `simulateWithTrace()` must handle different node implementations (Geth, Erigon, Alchemy, Infura all have slightly different trace formats)
- Gas sponsorship signing must follow the exact ERC-4337 v0.7 specification
- All financial operations must log structured data for audit trails

## Verification

1. `grep -rn "placeholder" packages/mcp-server/x402/ucai/gas-sponsorship.ts` → zero matches (case-insensitive)
2. `grep -rn "placeholder" packages/mcp-server/x402/ucai/transaction-simulation.ts` → zero matches
3. `grep -rn "TODO" packages/mcp-server/x402/ucai/payment.ts` → zero matches
4. `grep -rn "Placeholder" packages/mcp-server/x402/ucai/gas-sponsorship.ts` → zero matches
5. TypeScript compiles without errors
6. No `any` types introduced
