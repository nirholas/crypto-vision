---
title: Contributing
description: How to contribute to abi-to-mcp
---

# Contributing

Thank you for your interest in contributing to abi-to-mcp! This section covers everything you need to get started.

## Ways to Contribute

<div class="grid cards" markdown>

-   :material-bug:{ .lg .middle } __Report Bugs__

    ---

    Found a bug? Open an issue with details to help us fix it.

    [:octicons-arrow-right-24: GitHub Issues](https://github.com/nirholas/UCAI/issues)

-   :material-lightbulb:{ .lg .middle } __Suggest Features__

    ---

    Have an idea? Open a discussion to share your thoughts.

    [:octicons-arrow-right-24: Discussions](https://github.com/nirholas/UCAI/discussions)

-   :material-code-braces:{ .lg .middle } __Submit Code__

    ---

    Fix a bug or add a feature. See our development guide.

    [:octicons-arrow-right-24: Development](development.md)

-   :material-file-document:{ .lg .middle } __Improve Docs__

    ---

    Help improve documentation, add examples, fix typos.

    [:octicons-arrow-right-24: Documentation](#documentation)

</div>

## Quick Start

```bash
# Fork and clone
git clone https://github.com/YOUR-USERNAME/UCAI.git
cd UCAI

# Setup development environment
make setup

# Run tests
make test

# Make your changes, then submit a PR!
```

## Development Guides

| Guide | Description |
|-------|-------------|
| [Development Setup](development.md) | Environment setup and workflow |
| [Architecture](architecture.md) | Project structure and design |
| [Testing](testing.md) | Writing and running tests |

## Contribution Guidelines

### Code Style

- We use **Ruff** for linting and formatting
- Type hints are required for all public functions
- Docstrings follow Google style

```bash
# Format code
make format

# Run linter
make lint
```

### Commit Messages

Use conventional commits:

```
feat: add support for ERC4626 detection
fix: handle empty ABI arrays
docs: update type mapping table
test: add tests for nested tuples
```

### Pull Request Process

1. **Fork** the repository
2. **Create a branch** from `main`
3. **Make changes** with tests
4. **Run checks** (`make check`)
5. **Submit PR** with description

### Code Review

All submissions require review. We aim to review within:

- Bug fixes: 1-2 days
- Features: 3-5 days
- Major changes: 1-2 weeks

## Documentation

Documentation is in `docs/` using MkDocs with Material theme.

### Local Preview

```bash
cd docs
pip install mkdocs-material mkdocstrings[python]
mkdocs serve
```

Visit http://localhost:8000

### Doc Structure

| Path | Content |
|------|---------|
| `docs/getting-started/` | New user tutorials |
| `docs/cli/` | CLI command reference |
| `docs/concepts/` | Conceptual explanations |
| `docs/guides/` | How-to guides |
| `docs/api/` | Python API reference |
| `docs/reference/` | Reference tables |
| `docs/contributing/` | Contribution guides |

## Community

- [GitHub Discussions](https://github.com/nirholas/UCAI/discussions) - Questions and ideas
- [GitHub Issues](https://github.com/nirholas/UCAI/issues) - Bug reports
- [Twitter/X](https://twitter.com/) - Updates and announcements

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and constructive
- Welcome newcomers
- Focus on the code, not the person
- Accept constructive criticism gracefully
