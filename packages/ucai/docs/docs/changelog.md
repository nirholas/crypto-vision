---
title: Changelog
description: Version history and release notes
---

# Changelog

All notable changes to abi-to-mcp will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of abi-to-mcp
- CLI commands: `generate`, `inspect`, `validate`, `serve`
- ABI fetching from files, Etherscan, and Sourcify
- Support for ERC20, ERC721, ERC1155 standard detection
- Complete Solidity to JSON Schema type mapping
- MCP server generation with tools and resources
- Transaction simulation by default
- Multi-network support (Ethereum, Polygon, Arbitrum, Optimism, Base, BSC)
- Proxy contract detection and resolution
- Comprehensive documentation

### Security
- Private keys only loaded from environment variables
- Simulation-by-default for all write operations
- Read-only mode option for maximum safety

## [0.1.0] - Unreleased

### Added
- Initial public release

---

## Version Numbering

- **MAJOR**: Breaking changes to CLI or API
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, backward compatible

## Upgrade Guide

### From Pre-release to 0.1.0

No breaking changes expected. Simply upgrade:

```bash
pip install --upgrade abi-to-mcp
```

---

## Links

- [GitHub Releases](https://github.com/nirholas/UCAI/releases)
- [PyPI](https://pypi.org/project/abi-to-mcp/)
