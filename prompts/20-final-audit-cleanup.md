# Prompt 20: Final Audit — Eliminate ALL Remaining TODOs, Placeholders & Stubs

## Agent Identity & Rules

```
You are performing a final sweep of the entire codebase to eliminate every remaining TODO, placeholder, stub, and fake implementation.
- Always work on the current branch
- Before any git commit or push, configure:
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
- Always use background terminals (isBackground: true)
- Always kill terminals after commands complete
- No mocks, no stubs, no placeholders — every function must do real work
- TypeScript strict mode — no `any` types, no `@ts-ignore`
- If you can't implement something fully, convert the TODO to a proper Logger.warn() that explains the limitation at runtime instead of silently faking data
```

## Objective

After prompts 13–19 have been applied, perform a comprehensive sweep to catch anything that was missed. This is the "leave no stone unturned" pass.

## Process

### Step 1: Full grep audit

Run these commands and fix EVERY match:

```bash
# TODOs in source files (exclude node_modules, dist, .git, lock files)
grep -rn "TODO" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git packages/ src/ apps/ scripts/ agents/src/

# Placeholders
grep -rni "placeholder" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=dist packages/ src/

# Stubs
grep -rni "stub\|not yet implemented\|not implemented\|coming soon\|implement later" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=dist packages/ src/

# Fake/dummy data
grep -rni "fake\|dummy\|hardcoded.*value\|mock.*data" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=__tests__ packages/ src/

# Suspicious patterns
grep -rn "\"0\".repeat\|'0'.repeat\|0x0000000000" --include="*.ts" --exclude-dir=node_modules --exclude-dir=dist packages/ src/

# Empty function bodies
grep -rn "=> {}" --include="*.ts" --exclude-dir=node_modules --exclude-dir=dist packages/ src/

# Always-true returns that skip logic
grep -rn "return true.*//\|return false.*//\|return null.*//\|return \[\].*//" --include="*.ts" --exclude-dir=node_modules --exclude-dir=dist packages/ src/
```

### Step 2: For each match, decide the action

For each TODO/placeholder found:

1. **If it's genuine unfinished work** → Implement it fully
2. **If it's a legitimate limitation** (e.g., "testnet contract not deployed") → Replace the TODO comment with a proper runtime check:
   ```typescript
   // BAD:
   // TODO: Replace with real address
   const addr = '0x555...'
   
   // GOOD:
   const addr = getContractAddress(network)
   if (!addr) {
     Logger.warn(`Contract not deployed on ${network}`)
     return { error: `Unsupported network: ${network}` }
   }
   ```
3. **If it's in test files** (`__tests__/`, `tests/`) → These are acceptable (test mocks are fine per project conventions in test files only)
4. **If it's in documentation** (`.md` files, comments explaining what TODO means in user instructions) → Leave as-is (these are instructional, not code stubs)
5. **If it's an empty file** → Either implement it or delete it

### Step 3: Check for `any` types and `@ts-ignore`

```bash
grep -rn ": any\|as any\|@ts-ignore\|@ts-expect-error" --include="*.ts" --exclude-dir=node_modules --exclude-dir=dist packages/mcp-server/ src/
```

For each match:
- Replace `any` with proper types
- Remove `@ts-ignore` by fixing the underlying type issue
- If truly unavoidable, add a comment explaining why: `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK types are incomplete`

### Step 4: Verify all exports are used

```bash
# Check for orphaned exports in the hosting module
grep -rn "export " packages/mcp-server/hosting/*.ts | grep -v "node_modules"
```

For each export, verify something imports it. Remove dead exports.

### Step 5: Check package.json for unused dependencies

```bash
# In packages/mcp-server/
cd packages/mcp-server && npx depcheck --json 2>/dev/null | head -50
```

Remove any unused dependencies.

## Known Issues to Check (from previous audit)

These should have been fixed by prompts 13-19, but verify they're actually resolved:

| File | Issue | Expected State |
|------|-------|----------------|
| `hosting/auth.ts` | In-memory Map storage | Should use PostgreSQL |
| `hosting/router.ts` | In-memory Map for servers | Should use PostgreSQL |
| `hosting/runtime.ts` | `throw new Error("Proxy tools not yet implemented")` | Should be implemented |
| `hosting/runtime.ts` | `return { error: "Not implemented" }` | Should be implemented |
| `hosting/runtime.ts` | `// TODO: Verify payment on-chain` | Should verify payment |
| `hosting/runtime.ts` | `// TODO: Load config from database` | Should query DB |
| `hosting/revenue.ts` | `txHash: "0x" + "0".repeat(64)` | Should be real txHash |
| `hosting/revenue.ts` | `// TODO: Implement actual USDC transfer` | Should transfer USDC |
| `hosting/stripe.ts` | `// TODO: Send email notification` | Should send email |
| `hosting/types.ts` | `// TODO: Check database for existing subdomains` | Should query DB |
| `x402/ucai/gas-sponsorship.ts` | `"0".repeat(130)` placeholder signature | Should be real signature |
| `x402/ucai/transaction-simulation.ts` | Placeholder trace parsing | Should parse real traces |
| `x402/ucai/payment.ts` | `// TODO: Implement actual refund logic` | Should refund |
| `x402/sdk/yield/tracker.ts` | Placeholder APY and yield history | Should query on-chain |
| `x402/sdk/wallet/yielding-wallet.ts` | Placeholder swap integration | Should use DEX |
| `x402/utils/index.ts` | `0x5555...` placeholder address | Should be real or removed |
| `x402/cli/commands/history.ts` | Returns empty array | Should query blockchain |
| `x402/index.ts` | Server & UCAI tools not registered | Should be registered |
| `src/sources/etf.ts` | Placeholder daily return comparison | Should compute real returns |
| `src/bot/db/ecosystem-schema.ts` | Empty file | Should be deleted |

## Deliverables

A clean codebase where:
1. Zero `// TODO` comments in production source code (tests exempted)
2. Zero placeholder data in production code
3. Zero `throw new Error("Not implemented")` patterns
4. Zero fake transaction hashes or signatures
5. Zero empty source files
6. All `any` types in `hosting/` and core `x402/` files are replaced with proper types

## Verification (run all of these)

```bash
# These should all return zero matches in production code:
echo "=== TODOs ===" && grep -rn "TODO" --include="*.ts" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=__tests__ --exclude-dir=tests packages/mcp-server/hosting/ packages/mcp-server/x402/ src/sources/etf.ts src/bot/db/ | grep -v "\.test\." | grep -v "\.spec\." | wc -l

echo "=== Placeholders ===" && grep -rni "placeholder" --include="*.ts" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=__tests__ packages/mcp-server/hosting/ packages/mcp-server/x402/ src/sources/etf.ts | wc -l

echo "=== Not Implemented ===" && grep -rni "not.*implemented\|not yet" --include="*.ts" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=__tests__ packages/mcp-server/hosting/ packages/mcp-server/x402/ | wc -l

echo "=== Fake Hashes ===" && grep -rn "\"0\".repeat\|'0'.repeat" --include="*.ts" --exclude-dir=node_modules --exclude-dir=dist packages/mcp-server/hosting/ packages/mcp-server/x402/ | wc -l

echo "=== Empty Files ===" && find src/ packages/ -name "*.ts" -empty 2>/dev/null | wc -l
```

All counts should be **0**.

After confirming, commit:
```bash
git add -A && git commit -m "chore: eliminate all TODOs, placeholders, and stubs across hosting and x402"
```
