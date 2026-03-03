---
title: Type Mapping Table
description: Complete Solidity to JSON Schema type mapping reference
---

# Type Mapping Table

Complete reference for how Solidity types are mapped to JSON Schema.

## Integer Types

### Unsigned Integers

| Solidity | JSON Schema | Python | Notes |
|----------|-------------|--------|-------|
| `uint8` | `{"type": "string", "pattern": "^[0-9]+$"}` | `str` | 0 to 255 |
| `uint16` | `{"type": "string", "pattern": "^[0-9]+$"}` | `str` | 0 to 65,535 |
| `uint24` | `{"type": "string", "pattern": "^[0-9]+$"}` | `str` | Used for Uniswap fees |
| `uint32` | `{"type": "string", "pattern": "^[0-9]+$"}` | `str` | 0 to 4.29B |
| `uint64` | `{"type": "string", "pattern": "^[0-9]+$"}` | `str` | Common for timestamps |
| `uint128` | `{"type": "string", "pattern": "^[0-9]+$"}` | `str` | Large numbers |
| `uint256` | `{"type": "string", "pattern": "^[0-9]+$"}` | `str` | Most common |

### Signed Integers

| Solidity | JSON Schema | Python | Notes |
|----------|-------------|--------|-------|
| `int8` | `{"type": "string", "pattern": "^-?[0-9]+$"}` | `str` | -128 to 127 |
| `int16` | `{"type": "string", "pattern": "^-?[0-9]+$"}` | `str` | -32,768 to 32,767 |
| `int24` | `{"type": "string", "pattern": "^-?[0-9]+$"}` | `str` | Uniswap tick |
| `int32` | `{"type": "string", "pattern": "^-?[0-9]+$"}` | `str` | Standard signed |
| `int64` | `{"type": "string", "pattern": "^-?[0-9]+$"}` | `str` | Large signed |
| `int128` | `{"type": "string", "pattern": "^-?[0-9]+$"}` | `str` | Very large signed |
| `int256` | `{"type": "string", "pattern": "^-?[0-9]+$"}` | `str` | Maximum signed |

!!! info "Why Strings for Numbers?"
    JSON numbers have precision limits (~15-17 significant digits). Solidity integers can be up to 256 bits (78 digits). Using strings preserves full precision.

## Address Type

| Solidity | JSON Schema | Python |
|----------|-------------|--------|
| `address` | `{"type": "string", "pattern": "^0x[a-fA-F0-9]{40}$"}` | `str` |

**Valid examples:**
```
0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48  ✓
0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48  ✓ (lowercase OK)
0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48  ✓ (uppercase OK)
```

**Invalid examples:**
```
A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48   ✗ (missing 0x)
0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB4  ✗ (39 chars)
```

## Boolean Type

| Solidity | JSON Schema | Python |
|----------|-------------|--------|
| `bool` | `{"type": "boolean"}` | `bool` |

**Valid examples:**
```
true   ✓
false  ✓
```

## Bytes Types

### Fixed-Size Bytes

| Solidity | JSON Schema | Python | Hex Length |
|----------|-------------|--------|------------|
| `bytes1` | `{"type": "string", "pattern": "^0x[a-fA-F0-9]{2}$"}` | `str` | 2 |
| `bytes2` | `{"type": "string", "pattern": "^0x[a-fA-F0-9]{4}$"}` | `str` | 4 |
| `bytes4` | `{"type": "string", "pattern": "^0x[a-fA-F0-9]{8}$"}` | `str` | 8 |
| `bytes8` | `{"type": "string", "pattern": "^0x[a-fA-F0-9]{16}$"}` | `str` | 16 |
| `bytes16` | `{"type": "string", "pattern": "^0x[a-fA-F0-9]{32}$"}` | `str` | 32 |
| `bytes20` | `{"type": "string", "pattern": "^0x[a-fA-F0-9]{40}$"}` | `str` | 40 |
| `bytes32` | `{"type": "string", "pattern": "^0x[a-fA-F0-9]{64}$"}` | `str` | 64 |

### Dynamic Bytes

| Solidity | JSON Schema | Python |
|----------|-------------|--------|
| `bytes` | `{"type": "string", "pattern": "^0x[a-fA-F0-9]*$"}` | `str` |

**Valid examples:**
```
0x                         ✓ (empty bytes)
0x1234                     ✓
0xabcdef0123456789         ✓
```

## String Type

| Solidity | JSON Schema | Python |
|----------|-------------|--------|
| `string` | `{"type": "string"}` | `str` |

No pattern validation - any string is valid.

## Array Types

### Dynamic Arrays

| Solidity | JSON Schema | Python |
|----------|-------------|--------|
| `T[]` | `{"type": "array", "items": <T schema>}` | `List[T]` |

**Examples:**

```json
// address[]
{
  "type": "array",
  "items": {
    "type": "string",
    "pattern": "^0x[a-fA-F0-9]{40}$"
  }
}

// uint256[]
{
  "type": "array",
  "items": {
    "type": "string",
    "pattern": "^[0-9]+$"
  }
}
```

### Fixed-Size Arrays

| Solidity | JSON Schema | Python |
|----------|-------------|--------|
| `T[N]` | `{"type": "array", "items": <T schema>, "minItems": N, "maxItems": N}` | `List[T]` |

**Example:**

```json
// bytes32[3]
{
  "type": "array",
  "items": {
    "type": "string",
    "pattern": "^0x[a-fA-F0-9]{64}$"
  },
  "minItems": 3,
  "maxItems": 3
}
```

### Nested Arrays

| Solidity | JSON Schema | Python |
|----------|-------------|--------|
| `T[][]` | `{"type": "array", "items": {"type": "array", "items": <T schema>}}` | `List[List[T]]` |

**Example:**

```json
// uint256[][]
{
  "type": "array",
  "items": {
    "type": "array",
    "items": {
      "type": "string",
      "pattern": "^[0-9]+$"
    }
  }
}
```

## Tuple Types (Structs)

Tuples are mapped to JSON objects:

| Solidity | JSON Schema | Python |
|----------|-------------|--------|
| `tuple` | `{"type": "object", "properties": {...}, "required": [...]}` | `Dict[str, Any]` |

**Example:**

Solidity struct:
```solidity
struct SwapParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    uint256 amountIn;
}
```

JSON Schema:
```json
{
  "type": "object",
  "properties": {
    "tokenIn": {
      "type": "string",
      "pattern": "^0x[a-fA-F0-9]{40}$"
    },
    "tokenOut": {
      "type": "string",
      "pattern": "^0x[a-fA-F0-9]{40}$"
    },
    "fee": {
      "type": "string",
      "pattern": "^[0-9]+$"
    },
    "amountIn": {
      "type": "string",
      "pattern": "^[0-9]+$"
    }
  },
  "required": ["tokenIn", "tokenOut", "fee", "amountIn"]
}
```

## Special Cases

### Function Selectors

`bytes4` is commonly used for function selectors:

```json
{
  "type": "string",
  "pattern": "^0x[a-fA-F0-9]{8}$",
  "description": "Function selector (4 bytes)"
}
```

### Merkle Proofs

`bytes32[]` is commonly used for Merkle proofs:

```json
{
  "type": "array",
  "items": {
    "type": "string",
    "pattern": "^0x[a-fA-F0-9]{64}$"
  },
  "description": "Merkle proof (array of 32-byte hashes)"
}
```

### Calldata

`bytes` is used for encoded calldata:

```json
{
  "type": "string",
  "pattern": "^0x[a-fA-F0-9]*$",
  "description": "Encoded function call data"
}
```

## Validation Examples

### Valid Inputs

```python
# address
"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"  ✓

# uint256
"1000000000000000000"  ✓  # 1e18

# bool
True   ✓
False  ✓

# bytes32
"0x0000000000000000000000000000000000000000000000000000000000000001"  ✓

# address[]
["0xA0b8...", "0x1234..."]  ✓

# Empty array
[]  ✓
```

### Invalid Inputs

```python
# address - missing 0x prefix
"A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"  ✗

# uint256 - native number (loses precision)
1000000000000000000  ✗

# uint256 - negative not allowed
"-1"  ✗

# bool - string instead of boolean
"true"  ✗

# bytes32 - wrong length
"0x01"  ✗
```
