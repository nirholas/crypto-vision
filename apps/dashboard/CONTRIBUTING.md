# Contributing to Crypto Data Aggregator

First off, thank you for considering contributing to Crypto Data Aggregator! 🎉

This document provides guidelines and steps for contributing. Following these guidelines helps
communicate that you respect the time of the developers managing and developing this open source
project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Fork and Clone](#fork-and-clone)
  - [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
  - [Branch Naming Convention](#branch-naming-convention)
  - [Commit Message Format](#commit-message-format)
  - [Pull Request Process](#pull-request-process)
- [Code Style Guide](#code-style-guide)
- [Testing](#testing)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct:

- Be respectful and inclusive
- Be patient with newcomers
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.0.0 ([Download](https://nodejs.org/))
- **npm** >= 9.0.0 (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))

### Fork and Clone

1. **Fork the repository** by clicking the "Fork" button on GitHub

2. **Clone your fork** locally:

   ```bash
   git clone https://github.com/YOUR_USERNAME/crypto-data-aggregator.git
   cd crypto-data-aggregator
   ```

3. **Add the upstream remote**:

   ```bash
   git remote add upstream https://github.com/nirholas/crypto-data-aggregator.git
   ```

4. **Verify remotes**:
   ```bash
   git remote -v
   # origin    https://github.com/YOUR_USERNAME/crypto-data-aggregator.git (fetch)
   # origin    https://github.com/YOUR_USERNAME/crypto-data-aggregator.git (push)
   # upstream  https://github.com/nirholas/crypto-data-aggregator.git (fetch)
   # upstream  https://github.com/nirholas/crypto-data-aggregator.git (push)
   ```

### Development Setup

**Quick Setup (Recommended):**

```bash
./scripts/setup.sh
```

**Manual Setup:**

```bash
# Install dependencies
npm install

# Set up Husky hooks
npm run prepare

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`.

## Development Workflow

### Branch Naming Convention

Use descriptive branch names following this pattern:

```
<type>/<issue-number>-<short-description>
```

**Types:** | Type | Description | |------|-------------| | `feature` | New feature or enhancement |
| `fix` | Bug fix | | `docs` | Documentation only changes | | `refactor` | Code refactoring | |
`test` | Adding or updating tests | | `chore` | Maintenance tasks | | `style` | Code
style/formatting changes | | `perf` | Performance improvements |

**Examples:**

```bash
feature/123-add-portfolio-export
fix/456-chart-rendering-issue
docs/789-update-api-docs
refactor/101-simplify-price-utils
```

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

**Format:**

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

**Types:** | Type | Description | |------|-------------| | `feat` | A new feature | | `fix` | A bug
fix | | `docs` | Documentation only changes | | `style` | Changes that don't affect code meaning
(formatting, etc.) | | `refactor` | Code change that neither fixes a bug nor adds a feature | |
`perf` | Performance improvement | | `test` | Adding missing tests or correcting existing tests | |
`chore` | Changes to build process or auxiliary tools | | `ci` | Changes to CI configuration files
and scripts | | `revert` | Reverts a previous commit |

**Scopes** (optional):

- `api` - API routes
- `ui` - UI components
- `charts` - Chart components
- `portfolio` - Portfolio feature
- `watchlist` - Watchlist feature
- `defi` - DeFi analytics
- `market` - Market data
- `deps` - Dependencies

**Examples:**

```bash
feat(portfolio): add CSV export functionality

fix(charts): resolve tooltip positioning on mobile

docs: update installation instructions

refactor(api): simplify market data fetching logic

test(portfolio): add unit tests for calculations

chore(deps): update next.js to v16.2.0
```

**Rules:**

- Use lowercase for type and scope
- Use imperative mood in subject ("add" not "added" or "adds")
- Don't end the subject with a period
- Keep subject under 72 characters
- Use the body to explain _what_ and _why_ (not _how_)

### Pull Request Process

1. **Update your fork**:

   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a new branch**:

   ```bash
   git checkout -b feature/123-your-feature-name
   ```

3. **Make your changes** and commit following the commit message format

4. **Run checks before pushing**:

   ```bash
   npm run check-all
   # Or individually:
   npm run lint
   npm run build
   npm run test:run
   ```

5. **Push to your fork**:

   ```bash
   git push origin feature/123-your-feature-name
   ```

6. **Open a Pull Request**:
   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select your branch
   - Fill out the PR template completely
   - Link any related issues

7. **Address review feedback**:
   - Make requested changes
   - Push additional commits
   - Re-request review when ready

## Code Style Guide

### General Principles

- Write clean, readable, and maintainable code
- Follow DRY (Don't Repeat Yourself) principles
- Keep functions small and focused
- Use meaningful variable and function names

### TypeScript

- Use TypeScript for all new code
- Define proper types - avoid `any` when possible
- Use interfaces for object shapes
- Export types that might be reused

```typescript
// ✅ Good
interface CoinData {
  id: string;
  name: string;
  price: number;
  change24h: number;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

// ❌ Avoid
function formatPrice(price: any) {
  return '$' + price;
}
```

### React Components

- Use functional components with hooks
- Use named exports for components
- Keep components focused and composable
- Extract complex logic into custom hooks

```typescript
// ✅ Good
export function PriceDisplay({ price, change }: PriceDisplayProps) {
  const formattedPrice = useMemo(() => formatPrice(price), [price]);

  return (
    <div className="price-display">
      <span>{formattedPrice}</span>
      <PriceChange value={change} />
    </div>
  );
}

// ❌ Avoid
export default function(props) {
  // Large component with mixed concerns
}
```

### CSS / Tailwind

- Use Tailwind CSS utility classes
- Extract repeated patterns into components
- Use semantic class names when custom CSS is needed
- Keep responsive design in mind

### File Organization

```
src/
├── app/           # Next.js app router pages
├── components/    # Reusable UI components
├── lib/           # Utility functions and services
└── types/         # TypeScript type definitions (if needed)
```

### Naming Conventions

| Item             | Convention           | Example           |
| ---------------- | -------------------- | ----------------- |
| Components       | PascalCase           | `PriceChart.tsx`  |
| Utilities        | camelCase            | `formatPrice.ts`  |
| Constants        | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Types/Interfaces | PascalCase           | `CoinData`        |
| CSS classes      | kebab-case           | `price-display`   |

## Testing

We use [Vitest](https://vitest.dev/) for testing.

### Running Tests

```bash
# Run all tests
npm run test:run

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Place test files next to the code they test: `component.tsx` → `component.test.tsx`
- Or use `__tests__` directories for grouping
- Write descriptive test names
- Test both happy paths and edge cases

```typescript
import { describe, it, expect } from 'vitest';
import { formatPrice } from './formatPrice';

describe('formatPrice', () => {
  it('formats positive prices correctly', () => {
    expect(formatPrice(1234.56)).toBe('$1,234.56');
  });

  it('handles zero', () => {
    expect(formatPrice(0)).toBe('$0.00');
  });

  it('handles very small numbers', () => {
    expect(formatPrice(0.00001234)).toBe('$0.00001234');
  });
});
```

## Reporting Bugs

Found a bug? Please use the
[Bug Report template](https://github.com/nirholas/crypto-data-aggregator/issues/new?template=bug_report.yml)
to report it.

**Before submitting:**

1. Search existing issues to avoid duplicates
2. Gather steps to reproduce
3. Note your environment (browser, OS, etc.)

## Suggesting Features

Have an idea? Please use the
[Feature Request template](https://github.com/nirholas/crypto-data-aggregator/issues/new?template=feature_request.yml).

**Before submitting:**

1. Search existing issues to avoid duplicates
2. Consider if it fits the project scope
3. Think about implementation details

---

## Questions?

Feel free to open a
[Question issue](https://github.com/nirholas/crypto-data-aggregator/issues/new?template=question.yml)
if you need help!

Thank you for contributing! 🚀
