---
title: Guides
description: Step-by-step tutorials for common use cases
---

# Guides

Learn how to use abi-to-mcp through practical, step-by-step tutorials.

## By Use Case

<div class="grid cards" markdown>

-   :fontawesome-brands-ethereum:{ .lg .middle } __ERC20 Token__

    ---

    Create an MCP server for any ERC20 token. Query balances, transfer tokens, and track transfers.

    [:octicons-arrow-right-24: ERC20 Guide](erc20-token.md)

-   :material-image:{ .lg .middle } __NFT Collection__

    ---

    Build an MCP server for ERC721 NFTs. Query ownership, transfer NFTs, and explore metadata.

    [:octicons-arrow-right-24: NFT Guide](nft-collection.md)

-   :material-swap-horizontal:{ .lg .middle } __DeFi Protocol__

    ---

    Integrate with complex DeFi protocols like Uniswap, Aave, or Compound.

    [:octicons-arrow-right-24: DeFi Guide](defi-protocol.md)

-   :material-web:{ .lg .middle } __Custom Network__

    ---

    Add support for networks not included by default, including private chains.

    [:octicons-arrow-right-24: Custom Networks](custom-network.md)

-   :simple-claude:{ .lg .middle } __Claude Desktop__

    ---

    Complete setup guide for using generated MCP servers with Claude Desktop.

    [:octicons-arrow-right-24: Claude Desktop](claude-desktop.md)

-   :material-web:{ .lg .middle } __Web Builder__

    ---

    Generate MCP servers in your browser with security scanning and plain English explanations.

    [:octicons-arrow-right-24: Web Builder](web-builder.md)

</div>

## Quick Reference

| I want to... | Guide |
|-------------|-------|
| Check token balances | [ERC20 Guide](erc20-token.md) |
| Transfer tokens | [ERC20 Guide](erc20-token.md) |
| See who owns an NFT | [NFT Guide](nft-collection.md) |
| Swap tokens on Uniswap | [DeFi Guide](defi-protocol.md) |
| Use Polygon or Arbitrum | [Custom Networks](custom-network.md) |
| Set up Claude Desktop | [Claude Desktop](claude-desktop.md) |

## Prerequisites

Before starting any guide, make sure you have:

- [x] Installed abi-to-mcp (`pip install abi-to-mcp`)
- [x] Python 3.10 or later
- [x] Access to an RPC endpoint (Alchemy, Infura, or public)
- [ ] (Optional) Private key for write operations
- [ ] (Optional) Etherscan API key for address lookups

## Skill Level

| Guide | Difficulty | Time |
|-------|------------|------|
| [ERC20 Token](erc20-token.md) | Beginner | 10 min |
| [NFT Collection](nft-collection.md) | Beginner | 15 min |
| [DeFi Protocol](defi-protocol.md) | Intermediate | 30 min |
| [Custom Network](custom-network.md) | Intermediate | 20 min |
| [Claude Desktop](claude-desktop.md) | Beginner | 15 min |

## Getting Help

If you run into issues:

1. Check the [CLI Reference](../cli/index.md) for command details
2. Review [Core Concepts](../concepts/index.md) for understanding
3. See [Troubleshooting](../reference/errors.md) for common errors
4. Open an issue on [GitHub](https://github.com/nirholas/UCAI/issues)

!!! tip "Ready-to-Use Examples"
    The [`examples/`](https://github.com/nirholas/UCAI/tree/main/examples) folder contains complete, runnable examples with ABIs and generation scripts for ERC20 tokens, NFT collections, DeFi protocols, and Claude Desktop configuration.
