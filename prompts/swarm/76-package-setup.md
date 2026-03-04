# Prompt 76 — Package Configuration & Build Setup

## Agent Identity & Rules

```
You are the PACKAGE-SETUP builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No placeholder dependencies — real, pinned versions for every package
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): configure package.json, tsconfig, and build pipeline for pump-agent-swarm"
```

## Objective

Configure the `packages/pump-agent-swarm/` package with a complete `package.json` (all dependencies consolidated from prompts 01-75), a proper `tsconfig.json` with strict settings, and npm scripts for build/test/start. This prompt ensures the entire package actually compiles and runs.

## File Ownership

- **Modifies**: `packages/pump-agent-swarm/package.json`
- **Creates or modifies**: `packages/pump-agent-swarm/tsconfig.json`
- **Creates**: `packages/pump-agent-swarm/tsconfig.build.json` (for production build)

## Dependencies

- All files created by prompts 01-75 (these define what imports are needed)
- Root `tsconfig.json` (for extending)
- Root `package.json` (for workspace protocol references)

## Deliverables

### Update `packages/pump-agent-swarm/package.json`

Consolidate all dependencies from prompts 01-75 into a single, correct `package.json`:

```json
{
  "name": "@crypto-vision/pump-agent-swarm",
  "version": "1.0.0",
  "type": "module",
  "description": "Autonomous memecoin agent swarm for Pump.fun/Solana — launches, bundles, and trades tokens with coordinated AI agents",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./agents": {
      "types": "./dist/agents/index.d.ts",
      "import": "./dist/agents/index.js"
    },
    "./trading": {
      "types": "./dist/trading/index.d.ts",
      "import": "./dist/trading/index.js"
    },
    "./bundle": {
      "types": "./dist/bundle/index.d.ts",
      "import": "./dist/bundle/index.js"
    },
    "./intelligence": {
      "types": "./dist/intelligence/index.d.ts",
      "import": "./dist/intelligence/index.js"
    },
    "./coordination": {
      "types": "./dist/coordination/index.d.ts",
      "import": "./dist/coordination/index.js"
    },
    "./dashboard": {
      "types": "./dist/dashboard/index.d.ts",
      "import": "./dist/dashboard/index.js"
    },
    "./telegram": {
      "types": "./dist/telegram/index.d.ts",
      "import": "./dist/telegram/index.js"
    },
    "./persistence": {
      "types": "./dist/persistence/index.d.ts",
      "import": "./dist/persistence/index.js"
    }
  },
  "bin": {
    "pump-swarm": "./dist/demo/cli-runner.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "tsx watch src/demo/cli-runner.ts",
    "start": "node dist/demo/cli-runner.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:integration": "vitest run --include 'src/__tests__/integration/**'",
    "test:e2e": "RUN_E2E=true vitest run --config vitest.e2e.config.ts",
    "clean": "rm -rf dist",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@coral-xyz/anchor": "^0.30.0",
    "@pump-fun/pump-sdk": "github:nirholas/pump-fun-sdk",
    "@solana/spl-token": "^0.4.0",
    "@solana/web3.js": "^1.95.0",
    "better-sqlite3": "^11.0.0",
    "bs58": "^6.0.0",
    "drizzle-orm": "^0.33.0",
    "eventemitter3": "^5.0.1",
    "grammy": "^1.30.0",
    "hono": "^4.0.0",
    "nanoid": "^5.0.0",
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0",
    "ws": "^8.18.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/ws": "^8.5.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "files": [
    "dist",
    "README.md"
  ],
  "keywords": [
    "solana",
    "pump-fun",
    "memecoin",
    "agent-swarm",
    "trading-bot",
    "jito-bundles",
    "defi"
  ],
  "license": "MIT"
}
```

**Important**: Before writing, read the existing `packages/pump-agent-swarm/package.json` and merge — do not lose any existing dependencies or scripts. Add missing ones from the list above.

### Create `packages/pump-agent-swarm/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleResolution": "node16",
    "module": "node16",
    "target": "ES2022",
    "lib": ["ES2022"],
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "src/__tests__/**"]
}
```

### Create `packages/pump-agent-swarm/tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "src/__tests__/**", "src/**/*.test.ts"]
}
```

### Verify existing `package.json`

Read the current `packages/pump-agent-swarm/package.json` first. Check:
1. Does it have a `name` field? Keep it or use `@crypto-vision/pump-agent-swarm`
2. Does it have existing `dependencies`? Merge with the new ones above
3. Does it have existing `scripts`? Merge, preferring the new ones for conflicts
4. Does it have workspace protocol references (`workspace:*`)? Preserve those

### Verify root workspace config

Check `package.json` at root to ensure `packages/pump-agent-swarm` is in the `workspaces` array. If not, add it.

### Install dependencies

After updating `package.json`, run:
```bash
cd /workspaces/crypto-vision && npm install
```

Verify no peer dependency warnings for critical packages.

### Success Criteria

- `package.json` contains all dependencies needed by prompts 01-75
- `tsconfig.json` extends root config with strict settings
- `npm install` succeeds without errors
- `npx tsc --noEmit` shows only pre-existing errors (no new ones from config)
- `bin` field points to CLI runner for `npx pump-swarm`
- `exports` map provides clean sub-path imports
- Build script produces valid JS + declarations in `dist/`
- All workspace protocol references preserved
