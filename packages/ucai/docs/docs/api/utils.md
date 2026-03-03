---
title: Utilities API
description: Validation, formatting, and logging utilities
---

# Utilities API

The `utils` module provides helper functions used throughout UCAI. These utilities handle common tasks like address validation, value formatting, and logging configuration.

---

## Module: `abi_to_mcp.utils.validation`

Address and ABI validation utilities.

### Address Validation

#### `is_valid_address(address: str) -> bool`

Check if a string is a valid Ethereum address.

```python
from abi_to_mcp.utils.validation import is_valid_address

is_valid_address("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")  # True
is_valid_address("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")  # True
is_valid_address("0xA0b86991")  # False - too short
is_valid_address("not an address")  # False
```

#### `is_checksum_address(address: str) -> bool`

Check if an address has valid EIP-55 checksum.

```python
from abi_to_mcp.utils.validation import is_checksum_address

is_checksum_address("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")  # True
is_checksum_address("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")  # False
```

#### `to_checksum_address(address: str) -> str`

Convert an address to EIP-55 checksum format.

```python
from abi_to_mcp.utils.validation import to_checksum_address

checksum = to_checksum_address("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")
# "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
```

**Raises:** `ValueError` if address is invalid.

---

### Network Validation

#### `validate_network(network: str) -> bool`

Check if a network name is supported.

```python
from abi_to_mcp.utils.validation import validate_network

validate_network("mainnet")   # True
validate_network("polygon")   # True
validate_network("solana")    # False
```

#### `get_supported_networks() -> List[str]`

Get list of all supported network names.

```python
from abi_to_mcp.utils.validation import get_supported_networks

networks = get_supported_networks()
# ['mainnet', 'sepolia', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc', 'avalanche', 'fantom']
```

---

### ABI Validation

#### `is_valid_abi(abi: Any) -> bool`

Check if an object is a valid ABI structure.

```python
from abi_to_mcp.utils.validation import is_valid_abi

# Valid ABI
abi = [{"type": "function", "name": "transfer", ...}]
is_valid_abi(abi)  # True

# Invalid
is_valid_abi({"not": "a list"})  # False
is_valid_abi("[]")  # False - must be list, not string
```

#### `validate_abi_entry(entry: Dict) -> ValidationResult`

Validate a single ABI entry and return detailed results.

```python
from abi_to_mcp.utils.validation import validate_abi_entry

result = validate_abi_entry({
    "type": "function",
    "name": "transfer",
    "inputs": [...],
    "outputs": [...],
    "stateMutability": "nonpayable"
})

if result.is_valid:
    print("Entry is valid")
else:
    for error in result.errors:
        print(f"Error: {error}")
```

---

### Solidity Type Validation

#### `is_valid_solidity_type(type_str: str) -> bool`

Check if a string is a valid Solidity type.

```python
from abi_to_mcp.utils.validation import is_valid_solidity_type

is_valid_solidity_type("uint256")     # True
is_valid_solidity_type("address")     # True
is_valid_solidity_type("bytes32")     # True
is_valid_solidity_type("string[]")    # True
is_valid_solidity_type("uint999")     # False
is_valid_solidity_type("invalid")     # False
```

#### `parse_array_type(type_str: str) -> Tuple[str, bool, Optional[int]]`

Parse an array type string.

```python
from abi_to_mcp.utils.validation import parse_array_type

base, is_array, size = parse_array_type("uint256[]")
# ("uint256", True, None)

base, is_array, size = parse_array_type("bytes32[10]")
# ("bytes32", True, 10)

base, is_array, size = parse_array_type("address")
# ("address", False, None)
```

---

## Module: `abi_to_mcp.utils.formatting`

Value and string formatting utilities.

### Address Formatting

#### `format_address(address: str, checksum: bool = True) -> str`

Format an address with optional checksum conversion.

```python
from abi_to_mcp.utils.formatting import format_address

# With checksum (default)
format_address("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")
# "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"

# Without checksum
format_address("0xA0b8...", checksum=False)
# "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
```

#### `truncate_address(address: str, chars: int = 4) -> str`

Truncate an address for display.

```python
from abi_to_mcp.utils.formatting import truncate_address

truncate_address("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
# "0xA0b8...eB48"

truncate_address("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chars=6)
# "0xA0b869...06eB48"
```

---

### Value Formatting

#### `format_wei(wei: int, unit: str = "ether", decimals: int = 4) -> str`

Format a Wei value to a human-readable string.

```python
from abi_to_mcp.utils.formatting import format_wei

format_wei(1000000000000000000)      # "1.0000 ETH"
format_wei(1500000000000000000)      # "1.5000 ETH"
format_wei(1000000000, unit="gwei")  # "1.0000 GWEI"
format_wei(1234567890123456789, decimals=2)  # "1.23 ETH"
```

#### `format_gas_price(gwei: float) -> str`

Format gas price for display.

```python
from abi_to_mcp.utils.formatting import format_gas_price

format_gas_price(25.5)   # "25.5 gwei"
format_gas_price(100.0)  # "100.0 gwei"
```

#### `format_token_amount(amount: int, decimals: int = 18, symbol: str = "") -> str`

Format a token amount with decimals.

```python
from abi_to_mcp.utils.formatting import format_token_amount

# USDC (6 decimals)
format_token_amount(1000000, decimals=6, symbol="USDC")
# "1.000000 USDC"

# ETH (18 decimals)
format_token_amount(1500000000000000000, decimals=18, symbol="ETH")
# "1.500000000000000000 ETH"
```

---

### String Utilities

#### `truncate_middle(text: str, max_length: int = 20) -> str`

Truncate a string in the middle.

```python
from abi_to_mcp.utils.formatting import truncate_middle

truncate_middle("This is a very long string", max_length=15)
# "This i...string"
```

#### `snake_to_camel(name: str) -> str`

Convert snake_case to camelCase.

```python
from abi_to_mcp.utils.formatting import snake_to_camel

snake_to_camel("balance_of")      # "balanceOf"
snake_to_camel("get_user_info")   # "getUserInfo"
snake_to_camel("name")            # "name"
```

#### `camel_to_snake(name: str) -> str`

Convert camelCase to snake_case.

```python
from abi_to_mcp.utils.formatting import camel_to_snake

camel_to_snake("balanceOf")     # "balance_of"
camel_to_snake("getUserInfo")   # "get_user_info"
camel_to_snake("name")          # "name"
```

#### `to_safe_identifier(name: str) -> str`

Convert a string to a valid Python identifier.

```python
from abi_to_mcp.utils.formatting import to_safe_identifier

to_safe_identifier("123start")        # "_123start"
to_safe_identifier("my-variable")     # "my_variable"
to_safe_identifier("class")           # "class_"
to_safe_identifier("")                # "unnamed"
```

---

### JSON Formatting

#### `pretty_json(data: Any, indent: int = 2) -> str`

Format data as pretty-printed JSON.

```python
from abi_to_mcp.utils.formatting import pretty_json

data = {"name": "USDC", "decimals": 6}
print(pretty_json(data))
# {
#   "name": "USDC",
#   "decimals": 6
# }
```

---

## Module: `abi_to_mcp.utils.logging`

Logging configuration and utilities.

### Logger Setup

#### `get_logger(name: str) -> logging.Logger`

Get a configured logger for a module.

```python
from abi_to_mcp.utils.logging import get_logger

logger = get_logger(__name__)
logger.info("Processing ABI...")
logger.debug("Found 15 functions")
logger.warning("Deprecated function detected")
logger.error("Failed to parse entry")
```

#### `setup_logging(level: str = "INFO", format_style: str = "simple") -> None`

Configure logging for the application.

```python
from abi_to_mcp.utils.logging import setup_logging

# Simple format for CLI
setup_logging(level="INFO", format_style="simple")

# Detailed format for debugging
setup_logging(level="DEBUG", format_style="detailed")

# JSON format for structured logging
setup_logging(level="INFO", format_style="json")
```

**Format Styles:**

| Style | Output |
|-------|--------|
| `simple` | `[INFO] Message` |
| `detailed` | `2024-01-15 10:30:00 [INFO] module: Message` |
| `json` | `{"time": "...", "level": "INFO", "message": "..."}` |

#### `set_level(level: str) -> None`

Change log level at runtime.

```python
from abi_to_mcp.utils.logging import set_level

set_level("DEBUG")  # Show all messages
set_level("WARNING")  # Show only warnings and errors
set_level("ERROR")  # Show only errors
```

---

### Log Levels

| Level | Usage |
|-------|-------|
| `DEBUG` | Detailed diagnostic information |
| `INFO` | General operational messages |
| `WARNING` | Potential issues or deprecations |
| `ERROR` | Errors that don't stop execution |
| `CRITICAL` | Fatal errors requiring shutdown |

---

## Module: `abi_to_mcp.utils.crypto`

Cryptographic utilities.

### Hashing

#### `keccak256(data: bytes) -> bytes`

Compute Keccak-256 hash (Ethereum's hash function).

```python
from abi_to_mcp.utils.crypto import keccak256

# Hash some data
result = keccak256(b"Hello, World!")
print(result.hex())  # 32-byte hash
```

#### `function_selector(signature: str) -> str`

Compute the 4-byte function selector.

```python
from abi_to_mcp.utils.crypto import function_selector

selector = function_selector("transfer(address,uint256)")
# "0xa9059cbb"
```

#### `event_topic(signature: str) -> str`

Compute the 32-byte event topic.

```python
from abi_to_mcp.utils.crypto import event_topic

topic = event_topic("Transfer(address,address,uint256)")
# "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
```

---

## Complete Example

```python
from abi_to_mcp.utils.validation import (
    is_valid_address,
    to_checksum_address,
    is_valid_abi,
)
from abi_to_mcp.utils.formatting import (
    format_address,
    truncate_address,
    format_token_amount,
    camel_to_snake,
)
from abi_to_mcp.utils.logging import get_logger, setup_logging

# Setup logging
setup_logging(level="INFO")
logger = get_logger(__name__)

# Validate and format address
address = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"

if is_valid_address(address):
    checksum = to_checksum_address(address)
    display = truncate_address(checksum)
    logger.info(f"Processing contract: {display}")
    
    # Format token amounts
    balance = 1500000000  # 1500 USDC (6 decimals)
    formatted = format_token_amount(balance, decimals=6, symbol="USDC")
    logger.info(f"Balance: {formatted}")
else:
    logger.error(f"Invalid address: {address}")
```

---

## Best Practices

### Validation

1. **Always validate addresses** before making RPC calls
2. **Use checksum addresses** for comparison (prevents case issues)
3. **Validate ABI structure** before parsing

### Formatting

1. **Use Wei internally**, format for display only
2. **Truncate addresses** in logs to improve readability
3. **Convert naming conventions** at boundaries (Python ↔ Solidity)

### Logging

1. **Use module-specific loggers** via `get_logger(__name__)`
2. **Set appropriate levels** for different environments
3. **Include context** in error messages
---

## Auto-Generated API Reference

The following sections are automatically generated from source code docstrings using mkdocstrings.

### Validation Module

::: abi_to_mcp.utils.validation
    options:
      show_root_heading: true
      show_source: false
      members_order: source
      heading_level: 4
      show_if_no_docstring: false

### Formatting Module

::: abi_to_mcp.utils.formatting
    options:
      show_root_heading: true
      show_source: false
      members_order: source
      heading_level: 4
      show_if_no_docstring: false

### Logging Module

::: abi_to_mcp.utils.logging
    options:
      show_root_heading: true
      show_source: false
      members_order: source
      heading_level: 4
      show_if_no_docstring: false