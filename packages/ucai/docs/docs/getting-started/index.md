---
title: Getting Started
description: Learn how to install and use UCAI (abi-to-mcp)
---

# Getting Started

Welcome to UCAI! This section will guide you through installation, your first server generation, and understanding what gets created.

## Overview

UCAI is a command-line tool (`abi-to-mcp`) and Python library that transforms Ethereum smart contract ABIs into fully functional MCP (Model Context Protocol) servers. These servers enable AI assistants like Claude to interact with any smart contract through a standardized interface.

## What You'll Learn

<div class="grid cards" markdown>

-   :material-download:{ .lg .middle } __Installation__

    ---

    Set up abi-to-mcp on your system with pip, pipx, or from source.

    [:octicons-arrow-right-24: Installation guide](installation.md)

-   :material-rocket-launch:{ .lg .middle } __Quickstart__

    ---

    Generate your first MCP server in under 5 minutes.

    [:octicons-arrow-right-24: Quickstart](quickstart.md)

-   :material-file-code:{ .lg .middle } __First MCP Server__

    ---

    Deep dive into the generated server structure and how it works.

    [:octicons-arrow-right-24: Understanding the output](first-server.md)

</div>

## Prerequisites

Before you begin, ensure you have:

- **Python 3.10 or higher** - Check with `python --version`
- **pip** - Python package installer (comes with Python)
- **Internet access** - For fetching ABIs from block explorers

### Optional but Recommended

- **Etherscan API key** - For higher rate limits when fetching ABIs
- **RPC endpoint** - For connecting to blockchain networks (free options available)
- **Claude Desktop** - For using generated servers with Claude

## Quick Path

If you're eager to get started, here's the fastest path:

```bash
# 1. Install
pip install abi-to-mcp

# 2. Generate (using USDC as an example)
abi-to-mcp generate 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 -n mainnet -o ./usdc-mcp

# 3. Configure
cd usdc-mcp
cp .env.example .env
# Edit .env to add your RPC_URL

# 4. Run
pip install -r requirements.txt
python server.py
```

For detailed explanations, continue to the [Installation](installation.md) page.

!!! tip "Examples Available"
    Check out the [`examples/`](https://github.com/nirholas/UCAI/tree/main/examples) folder for ready-to-use example configurations for ERC20 tokens, NFT collections, DeFi protocols, and Claude Desktop integration.

## Getting Help

If you run into issues:

1. Check the [Errors Reference](../reference/errors.md) for common problems
2. Search [GitHub Issues](https://github.com/nirholas/UCAI/issues)
3. Open a new issue with details about your problem

## Next Steps

Start with [Installation](installation.md) to set up abi-to-mcp on your system.
