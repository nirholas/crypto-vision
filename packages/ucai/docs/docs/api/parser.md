---
title: Parser API
description: ABI parsing module documentation
---

# Parser API

The parser module converts raw ABI JSON into structured Python objects.

## Module: `abi_to_mcp.parser`

### ABIParser

Main parser class that orchestrates all sub-parsers.

```python
from abi_to_mcp.parser import ABIParser

parser = ABIParser()
parsed = parser.parse(abi_json)
```

#### Methods

##### `parse(abi: List[Dict]) -> ParsedABI`

Parse a complete ABI JSON into structured form.

```python
with open("abi.json") as f:
    abi = json.load(f)

parsed = parser.parse(abi)

print(f"Functions: {len(parsed.functions)}")
print(f"Events: {len(parsed.events)}")
print(f"Errors: {len(parsed.errors)}")
print(f"Standard: {parsed.detected_standard}")
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `abi` | `List[Dict[str, Any]]` | Raw ABI JSON array |

**Returns:** `ParsedABI` object

**Raises:**

- `ABIParseError` - Invalid ABI structure
- `ABIValidationError` - Invalid ABI entry

##### `validate(abi: List[Dict]) -> List[str]`

Validate an ABI and return list of errors.

```python
errors = parser.validate(abi)
if errors:
    for error in errors:
        print(f"Error: {error}")
else:
    print("ABI is valid")
```

**Returns:** List of error messages (empty if valid)

##### `detect_standard(functions, events) -> Optional[str]`

Detect if ABI implements a known standard.

```python
standard = parser.detect_standard(
    parsed.functions,
    parsed.events
)
# Returns: "ERC20", "ERC721", "ERC1155", or None
```

---

### FunctionParser

Parse function entries from ABI.

```python
from abi_to_mcp.parser import FunctionParser

func_parser = FunctionParser()
func = func_parser.parse(entry)
```

#### Methods

##### `parse(entry: Dict) -> ABIFunction`

Parse a single function entry.

```python
entry = {
    "type": "function",
    "name": "transfer",
    "inputs": [
        {"name": "to", "type": "address"},
        {"name": "amount", "type": "uint256"}
    ],
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable"
}

func = func_parser.parse(entry)
print(func.name)  # "transfer"
print(func.is_read_only)  # False
```

##### `parse_parameter(param: Dict) -> ABIParameter`

Parse a single parameter.

```python
param = {"name": "account", "type": "address"}
parsed_param = func_parser.parse_parameter(param)
```

---

### EventParser

Parse event entries from ABI.

```python
from abi_to_mcp.parser import EventParser

event_parser = EventParser()
event = event_parser.parse(entry)
```

#### Methods

##### `parse(entry: Dict) -> ABIEvent`

Parse a single event entry.

```python
entry = {
    "type": "event",
    "name": "Transfer",
    "inputs": [
        {"name": "from", "type": "address", "indexed": True},
        {"name": "to", "type": "address", "indexed": True},
        {"name": "value", "type": "uint256", "indexed": False}
    ]
}

event = event_parser.parse(entry)
print(event.name)  # "Transfer"
print(len(event.inputs))  # 3
```

---

### TypeParser

Parse Solidity type strings.

```python
from abi_to_mcp.parser import TypeParser

type_parser = TypeParser()
parsed_type = type_parser.parse("uint256[]")
```

#### Methods

##### `parse(type_str: str) -> ParsedType`

Parse a Solidity type string.

```python
# Simple types
t = type_parser.parse("uint256")
print(t.base_type)  # "uint256"
print(t.is_array)   # False

# Array types
t = type_parser.parse("address[]")
print(t.base_type)  # "address"
print(t.is_array)   # True
print(t.array_size) # None (dynamic)

# Fixed arrays
t = type_parser.parse("bytes32[10]")
print(t.array_size)  # 10

# Nested arrays
t = type_parser.parse("uint256[][]")
print(t.element_type.is_array)  # True
```

---

## Data Classes

### ParsedABI

Complete parsed ABI.

```python
@dataclass
class ParsedABI:
    functions: List[ABIFunction]
    events: List[ABIEvent]
    errors: List[ABIError]
    raw_abi: List[Dict[str, Any]]
    detected_standard: Optional[str] = None
    has_constructor: bool = False
    has_fallback: bool = False
    has_receive: bool = False
```

### ABIFunction

Parsed contract function.

```python
@dataclass
class ABIFunction:
    name: str
    inputs: List[ABIParameter]
    outputs: List[ABIParameter]
    state_mutability: StateMutability
    
    @property
    def is_read_only(self) -> bool: ...
    
    @property
    def is_payable(self) -> bool: ...
```

### ABIEvent

Parsed contract event.

```python
@dataclass
class ABIEvent:
    name: str
    inputs: List[ABIParameter]
    anonymous: bool = False
```

### ABIParameter

Function or event parameter.

```python
@dataclass
class ABIParameter:
    name: str
    type: str
    indexed: bool = False
    components: Optional[List["ABIParameter"]] = None
```

### StateMutability

Enum for function state mutability.

```python
class StateMutability(Enum):
    PURE = "pure"
    VIEW = "view"
    NONPAYABLE = "nonpayable"
    PAYABLE = "payable"
```

---

## Examples

### Parse and Analyze ERC20

```python
from abi_to_mcp.parser import ABIParser
import json

with open("erc20.json") as f:
    abi = json.load(f)

parser = ABIParser()
parsed = parser.parse(abi)

# Check standard
assert parsed.detected_standard == "ERC20"

# Find transfer function
transfer = next(f for f in parsed.functions if f.name == "transfer")
assert len(transfer.inputs) == 2
assert transfer.inputs[0].type == "address"
assert transfer.inputs[1].type == "uint256"

# Find Transfer event
transfer_event = next(e for e in parsed.events if e.name == "Transfer")
indexed_params = [p for p in transfer_event.inputs if p.indexed]
assert len(indexed_params) == 2
```

### Handle Complex Types

```python
# Tuple with components
entry = {
    "type": "function",
    "name": "swap",
    "inputs": [{
        "name": "params",
        "type": "tuple",
        "components": [
            {"name": "tokenIn", "type": "address"},
            {"name": "tokenOut", "type": "address"},
            {"name": "fee", "type": "uint24"}
        ]
    }],
    "outputs": [{"name": "amountOut", "type": "uint256"}],
    "stateMutability": "payable"
}

func = parser.parse([entry]).functions[0]
assert func.inputs[0].type == "tuple"
assert len(func.inputs[0].components) == 3
assert func.is_payable
```
