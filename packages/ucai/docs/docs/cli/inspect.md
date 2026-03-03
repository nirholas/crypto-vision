---
title: inspect
description: Inspect an ABI and preview what would be generated
---

# abi-to-mcp inspect

Inspect an ABI and show what would be generated without creating any files.

## Synopsis

```bash
abi-to-mcp inspect SOURCE [OPTIONS]
```

## Description

The `inspect` command fetches and parses an ABI, then displays detailed information about what would be generated. This is useful for:

- Previewing before committing to generation
- Checking if a contract is suitable for MCP
- Understanding the detected standard (ERC20, ERC721, etc.)
- Verifying function and event signatures

## Arguments

### SOURCE

The ABI source (same as `generate`):

- **Contract address**: `0x...`
- **File path**: `./contract.json`

## Options

### `--network`, `-n`

Network for address lookups.

| Default | `mainnet` |
|---------|-----------|
| Choices | `mainnet`, `sepolia`, `polygon`, `arbitrum`, `optimism`, `base`, `bsc`, `avalanche`, `fantom` |

### `--format`, `-f`

Output format.

| Default | `table` |
|---------|---------|
| Choices | `table`, `json`, `yaml` |

### `--verbose`, `-v`

Show detailed information including parameter types.

| Default | `False` |
|---------|---------|

## Examples

### Basic Inspection

```bash
abi-to-mcp inspect 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 -n mainnet
```

Output:

```
╭─────────────────────────────────────────────────────────────╮
│                     Contract Inspection                      │
├─────────────────────────────────────────────────────────────┤
│ Address:    0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48      │
│ Network:    mainnet (Chain ID: 1)                           │
│ Standard:   ERC20 ✓                                         │
│ Is Proxy:   Yes (Implementation: 0x43506...)                │
╰─────────────────────────────────────────────────────────────╯

Functions (13):
┏━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━┳━━━━━━━━━━━┓
┃ Name             ┃ Mutability   ┃ Tool Type     ┃ Params    ┃
┡━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━╇━━━━━━━━━━━┩
│ name             │ view         │ read          │ 0         │
│ symbol           │ view         │ read          │ 0         │
│ decimals         │ view         │ read          │ 0         │
│ totalSupply      │ view         │ read          │ 0         │
│ balanceOf        │ view         │ read          │ 1         │
│ allowance        │ view         │ read          │ 2         │
│ transfer         │ nonpayable   │ write         │ 2         │
│ approve          │ nonpayable   │ write         │ 2         │
│ transferFrom     │ nonpayable   │ write         │ 3         │
│ increaseAllowance│ nonpayable   │ write         │ 2         │
│ decreaseAllowance│ nonpayable   │ write         │ 2         │
│ mint             │ nonpayable   │ write         │ 2         │
│ burn             │ nonpayable   │ write         │ 1         │
└──────────────────┴──────────────┴───────────────┴───────────┘

Events (2):
┏━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━┓
┃ Name             ┃ Indexed Fields     ┃ Data Fields         ┃
┡━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━┩
│ Transfer         │ from, to           │ value               │
│ Approval         │ owner, spender     │ value               │
└──────────────────┴────────────────────┴─────────────────────┘

Summary:
  • Read tools:  6
  • Write tools: 7
  • Resources:   2
  • Ready for generation ✓
```

### Verbose Output

```bash
abi-to-mcp inspect 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 -n mainnet -v
```

Shows additional details:

```
Function: balanceOf
  Solidity:  function balanceOf(address account) view returns (uint256)
  Tool Name: balance_of
  Type:      read
  Parameters:
    - account: address → string (pattern: ^0x[a-fA-F0-9]{40}$)
  Returns:   uint256 → string (pattern: ^[0-9]+$)
```

### JSON Output

```bash
abi-to-mcp inspect 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 -n mainnet -f json
```

```json
{
  "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "network": "mainnet",
  "chain_id": 1,
  "detected_standard": "ERC20",
  "is_proxy": true,
  "implementation": "0x43506849D7C04F9138D1A2050bbF3A0c054402dd",
  "functions": [
    {
      "name": "balanceOf",
      "state_mutability": "view",
      "tool_type": "read",
      "inputs": [
        {"name": "account", "type": "address"}
      ],
      "outputs": [
        {"name": "", "type": "uint256"}
      ]
    }
  ],
  "events": [
    {
      "name": "Transfer",
      "inputs": [
        {"name": "from", "type": "address", "indexed": true},
        {"name": "to", "type": "address", "indexed": true},
        {"name": "value", "type": "uint256", "indexed": false}
      ]
    }
  ]
}
```

### Inspect Local File

```bash
abi-to-mcp inspect ./my-contract.json
```

## Use Cases

### Verify Before Generation

```bash
# Check what would be generated
abi-to-mcp inspect 0x... -n mainnet

# If satisfied, generate
abi-to-mcp generate 0x... -n mainnet -o ./output
```

### Check Standard Detection

```bash
# See if contract is recognized as ERC20/ERC721/etc.
abi-to-mcp inspect 0x... | grep Standard
```

### Export for Analysis

```bash
# Export to JSON for further analysis
abi-to-mcp inspect 0x... -f json > contract-analysis.json
```

### Compare Contracts

```bash
# Inspect multiple contracts
abi-to-mcp inspect 0xUSDC... -f json > usdc.json
abi-to-mcp inspect 0xDAI... -f json > dai.json

# Compare (using jq or similar)
diff <(jq '.functions[].name' usdc.json) <(jq '.functions[].name' dai.json)
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 3 | ABI not found |
| 6 | Network error |

## See Also

- [generate](generate.md) - Generate after inspecting
- [validate](validate.md) - Validate ABI format
- [ERC Standards](../reference/erc-standards.md) - Standard detection details
