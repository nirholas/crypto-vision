# Contributing to Crypto Vision

Thank you for contributing to Crypto Vision. This guide covers the workflow, standards, and conventions used across the monorepo.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Environment](#development-environment)
3. [Branch Strategy](#branch-strategy)
4. [Code Standards](#code-standards)
5. [Commit Conventions](#commit-conventions)
6. [Testing Requirements](#testing-requirements)
7. [Pull Request Process](#pull-request-process)
8. [Package-Specific Guidelines](#package-specific-guidelines)
9. [Documentation](#documentation)

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/nirholas/crypto-vision.git
cd crypto-vision

# Install root dependencies
npm install

# Copy environment template
cp .env.example .env

# Start development server
npm run dev
```

For package-specific setup, see each package's README under `packages/*/README.md`.

---

## Development Environment

### Requirements

- **Node.js ≥ 22** (required — uses modern APIs)
- **npm** (package manager)
- **Docker** (optional — for containerized runs and PostgreSQL/Redis)
- **Python 3.11+** (optional — for model training scripts in `packages/ucai`)

### Editor Setup

- **TypeScript strict mode** is enforced — configure your editor to use the workspace TypeScript version
- ESLint flat config is at `eslint.config.js`
- Path aliases: `@/*` maps to `src/*`

### Environment Variables

See the root `README.md` for the full environment variable reference. At minimum:

- No API keys needed for basic development (market data endpoints work without keys)
- At least one LLM API key (`GROQ_API_KEY`, `GEMINI_API_KEY`, etc.) for AI endpoints
- `REDIS_URL` for Redis caching (falls back to in-memory LRU)

---

## Branch Strategy

- **`main`** — primary development branch, always deployable
- **Feature branches** — branch from `main`, merge via PR
- **Naming**: `feat/description`, `fix/description`, `refactor/description`, `docs/description`

---

## Code Standards

### TypeScript

- **Strict mode** — no `any` types, no `@ts-ignore`, no type assertions unless documented
- **Error handling** — every async call needs try/catch, every API response needs validation
- **Self-documenting code** — prefer clear naming over comments; when comments are needed, explain *why*, not *what*
- **DRY** — extract shared logic into helpers, but avoid over-abstraction for single-use cases
- **Path aliases** — use `@/` imports (`import { cache } from '@/lib/cache'`) in root service code

### Patterns

- **Source adapters** (`src/sources/`) — one file per external API, consistent fetch + cache + error handling
- **Route modules** (`src/routes/`) — Zod validation, source adapter calls, standardized responses
- **Middleware** — applied globally in `src/index.ts`, route-specific middleware in route files

### Style

- ESLint is the linter — run `npm run lint` before committing
- Unused variables prefixed with `_` are allowed
- Prefer `const` over `let`, avoid `var`
- Use template literals over string concatenation

---

## Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

### Types

| Type | Usage |
|------|-------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `perf` | Performance improvement |
| `ci` | CI/CD pipeline changes |
| `chore` | Maintenance, dependency updates |

### Scopes

| Scope | Area |
|-------|------|
| `api` | Core API routes or middleware |
| `sources` | Data source adapters |
| `lib` | Shared library modules |
| `bot` | Crypto Vision Telegram bot |
| `workers` | Ingestion/indexing workers |
| `dashboard` | Dashboard app |
| `news` | News app |
| `swarm` | Pump agent swarm package |
| `mcp` | MCP server packages |
| `infra` | Infrastructure/deployment |
| `agents` | Agent definitions |

### Examples

```
feat(api): add perps funding rate aggregation endpoint
fix(sources): handle CoinGecko 429 rate limit with exponential backoff
docs(swarm): add pump-agent-swarm README
test(routes): add integration tests for DeFi endpoints
refactor(lib): extract circuit breaker into standalone module
```

---

## Testing Requirements

### Before Submitting

Every PR must pass:

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript strict compilation
npm test            # Vitest unit + integration tests
```

### Test Structure

| Directory | Type | Runner |
|-----------|------|--------|
| `tests/lib/` | Unit tests for `src/lib/` | `npm test` |
| `tests/routes/` | Route-level tests | `npm test` |
| `tests/integration/` | Multi-route API flows | `npm test` |
| `tests/e2e/` | End-to-end smoke tests | `npm run test:e2e` |
| `tests/fuzz/` | Fuzz testing | `npm test` |
| `tests/benchmarks/` | Performance benchmarks | `npm test` |
| `tests/load/` | Load testing (k6) | Manual |
| `src/**/__tests__/` | Co-located unit tests | `npm test` |

### Coverage Thresholds

- **50% statement coverage** minimum (enforced by vitest config)
- New code should include tests — aim for >80% coverage on new modules

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';

describe('ModuleName', () => {
  it('should handle the expected case', () => {
    // Arrange
    const input = createTestInput();
    // Act
    const result = processInput(input);
    // Assert
    expect(result).toEqual(expectedOutput);
  });

  it('should handle edge cases', () => {
    expect(() => processInput(null)).toThrow();
  });
});
```

See [docs/TESTING.md](docs/TESTING.md) for the full testing strategy.

---

## Pull Request Process

1. **Branch** from `main` with a descriptive name
2. **Implement** changes following code standards above
3. **Test** locally: `npm run lint && npm run typecheck && npm test`
4. **Commit** with conventional commit messages
5. **Push** and open a PR against `main`
6. **Description** — include:
   - What changed and why
   - How to test
   - Screenshots for UI changes
   - Breaking changes (if any)
7. **Review** — address feedback, keep commits clean
8. **Merge** — squash merge preferred for feature branches

### PR Checklist

- [ ] Lint passes (`npm run lint`)
- [ ] Type check passes (`npm run typecheck`)
- [ ] Tests pass (`npm test`)
- [ ] New code has tests
- [ ] Documentation updated if API changed
- [ ] No secrets or API keys in code
- [ ] OpenAPI spec updated if endpoints changed

---

## Package-Specific Guidelines

### Root Service (`src/`)

- Follow the existing route → source → cache pattern
- Add new routes to the mount list in `src/index.ts`
- Register route in the API directory map
- Add Zod schemas for request validation
- Update `openapi.yaml` for new endpoints

### Pump Agent Swarm (`packages/pump-agent-swarm/`)

- Follow the EventBus pattern for inter-agent communication
- All agents extend the same initialization pattern
- Trading components integrate with the P&L tracker
- Update barrel exports in subdirectory `index.ts` files
- See `packages/pump-agent-swarm/README.md`

### MCP Servers (`packages/binance-mcp/`, `packages/bnbchain-mcp/`, `packages/mcp-server/`)

- Follow Model Context Protocol specification
- Tools are defined with Zod schemas for parameters
- Each tool should have error handling and input validation

### Apps (`apps/dashboard/`, `apps/news/`)

- Follow Next.js conventions
- Each app manages its own dependencies
- See app-specific contributing guides in `apps/*/CONTRIBUTING.md`

---

## Documentation

### When to Update Docs

- **New API endpoint** → update `openapi.yaml` and `README.md` API table
- **New package** → create `packages/{name}/README.md`
- **Architecture change** → update `docs/ARCHITECTURE.md`
- **New data source** → update `docs/DATA_SOURCES.md`
- **Deployment change** → update `docs/DEPLOYMENT.md` and `infra/README.md`
- **New test category** → update `docs/TESTING.md`

### Documentation Style

- Use clear, direct language
- Include code examples for non-obvious usage
- Keep docs close to code — prefer co-located READMEs over distant docs
- Use tables for structured information
- Include "getting started" sections in package READMEs

---

## Questions?

- Check existing docs in `docs/` directory
- Review `agents/docs/` for agent-specific questions
- Open an issue for architectural discussions
