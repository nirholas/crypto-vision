# Contributing to UCAI

Thank you for your interest in contributing to UCAI! This document provides guidelines and instructions for contributing.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/UCAI.git
   cd UCAI
   ```
3. **Set up the development environment**:
   ```bash
   make setup
   source .venv/bin/activate
   ```

## Development Workflow

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and ensure tests pass:
   ```bash
   make check  # Runs lint, type-check, and tests
   ```

3. Commit your changes with a descriptive message:
   ```bash
   git commit -m "feat: add new feature"
   ```

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `test:` - Test additions or changes
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

### Running Tests

```bash
# All tests
make test

# Unit tests only
make test-unit

# With coverage
make coverage
```

### Code Style

We use [Ruff](https://github.com/astral-sh/ruff) for linting and formatting:

```bash
make lint    # Check for issues
make format  # Auto-format code
```

## Pull Requests

1. Ensure all tests pass and code is formatted
2. Update documentation if needed
3. Add tests for new functionality
4. Submit a pull request with a clear description

## Reporting Issues

- Use [GitHub Issues](https://github.com/nirholas/UCAI/issues)
- Include reproduction steps
- Include error messages and environment details

## Documentation

Full documentation is available at [ucai.tech](https://ucai.tech).

For detailed development setup, see the [Development Guide](https://ucai.tech/contributing/development/).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).
