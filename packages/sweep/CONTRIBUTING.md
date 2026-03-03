# Contributing to Sweep

> **⚠️ CRITICAL: This application handles user funds. All contributions must follow strict security practices.**

Thank you for your interest in contributing to Sweep! This guide will help you get started.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Pull Request Process](#pull-request-process)
5. [Code Style](#code-style)
6. [Commit Conventions](#commit-conventions)
7. [Security Guidelines](#security-guidelines)
8. [Review Checklist](#review-checklist)

---

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other contributors

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Publishing others' private information
- Trolling or insulting/derogatory comments
- Any conduct inappropriate in a professional setting

---

## Getting Started

### Prerequisites

1. Read the [DEVELOPMENT.md](./docs/DEVELOPMENT.md) guide
2. Set up your local environment
3. Familiarize yourself with the codebase

### Finding Issues

- Check [GitHub Issues](https://github.com/nirholas/sweep/issues)
- Look for `good first issue` labels for beginner-friendly tasks
- Check `help wanted` for issues needing contributors
- Review `priority` labels for important work

### Issue Labels

| Label | Description |
|-------|-------------|
| `bug` | Something isn't working |
| `enhancement` | New feature or improvement |
| `good first issue` | Beginner-friendly |
| `help wanted` | Extra attention needed |
| `security` | Security-related issue |
| `contracts` | Smart contract related |
| `frontend` | Frontend application |
| `backend` | API and services |

---

## Development Workflow

### 1. Fork & Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/sweep.git
cd sweep
git remote add upstream https://github.com/nirholas/sweep.git
```

### 2. Create Branch

```bash
# Update main
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feat/your-feature-name
```

### Branch Naming Convention

| Prefix | Usage |
|--------|-------|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `docs/` | Documentation |
| `refactor/` | Code refactoring |
| `test/` | Test additions/updates |
| `chore/` | Maintenance tasks |

Examples:
- `feat/add-solana-support`
- `fix/quote-expiry-validation`
- `docs/update-api-reference`

### 3. Make Changes

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests continuously
npm run test:watch
```

### 4. Test Your Changes

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:unit
npm run test:integration
npm run test:api

# Check coverage
npm run test:coverage

# Type check
npm run typecheck

# Lint
npm run lint
```

### 5. Commit Changes

```bash
# Stage changes
git add .

# Commit with conventional message
git commit -m "feat: add Solana dust scanning support"
```

### 6. Push & Create PR

```bash
# Push to your fork
git push origin feat/your-feature-name

# Create PR via GitHub UI
```

---

## Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] All tests pass (`npm test`)
- [ ] Coverage thresholds met (`npm run test:coverage`)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No lint errors (`npm run lint`)
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventions

### PR Template

```markdown
## Description

Brief description of changes.

## Type of Change

- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update

## Related Issues

Closes #123

## Testing

Describe tests added or modified.

## Checklist

- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Self-reviewed my code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No security vulnerabilities introduced
```

### Review Process

1. **Automated Checks** - CI runs tests, linting, and type checking
2. **Code Review** - Maintainers review the code
3. **Feedback** - Address any requested changes
4. **Approval** - At least one maintainer must approve
5. **Merge** - Maintainer merges to main

### Review Timeline

- Simple fixes: 1-2 days
- Features: 3-5 days
- Complex changes: 1-2 weeks

---

## Code Style

### TypeScript

```typescript
// ✅ Good: Explicit types, clear naming
interface SweepResult {
  sweepId: string;
  status: "pending" | "confirmed" | "failed";
  txHash: string;
}

async function executeSweep(params: SweepParams): Promise<SweepResult> {
  // Implementation
}

// ❌ Bad: Implicit types, unclear naming
async function doIt(p) {
  // What is this?
}
```

### Functions

```typescript
// ✅ Good: Single responsibility, documented
/**
 * Calculates the net value after fees for a sweep operation.
 * @param grossValue - Total USD value of tokens
 * @param gasCost - Estimated gas cost in USD
 * @param protocolFee - Protocol fee in USD
 * @returns Net value in USD (minimum 0)
 */
function calculateNetValue(
  grossValue: number,
  gasCost: number,
  protocolFee: number
): number {
  const net = grossValue - gasCost - protocolFee;
  return Math.max(0, net);
}

// ❌ Bad: Multiple responsibilities, no documentation
function calc(a, b, c, d, e, f) {
  // What does this do?
  return a - b - c + d * e / f;
}
```

### Error Handling

```typescript
// ✅ Good: Specific error types, context
class QuoteExpiredError extends Error {
  constructor(public quoteId: string, public expiredAt: Date) {
    super(`Quote ${quoteId} expired at ${expiredAt.toISOString()}`);
    this.name = "QuoteExpiredError";
  }
}

try {
  await executeSweep(params);
} catch (error) {
  if (error instanceof QuoteExpiredError) {
    return { success: false, error: "Quote expired, please request a new one" };
  }
  throw error;
}

// ❌ Bad: Generic errors, no context
try {
  await doStuff();
} catch (e) {
  console.log("error");
}
```

### Imports

```typescript
// ✅ Good: Organized imports
// 1. External packages
import { Hono } from "hono";
import { eq } from "drizzle-orm";

// 2. Internal absolute imports
import { getDb } from "@/db";
import { logger } from "@/utils/logger";

// 3. Relative imports
import { validateQuote } from "./validation";
import type { SweepParams } from "./types";
```

### File Structure

```typescript
// ✅ Good file structure
// 1. Imports
import { ... } from "...";

// 2. Types/Interfaces
interface MyInterface { ... }

// 3. Constants
const MAX_RETRIES = 3;

// 4. Helper functions (private)
function helperFunction() { ... }

// 5. Main exports
export function mainFunction() { ... }
export class MainClass { ... }
```

---

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, missing semicolons, etc. |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build process or auxiliary tool changes |
| `ci` | CI/CD configuration changes |
| `revert` | Revert a previous commit |

### Scopes

| Scope | Description |
|-------|-------------|
| `api` | API routes and middleware |
| `contracts` | Smart contracts |
| `frontend` | Frontend application |
| `db` | Database schema/migrations |
| `queue` | Background job workers |
| `dex` | DEX aggregator integrations |
| `bridge` | Bridge integrations |
| `defi` | DeFi protocol integrations |
| `auth` | Authentication |
| `config` | Configuration |

### Examples

```bash
# Feature
feat(api): add Solana sweep endpoint

# Bug fix
fix(queue): prevent duplicate sweep jobs

# Documentation
docs(api): update quote endpoint examples

# Breaking change
feat(contracts)!: change fee structure

BREAKING CHANGE: Fee calculation now uses basis points instead of percentage.

# With body
fix(price): handle CoinGecko rate limiting

Added exponential backoff retry logic and fallback to DefiLlama
when CoinGecko returns 429 status.

Closes #456
```

---

## Security Guidelines

### ⚠️ Critical Rules

1. **Never commit secrets** - API keys, private keys, passwords
2. **Never log sensitive data** - Addresses are OK, private keys are NOT
3. **Validate all inputs** - Use Zod schemas for all external data
4. **Use parameterized queries** - Never interpolate SQL
5. **Check token approvals** - Verify amounts and recipients
6. **Test edge cases** - Empty arrays, max values, etc.

### Security Checklist

Before submitting a PR that touches:

**Smart Contracts:**
- [ ] No reentrancy vulnerabilities
- [ ] Proper access control
- [ ] Safe math operations
- [ ] Gas limit considerations
- [ ] Reviewed by second person

**API Endpoints:**
- [ ] Input validation (Zod)
- [ ] Authentication checked
- [ ] Rate limiting considered
- [ ] Error messages don't leak info

**Database:**
- [ ] Parameterized queries only
- [ ] Indexes for new queries
- [ ] No sensitive data logged

**Price/Value Calculations:**
- [ ] Multiple oracle sources
- [ ] Slippage protection
- [ ] Overflow protection

### Reporting Vulnerabilities

**DO NOT** open a public issue for security vulnerabilities.

Instead:
1. Email security@sweep.bank
2. Include detailed reproduction steps
3. Allow 72 hours for initial response

---

## Review Checklist

### For Contributors

- [ ] Branch is up to date with main
- [ ] All tests pass
- [ ] Coverage thresholds met
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] PR description is complete
- [ ] Commit messages follow conventions
- [ ] Documentation updated
- [ ] No console.log statements (use logger)
- [ ] No hardcoded values (use config)

### For Reviewers

- [ ] Code solves the stated problem
- [ ] Implementation is correct
- [ ] Tests cover the changes
- [ ] No security issues
- [ ] No performance regressions
- [ ] Code is maintainable
- [ ] Documentation is adequate
- [ ] Breaking changes documented

---

## Getting Help

- **Questions**: Open a [Discussion](https://github.com/nirholas/sweep/discussions)
- **Bugs**: Open an [Issue](https://github.com/nirholas/sweep/issues)
- **Security**: Email security@sweep.bank
- **Chat**: Join our Discord (link in README)

---

## Recognition

Contributors are recognized in:
- GitHub Contributors page
- CHANGELOG.md release notes
- Project documentation

Thank you for contributing to Sweep! 🐷

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).
