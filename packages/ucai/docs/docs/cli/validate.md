---
title: validate
description: Validate an ABI without generating
---

# abi-to-mcp validate

Validate an ABI structure without generating any files.

## Synopsis

```bash
abi-to-mcp validate SOURCE [OPTIONS]
```

## Description

The `validate` command checks if an ABI is valid and can be processed by abi-to-mcp. It's useful for:

- Checking ABI files before generation
- Validating ABIs from unknown sources
- Debugging malformed ABIs
- CI/CD pipelines

## Arguments

### SOURCE

The ABI source:

- **File path**: `./contract.json`
- **Contract address**: `0x...` (fetched from Etherscan)

## Options

### `--network`, `-n`

Network for address lookups.

| Default | `mainnet` |
|---------|-----------|

### `--strict`

Enable strict validation (fail on warnings).

| Default | `False` |
|---------|---------|

### `--format`, `-f`

Output format.

| Default | `text` |
|---------|--------|
| Choices | `text`, `json` |

## Examples

### Validate a Local File

```bash
abi-to-mcp validate ./my-contract.json
```

Output (valid):

```
✓ ABI is valid

Summary:
  • Entries: 15
  • Functions: 12
  • Events: 2
  • Errors: 1
  • No issues found
```

Output (invalid):

```
✗ ABI validation failed

Errors:
  1. Entry 3: Missing required field "name" for function
  2. Entry 7: Invalid stateMutability value "mutable"
  3. Entry 12: Parameter type "uint" should be "uint256"

Warnings:
  1. Entry 5: Function has no outputs (consider if intentional)
```

### Validate from Address

```bash
abi-to-mcp validate 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 -n mainnet
```

### Strict Mode

```bash
# Fail on warnings too
abi-to-mcp validate ./my-contract.json --strict
```

### JSON Output

```bash
abi-to-mcp validate ./my-contract.json -f json
```

```json
{
  "valid": false,
  "errors": [
    {
      "entry_index": 3,
      "entry_type": "function",
      "message": "Missing required field \"name\""
    }
  ],
  "warnings": [
    {
      "entry_index": 5,
      "entry_type": "function",
      "message": "Function has no outputs"
    }
  ],
  "summary": {
    "total_entries": 15,
    "functions": 12,
    "events": 2,
    "errors": 1
  }
}
```

## Validation Rules

### Required Fields

| Entry Type | Required Fields |
|------------|----------------|
| `function` | `name` (except constructor/fallback/receive) |
| `event` | `name` |
| `error` | `name` |
| `constructor` | `inputs` |

### State Mutability

For functions, `stateMutability` must be one of:

- `pure` - No state access
- `view` - Read-only state access
- `nonpayable` - Modifies state, no ETH
- `payable` - Modifies state, accepts ETH

### Type Validation

All Solidity types must be valid:

- Basic: `address`, `bool`, `string`, `bytes`
- Sized: `uint8`-`uint256`, `int8`-`int256`, `bytes1`-`bytes32`
- Arrays: `type[]`, `type[N]`
- Tuples: `tuple` with `components`

### Common Issues

| Issue | Example | Fix |
|-------|---------|-----|
| Missing type size | `uint` | Use `uint256` |
| Invalid mutability | `constant: true` | Use `stateMutability: "view"` |
| Missing name | `{"type": "function", ...}` | Add `"name": "..."` |
| Invalid array syntax | `address []` | Use `address[]` (no space) |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Valid (no errors) |
| 4 | Validation failed (errors found) |
| 3 | ABI not found |

## Use in CI/CD

```yaml
# GitHub Actions example
- name: Validate ABI
  run: |
    abi-to-mcp validate ./artifacts/MyContract.json --strict
```

```bash
# Shell script
if abi-to-mcp validate ./abi.json; then
  echo "ABI is valid"
  abi-to-mcp generate ./abi.json -o ./server
else
  echo "ABI validation failed"
  exit 1
fi
```

## See Also

- [generate](generate.md) - Generate after validating
- [inspect](inspect.md) - Detailed ABI inspection
- [Errors Reference](../reference/errors.md) - Common error solutions
