---
title: CLI Reference
description: Complete command-line interface documentation
---

# CLI Reference

abi-to-mcp provides a powerful command-line interface for generating, inspecting, and managing MCP servers from smart contract ABIs.

## Overview

```bash
abi-to-mcp [OPTIONS] COMMAND [ARGS]...
```

### Global Options

| Option | Description |
|--------|-------------|
| `--version` | Show version and exit |
| `--help` | Show help message and exit |
| `--verbose`, `-v` | Increase output verbosity |
| `--quiet`, `-q` | Suppress non-essential output |

## Commands

<div class="grid cards" markdown>

-   :material-cog:{ .lg .middle } __generate__

    ---

    Generate an MCP server from an ABI source.

    [:octicons-arrow-right-24: generate](generate.md)

-   :material-magnify:{ .lg .middle } __inspect__

    ---

    Inspect an ABI and show what would be generated.

    [:octicons-arrow-right-24: inspect](inspect.md)

-   :material-check-circle:{ .lg .middle } __validate__

    ---

    Validate an ABI without generating anything.

    [:octicons-arrow-right-24: validate](validate.md)

-   :material-play:{ .lg .middle } __serve__

    ---

    Run a generated MCP server.

    [:octicons-arrow-right-24: serve](serve.md)

</div>

## Quick Examples

### Generate from Etherscan

```bash
# Generate MCP server for USDC on mainnet
abi-to-mcp generate 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  --network mainnet \
  --output ./usdc-mcp
```

### Generate from Local File

```bash
# Generate from a local ABI file
abi-to-mcp generate ./my-contract.json \
  --address 0x1234... \
  --output ./my-mcp
```

### Inspect Before Generating

```bash
# See what would be generated without creating files
abi-to-mcp inspect 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  --network mainnet
```

### Validate an ABI

```bash
# Check if an ABI is valid
abi-to-mcp validate ./my-contract.json
```

### Run a Generated Server

```bash
# Start an MCP server
abi-to-mcp serve ./my-mcp-server
```

## Environment Variables

The CLI respects these environment variables:

| Variable | Description | Used By |
|----------|-------------|---------|
| `ETHERSCAN_API_KEY` | Etherscan API key | `generate`, `inspect` |
| `POLYGONSCAN_API_KEY` | Polygonscan API key | `generate`, `inspect` |
| `ARBISCAN_API_KEY` | Arbiscan API key | `generate`, `inspect` |
| `RPC_URL` | Default RPC endpoint | `serve` |
| `PRIVATE_KEY` | Wallet private key | `serve` (write operations) |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | ABI not found |
| 4 | ABI validation failed |
| 5 | Generation failed |
| 6 | Network error |

## See Also

- [Quickstart](../getting-started/quickstart.md) - Get started quickly
- [Networks Reference](../reference/networks.md) - Supported networks
- [Error Reference](../reference/errors.md) - Error codes and solutions
