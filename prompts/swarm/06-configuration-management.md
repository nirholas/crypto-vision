# Prompt 06 — Configuration Management System

## Agent Identity & Rules

```
You are the CONFIG agent. Build the configuration management system.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add configuration management with env loading and validation"
```

## Objective

Create `packages/pump-agent-swarm/src/config/` directory with environment variable loading, validation, defaults, and runtime config management.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/config/index.ts`
- **Creates**: `packages/pump-agent-swarm/src/config/env.ts`
- **Creates**: `packages/pump-agent-swarm/src/config/defaults.ts`
- **Creates**: `packages/pump-agent-swarm/src/config/validation.ts`

## Dependencies

- `../types.ts` — `SwarmMasterConfig` and all config sub-types (P01)
- `dotenv` — optional, caller's responsibility for `.env` file parsing

## Deliverables

### 1. `config/env.ts` — Environment Variable Loader

```typescript
/**
 * Load all swarm configuration from environment variables.
 * Every field maps to a specific env var. No .env file parsing needed —
 * that's the caller's responsibility (dotenv, Docker, etc.)
 */
```

Required env vars:
- `SOLANA_RPC_URL` — primary RPC URL
- `SOLANA_RPC_URL_2`, `SOLANA_RPC_URL_3` — optional additional RPCs  
- `SOLANA_WS_URL` — WebSocket URL
- `SOLANA_NETWORK` — `mainnet-beta` or `devnet`
- `MASTER_WALLET_SECRET_KEY` — base58 creator/funder wallet
- `MASTER_SEED_PHRASE` — BIP-39 mnemonic for HD derivation (alternative to individual keys)
- `TRADER_COUNT` — number of trader agents (default: 5)
- `TOKEN_NAME`, `TOKEN_SYMBOL`, `TOKEN_METADATA_URI` — for token creation
- `DEV_BUY_SOL` — dev buy amount in SOL (default: 0.5)
- `BUNDLE_SIZE` — number of bundle wallets (default: 3)
- `STRATEGY` — strategy preset name (default: 'organic')
- `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL` — for narrative generation
- `OPENROUTER_API_KEY` — OpenRouter key
- `JITO_BLOCK_ENGINE_URL` — Jito endpoint
- `JITO_TIP_LAMPORTS` — Jito tip amount
- `X402_PRIVATE_KEY`, `X402_API_URL` — x402 analytics
- `DASHBOARD_PORT` — dashboard server port (default: 8080)
- `DASHBOARD_AUTH_TOKEN` — dashboard authentication
- `LOG_LEVEL` — debug/info/warn/error (default: info)
- `MAX_LOSS_SOL` — emergency exit threshold
- `MAX_LOSS_PERCENT` — emergency exit percentage

Implement `loadSwarmConfigFromEnv(): SwarmMasterConfig` that reads all env vars and returns a fully typed config.

### 2. `config/defaults.ts` — Default Configuration Values

Export `DEFAULT_SWARM_CONFIG: Partial<SwarmMasterConfig>` with sensible defaults for every field. Export individual defaults:
- `DEFAULT_RPC_CONFIG`, `DEFAULT_WALLET_CONFIG`, `DEFAULT_BUNDLE_CONFIG`
- `DEFAULT_INTELLIGENCE_CONFIG`, `DEFAULT_DASHBOARD_CONFIG`
- `DEFAULT_EMERGENCY_EXIT_CONFIG`, `DEFAULT_ANALYTICS_CONFIG`
- `DEFAULT_AGENT_COUNTS`

### 3. `config/validation.ts` — Configuration Validator

Implement `validateSwarmConfig(config: SwarmMasterConfig): { valid: boolean; errors: string[]; warnings: string[] }` that:
- Validates RPC URLs are reachable format
- Validates wallet secret keys are valid base58
- Checks budget doesn't exceed wallet balance warnings
- Validates strategy parameters are within reasonable ranges
- Checks for conflicting settings (e.g., scanner + token both set)
- Returns specific error messages with field paths

### 4. `config/index.ts` — Barrel Export

Re-export everything. Add `createSwarmConfig(overrides?: Partial<SwarmMasterConfig>): SwarmMasterConfig` convenience function.

### Success Criteria

- All env vars have clear names and defaults
- Validation catches misconfiguration before launch
- Type-safe config object with no optional confusion
- Compiles with `npx tsc --noEmit`
