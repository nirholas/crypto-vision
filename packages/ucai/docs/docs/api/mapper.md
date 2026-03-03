---
title: Mapper API
description: Type mapping module documentation
---

# Mapper API

The mapper module converts parsed ABI elements to MCP-compatible definitions.

## Module: `abi_to_mcp.mapper`

### TypeMapper

Map Solidity types to JSON Schema.

```python
from abi_to_mcp.mapper import TypeMapper

mapper = TypeMapper()
schema = mapper.to_json_schema(parsed_type)
```

#### Methods

##### `parse_type(type_str: str) -> ParsedType`

Parse a Solidity type string.

```python
parsed = mapper.parse_type("uint256[]")
print(parsed.base_type)   # "uint256"
print(parsed.is_array)    # True
print(parsed.array_size)  # None
```

##### `to_json_schema(parsed_type: ParsedType) -> Dict`

Convert parsed type to JSON Schema.

```python
# Simple types
schema = mapper.to_json_schema(mapper.parse_type("address"))
# {"type": "string", "pattern": "^0x[a-fA-F0-9]{40}$"}

schema = mapper.to_json_schema(mapper.parse_type("uint256"))
# {"type": "string", "pattern": "^[0-9]+$"}

schema = mapper.to_json_schema(mapper.parse_type("bool"))
# {"type": "boolean"}

# Arrays
schema = mapper.to_json_schema(mapper.parse_type("address[]"))
# {"type": "array", "items": {"type": "string", "pattern": "..."}}

# Fixed arrays
schema = mapper.to_json_schema(mapper.parse_type("bytes32[10]"))
# {"type": "array", "items": {...}, "minItems": 10, "maxItems": 10}
```

##### `to_python_type(type_str: str) -> str`

Get Python type hint for Solidity type.

```python
mapper.to_python_type("address")   # "str"
mapper.to_python_type("uint256")   # "str"
mapper.to_python_type("bool")      # "bool"
mapper.to_python_type("bytes")     # "str"
mapper.to_python_type("address[]") # "List[str]"
mapper.to_python_type("tuple")     # "Dict[str, Any]"
```

##### `map_components(components: List[ABIParameter]) -> Dict`

Map tuple components to JSON Schema object.

```python
components = [
    ABIParameter(name="tokenIn", type="address"),
    ABIParameter(name="amount", type="uint256"),
]

schema = mapper.map_components(components)
# {
#   "type": "object",
#   "properties": {
#     "tokenIn": {"type": "string", "pattern": "..."},
#     "amount": {"type": "string", "pattern": "..."}
#   },
#   "required": ["tokenIn", "amount"]
# }
```

---

### FunctionMapper

Map ABIFunction to MCP tool definitions.

```python
from abi_to_mcp.mapper import FunctionMapper, TypeMapper

type_mapper = TypeMapper()
func_mapper = FunctionMapper(type_mapper)

tool = func_mapper.map_function(abi_function)
```

#### Constructor

```python
FunctionMapper(type_mapper: TypeMapper)
```

#### Methods

##### `map_function(func: ABIFunction) -> MappedTool`

Convert ABIFunction to MappedTool.

```python
func = ABIFunction(
    name="transferFrom",
    inputs=[
        ABIParameter(name="from", type="address"),
        ABIParameter(name="to", type="address"),
        ABIParameter(name="amount", type="uint256"),
    ],
    outputs=[ABIParameter(name="", type="bool")],
    state_mutability=StateMutability.NONPAYABLE,
)

tool = func_mapper.map_function(func)

print(tool.name)           # "transfer_from"
print(tool.original_name)  # "transferFrom"
print(tool.tool_type)      # "write"
print(tool.parameters)     # [{"name": "from_", ...}, ...]
```

##### `generate_description(func: ABIFunction) -> str`

Generate LLM-friendly description.

```python
desc = func_mapper.generate_description(func)
# "Transfer tokens from one address to another.
#  This operation modifies blockchain state and requires gas.
#  
#  Parameters:
#  - from: Source address
#  - to: Destination address  
#  - amount: Amount to transfer (in wei)"
```

##### `to_python_signature(func: ABIFunction, tool: MappedTool) -> str`

Generate Python function signature.

```python
sig = func_mapper.to_python_signature(func, tool)
# "async def transfer_from(from_: str, to: str, amount: str, simulate: bool = True) -> Dict[str, Any]"
```

---

### EventMapper

Map ABIEvent to MCP resource definitions.

```python
from abi_to_mcp.mapper import EventMapper, TypeMapper

type_mapper = TypeMapper()
event_mapper = EventMapper(type_mapper)

resource = event_mapper.map_event(abi_event)
```

#### Methods

##### `map_event(event: ABIEvent) -> MappedResource`

Convert ABIEvent to MappedResource.

```python
event = ABIEvent(
    name="Transfer",
    inputs=[
        ABIParameter(name="from", type="address", indexed=True),
        ABIParameter(name="to", type="address", indexed=True),
        ABIParameter(name="value", type="uint256", indexed=False),
    ]
)

resource = event_mapper.map_event(event)

print(resource.name)          # "transfer"
print(resource.uri_template)  # "events://transfer"
print(resource.fields)        # [{"name": "from", ...}, ...]
```

---

### SchemaBuilder

Build complete JSON Schemas for tools and resources.

```python
from abi_to_mcp.mapper import SchemaBuilder

builder = SchemaBuilder()
schema = builder.build_tool_schema(tool)
```

#### Methods

##### `build_tool_schema(tool: MappedTool) -> Dict`

Build complete input schema for a tool.

```python
schema = builder.build_tool_schema(tool)
# {
#   "type": "object",
#   "properties": {...},
#   "required": [...]
# }
```

##### `build_resource_schema(resource: MappedResource) -> Dict`

Build schema for resource data.

```python
schema = builder.build_resource_schema(resource)
```

---

## Data Classes

### MappedTool

Function mapped to MCP tool definition.

```python
@dataclass
class MappedTool:
    name: str              # snake_case tool name
    original_name: str     # Original Solidity function name
    description: str       # LLM-friendly description
    tool_type: str         # "read", "write", "write_payable"
    parameters: List[Dict[str, Any]]  # JSON Schema properties
    required_params: List[str]
    return_schema: Dict[str, Any]
    python_signature: str  # For code generation
```

### MappedResource

Event mapped to MCP resource definition.

```python
@dataclass
class MappedResource:
    name: str              # snake_case resource name
    original_name: str     # Original event name
    description: str       # LLM-friendly description
    uri_template: str      # e.g., "events://transfer"
    fields: List[Dict[str, Any]]  # Field definitions
```

---

## Examples

### Map All Functions

```python
from abi_to_mcp.parser import ABIParser
from abi_to_mcp.mapper import TypeMapper, FunctionMapper

parser = ABIParser()
parsed = parser.parse(abi_json)

type_mapper = TypeMapper()
func_mapper = FunctionMapper(type_mapper)

tools = []
for func in parsed.functions:
    tool = func_mapper.map_function(func)
    tools.append(tool)
    
# Separate by type
read_tools = [t for t in tools if t.tool_type == "read"]
write_tools = [t for t in tools if t.tool_type == "write"]
payable_tools = [t for t in tools if t.tool_type == "write_payable"]
```

### Custom Type Mapping

```python
from abi_to_mcp.mapper import TypeMapper

class CustomTypeMapper(TypeMapper):
    """Custom mapper with additional types."""
    
    def to_json_schema(self, parsed_type) -> dict:
        # Custom handling for specific types
        if parsed_type.base_type == "uint256":
            return {
                "type": "string",
                "pattern": "^[0-9]+$",
                "description": "Unsigned 256-bit integer as string"
            }
        
        return super().to_json_schema(parsed_type)
```

### Reserved Keyword Handling

```python
# The mapper automatically handles Python reserved keywords
func = ABIFunction(
    name="test",
    inputs=[
        ABIParameter(name="from", type="address"),  # Reserved!
        ABIParameter(name="type", type="uint8"),    # Reserved!
    ],
    outputs=[],
    state_mutability=StateMutability.VIEW,
)

tool = func_mapper.map_function(func)

# Parameters are renamed
print(tool.parameters[0]["name"])  # "from_"
print(tool.parameters[1]["name"])  # "type_"
```
