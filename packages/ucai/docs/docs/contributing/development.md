---
title: Development Setup
description: Setting up your development environment
---

# Development Setup

This guide walks you through setting up a development environment for abi-to-mcp.

## Prerequisites

- Python 3.10 or later
- Git
- Make (optional but recommended)

## Setup Steps

### 1. Fork and Clone

```bash
# Fork on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/UCAI.git
cd UCAI

# Add upstream remote
git remote add upstream https://github.com/nirholas/UCAI.git
```

### 2. Create Virtual Environment

```bash
# Using venv
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# or
.venv\Scripts\activate     # Windows
```

### 3. Install Dependencies

```bash
# Install package in editable mode with dev dependencies
pip install -e ".[dev]"

# Or using Make
make setup
```

### 4. Verify Setup

```bash
# Run tests
make test

# Run linter
make lint

# Run type checker
make type-check
```

## Development Workflow

### Making Changes

```bash
# Create a feature branch
git checkout -b feature/my-feature

# Make changes...

# Run checks
make check

# Commit
git add .
git commit -m "feat: add my feature"
```

### Keeping Up to Date

```bash
# Fetch upstream changes
git fetch upstream

# Rebase your branch
git checkout main
git rebase upstream/main

# Update your feature branch
git checkout feature/my-feature
git rebase main
```

### Running Specific Tests

```bash
# Run all tests
make test

# Run specific test file
pytest tests/unit/test_parser/test_abi_parser.py

# Run specific test
pytest tests/unit/test_parser/test_abi_parser.py::test_parse_erc20

# Run with coverage
make coverage
```

## Make Commands

| Command | Description |
|---------|-------------|
| `make setup` | Install development dependencies |
| `make test` | Run all tests |
| `make lint` | Run Ruff linter |
| `make format` | Format code with Ruff |
| `make type-check` | Run mypy type checker |
| `make check` | Run all checks (lint, type-check, test) |
| `make coverage` | Run tests with coverage report |
| `make docs` | Build documentation |
| `make clean` | Clean build artifacts |

## IDE Setup

### VS Code

Recommended extensions:

```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.vscode-pylance",
    "charliermarsh.ruff",
    "ms-python.mypy-type-checker"
  ]
}
```

Workspace settings (`.vscode/settings.json`):

```json
{
  "python.defaultInterpreterPath": ".venv/bin/python",
  "python.testing.pytestEnabled": true,
  "python.testing.pytestArgs": ["tests"],
  "[python]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "charliermarsh.ruff",
    "editor.codeActionsOnSave": {
      "source.organizeImports": "explicit"
    }
  }
}
```

### PyCharm

1. Open project directory
2. Configure interpreter to use `.venv`
3. Mark `src` as Sources Root
4. Mark `tests` as Tests Root

## Project Structure

```
abi-to-mcp/
├── src/abi_to_mcp/        # Source code
│   ├── cli/               # CLI commands
│   ├── core/              # Core models and config
│   ├── fetchers/          # ABI fetching
│   ├── parser/            # ABI parsing
│   ├── mapper/            # Type mapping
│   ├── generator/         # Code generation
│   └── runtime/           # Execution utilities
├── tests/                 # Tests
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── fixtures/          # Test data
├── docs/                  # Documentation
├── examples/              # Usage examples
├── scripts/               # Development scripts
├── pyproject.toml         # Project configuration
├── Makefile               # Development commands
└── README.md              # Project readme
```

!!! tip "Helper Scripts"
    The `scripts/` folder contains standalone shell scripts for common tasks:
    `build.sh`, `test.sh`, `lint.sh`, `docs.sh`, `release.sh`, and `fetch_abis.py`.
    These provide an alternative to Make commands and work on any system.

## Environment Variables

For testing with external services:

```bash
# .env.test (not committed)
ETHERSCAN_API_KEY=your-test-key
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-key
```

!!! warning "Never Commit Secrets"
    Add `.env*` to `.gitignore` to prevent committing secrets.

## Troubleshooting

### Import Errors

If you get import errors:

```bash
# Reinstall in editable mode
pip install -e ".[dev]"
```

### Test Failures

If tests fail on a fresh clone:

```bash
# Clean and reinstall
make clean
make setup
make test
```

### Type Check Errors

If mypy reports errors in dependencies:

```bash
# Install type stubs
pip install types-requests types-toml
```

## Next Steps

- Read [Architecture](architecture.md) to understand the codebase
- See [Testing](testing.md) for test guidelines
- Check open [issues](https://github.com/nirholas/UCAI/issues) for things to work on
