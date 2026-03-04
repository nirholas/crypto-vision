# Prompt 06 — Pump Agent Swarm: Fix Builds, Types & Dependencies

## Context

You are working on `packages/pump-agent-swarm/` in the crypto-vision monorepo. This is an autonomous Solana trading swarm for Pump.fun tokens. It has ~62K lines of code across 86 files but has build issues and dependency problems that need fixing.

**Package**: `@nirholas/pump-agent-swarm` v0.1.0
**Chain**: Solana (mainnet-beta / devnet)
**Key deps**: `@solana/web3.js`, `@pump-fun/pump-sdk`, `bn.js`, `bs58`, `hono`, `pino`

## Current Issues

The package has a `postinstall` script that tries to compile the pump-sdk's TypeScript:
```json
"postinstall": "cd node_modules/@pump-fun/pump-sdk && npx tsc --declaration ..."
```

This is brittle. The build and type system need to be solid.

## Task

### 1. Fix Dependencies & Build

- Run `npm install` and fix any dependency resolution issues
- Ensure `@pump-fun/pump-sdk` installs correctly (if not published to npm, check if it's a git dependency or needs a local type declaration)
- Review `src/pump-sdk.d.ts` — this is the fallback type declaration. Make it comprehensive
- Fix all import paths throughout the codebase
- Ensure `npm run build` (`tsc -p tsconfig.build.json`) succeeds with zero errors

### 2. Fix TypeScript Types (`src/types.ts`)

Review and fix the complete type system:
- Ensure all types using `BN` (from bn.js) are properly imported
- Ensure `Keypair` imports from `@solana/web3.js` are correct
- Fix any circular dependency issues
- Add missing type exports to barrel files (`src/index.ts`, `src/agents/index.ts`, etc.)
- Ensure all 18 `SwarmPhase` states are properly typed
- Verify all 11 `AgentRole` types match actual agent implementations

### 3. Fix Barrel Exports

Each subdirectory has an `index.ts` barrel file. Verify all exports:
- `src/index.ts` — Main package entry
- `src/agents/index.ts` — All 10 agent types + MarketMakerAgent
- `src/trading/index.ts` — All trading engine modules
- `src/bundle/index.ts` — All bundle modules
- `src/intelligence/index.ts` — All intelligence modules
- `src/coordination/index.ts` — All coordination modules
- `src/dashboard/index.ts` — Dashboard + server + API
- `src/infra/index.ts` — EventBus, Logger, Metrics, RpcPool, ErrorHandler
- `src/config/index.ts` — Configuration
- `src/api/index.ts` — API routes + screener
- `src/demo/index.ts` — Demo mode
- `src/x402/index.ts` — x402 payment integration

### 4. Fix TSConfig

Review `tsconfig.json` and `tsconfig.build.json`:
- Ensure strict mode is on
- Ensure ESM output (`"module": "ESNext"`)
- Ensure path aliases resolve correctly
- Exclude test files from build
- Include all src/ files

### 5. Fix the `strategies.ts` File

Verify the 4 preset strategies compile and have sensible defaults:
- `STRATEGY_ORGANIC` — Conservative accumulation
- `STRATEGY_VOLUME` — Volume generation
- `STRATEGY_GRADUATION` — Push to graduation
- `STRATEGY_EXIT` — Coordinated exit

Ensure all `BN` values are properly constructed.

### 6. Fix `wallet-manager.ts`

- Ensure HD wallet derivation works correctly
- Ensure random keypair generation works
- Fix any `Keypair` / `PublicKey` import issues
- Verify SOL balance checking functions

### 7. Fix `swarm.ts` (SwarmCoordinator)

- Fix all imports
- Ensure the EventEmitter typing is correct
- Verify the state machine transitions compile
- Ensure the `run()` method's async flow is correct
- Fix any error handling gaps

### 8. Add Vitest Config

Create `packages/pump-agent-swarm/vitest.config.ts` if missing. Configure for the package's test files.

### 9. Verify CLI

Fix `src/cli.ts`:
- Ensure it can be run with `npx tsx src/cli.ts`
- Interactive mode with strategy selection
- Config file loading from `.env` or CLI args

## Verification

Run these commands and ensure they all pass:
```bash
cd packages/pump-agent-swarm
npm install          # No errors
npm run typecheck    # No TypeScript errors
npm run build        # Compiles to dist/
npm run cli -- --help  # Shows CLI help (or at least doesn't crash)
```

## Files to Fix

- `packages/pump-agent-swarm/package.json` — Fix scripts, deps
- `packages/pump-agent-swarm/tsconfig.json` — Fix config
- `packages/pump-agent-swarm/tsconfig.build.json` — Fix build config
- `packages/pump-agent-swarm/src/types.ts` — Fix all types
- `packages/pump-agent-swarm/src/pump-sdk.d.ts` — Complete type declarations
- `packages/pump-agent-swarm/src/index.ts` — Fix barrel export
- `packages/pump-agent-swarm/src/*/index.ts` — Fix all barrel exports
- `packages/pump-agent-swarm/src/strategies.ts` — Fix BN usage
- `packages/pump-agent-swarm/src/wallet-manager.ts` — Fix wallet logic
- `packages/pump-agent-swarm/src/swarm.ts` — Fix coordinator
- `packages/pump-agent-swarm/src/cli.ts` — Fix CLI
