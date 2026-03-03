# Contributing to crypto-market-data

First off, thank you for considering contributing to crypto-market-data! 🎉

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Testing](#testing)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm 9+ or pnpm 8+
- Git

### Types of Contributions

- 🐛 **Bug Reports**: Found a bug? Open an issue!
- 💡 **Feature Requests**: Have an idea? We'd love to hear it!
- 📝 **Documentation**: Help us improve our docs
- 🔧 **Code**: Fix bugs or add new features
- 🧪 **Tests**: Help us improve test coverage

## Development Setup

1. **Fork the repository**
   
   Click the "Fork" button on GitHub

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/crypto-market-data.git
   cd crypto-market-data
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. **Start development**
   ```bash
   npm run dev
   ```

## Making Changes

### Branch Naming Convention

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Adding or updating tests
- `chore/` - Maintenance tasks

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance

**Examples:**
```
feat(coingecko): add trending coins endpoint
fix(cache): resolve stale data issue
docs: update API reference
```

## Pull Request Process

1. **Update documentation** if you've changed APIs
2. **Add tests** for new features
3. **Run the full test suite**
   ```bash
   npm test
   ```
4. **Update CHANGELOG.md** with your changes
5. **Fill out the PR template** completely
6. **Request review** from maintainers

### PR Checklist

- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] No console.log statements
- [ ] TypeScript types are complete

## Style Guidelines

### TypeScript

- Use explicit types (avoid `any`)
- Use interfaces for object shapes
- Export types that consumers need
- Use JSDoc comments for public APIs

```typescript
/**
 * Fetches current price for a cryptocurrency
 * @param coinId - CoinGecko coin ID (e.g., 'bitcoin')
 * @returns Current price data with 24h changes
 * @example
 * const price = await getPrice('bitcoin');
 * console.log(price.usd);
 */
export async function getPrice(coinId: string): Promise<PriceData> {
  // implementation
}
```

### Code Style

- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- Trailing commas in multiline

We use ESLint and Prettier - they'll handle most formatting:

```bash
npm run lint
npm run format
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Writing Tests

- Place tests in `__tests__/` or as `*.test.ts`
- Use descriptive test names
- Test edge cases
- Mock external APIs

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getTopCoins } from '../src';

describe('getTopCoins', () => {
  it('should return top coins by market cap', async () => {
    const coins = await getTopCoins({ limit: 10 });
    expect(coins).toHaveLength(10);
    expect(coins[0]).toHaveProperty('id');
    expect(coins[0]).toHaveProperty('current_price');
  });

  it('should handle API errors gracefully', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));
    await expect(getTopCoins()).rejects.toThrow();
  });
});
```

## Questions?

Feel free to:
- Open a [Discussion](https://github.com/nirholas/crypto-market-data/discussions)
- Ask in an Issue
- Reach out on Twitter [@nirholas](https://twitter.com/nirholas)

---

Thank you for contributing! 🚀
