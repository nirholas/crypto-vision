---
title: Generator API
description: Code generation module documentation
---

# Generator API

The generator module produces MCP server code from parsed ABIs.

## Module: `abi_to_mcp.generator`

### MCPGenerator

Main generator that orchestrates server generation.

```python
from abi_to_mcp.generator import MCPGenerator

generator = MCPGenerator()
server = generator.generate(
    parsed=parsed_abi,
    tools=mapped_tools,
    resources=mapped_resources,
    contract_address="0x...",
    network="mainnet"
)
```

#### Constructor

```python
MCPGenerator(config: Optional[GeneratorConfig] = None)
```

#### Methods

##### `generate(...) -> GeneratedServer`

Generate a complete MCP server package.

```python
server = generator.generate(
    parsed=parsed_abi,
    tools=mapped_tools,
    resources=mapped_resources,
    contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    network="mainnet",
    contract_name="USDC Token",
    output_dir="./my-server",
    read_only=False,
    simulation_default=True
)

# Write files
for file in server.files:
    path = Path(server.output_dir) / file.path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(file.content)
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `parsed` | `ParsedABI` | Parsed ABI object |
| `tools` | `List[MappedTool]` | Mapped tool definitions |
| `resources` | `List[MappedResource]` | Mapped resource definitions |
| `contract_address` | `str` | Contract address |
| `network` | `str` | Network name |
| `contract_name` | `Optional[str]` | Human-readable name |
| `output_dir` | `str` | Output directory |
| `read_only` | `bool` | Exclude write tools |
| `simulation_default` | `bool` | Default for simulate param |

**Returns:** `GeneratedServer` with all generated files

---

### ToolGenerator

Generate MCP tool code from mapped functions.

```python
from abi_to_mcp.generator import ToolGenerator

tool_gen = ToolGenerator(jinja_env)
code = tool_gen.generate_tool(mapped_tool)
```

#### Methods

##### `generate_tool(tool: MappedTool) -> str`

Generate Python code for a single MCP tool.

```python
code = tool_gen.generate_tool(tool)
# Returns Python code as string
```

##### `generate_all_tools(tools: List[MappedTool]) -> str`

Generate all tools as a single code block.

```python
code = tool_gen.generate_all_tools(tools)
```

**Generated Code Structure:**

```python
@mcp.tool()
async def balance_of(account: str) -> str:
    """
    Get the token balance for an account.
    
    This is a read-only operation that does not require gas.
    
    Args:
        account: The address to check balance for (0x...)
    
    Returns:
        The token balance as a string (wei)
    """
    result = await contract.functions.balanceOf(
        Web3.to_checksum_address(account)
    ).call()
    return str(result)
```

---

### ResourceGenerator

Generate MCP resource code from mapped events.

```python
from abi_to_mcp.generator import ResourceGenerator

resource_gen = ResourceGenerator(jinja_env)
code = resource_gen.generate_resource(mapped_resource)
```

#### Methods

##### `generate_resource(resource: MappedResource) -> str`

Generate Python code for a single MCP resource.

```python
code = resource_gen.generate_resource(resource)
```

##### `generate_all_resources(resources: List[MappedResource]) -> str`

Generate all resources as a single code block.

```python
code = resource_gen.generate_all_resources(resources)
```

**Generated Code Structure:**

```python
@mcp.resource("events://transfer")
async def get_transfer_events(
    from_address: Optional[str] = None,
    to_address: Optional[str] = None,
    from_block: Optional[int] = None,
    to_block: Optional[int] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Query Transfer events from the contract."""
    ...
```

---

### ServerGenerator

Generate complete server files.

```python
from abi_to_mcp.generator import ServerGenerator

server_gen = ServerGenerator(config)
files = server_gen.generate_all(...)
```

#### Generated Files

| File | Description |
|------|-------------|
| `server.py` | Main MCP server with all tools and resources |
| `config.py` | Configuration loading |
| `README.md` | Documentation |
| `pyproject.toml` | Package configuration |
| `requirements.txt` | Dependencies |
| `.env.example` | Environment template |

---

## Data Classes

### GeneratorConfig

Configuration for code generation.

```python
@dataclass
class GeneratorConfig:
    template_dir: Optional[Path] = None  # Custom templates
    include_type_hints: bool = True
    include_docstrings: bool = True
    simulation_default: bool = True
    read_only: bool = False
```

### GeneratedServer

Complete generated server.

```python
@dataclass
class GeneratedServer:
    files: List[GeneratedFile]
    output_dir: str
    server_name: str
    contract_address: str
    network: str
```

### GeneratedFile

Single generated file.

```python
@dataclass
class GeneratedFile:
    path: str      # Relative path
    content: str   # File content
```

---

## Templates

Templates use Jinja2 syntax and are located in `generator/templates/`.

### Custom Templates

Override default templates:

```python
from pathlib import Path
from abi_to_mcp.generator import MCPGenerator, GeneratorConfig

config = GeneratorConfig(
    template_dir=Path("./my-templates")
)

generator = MCPGenerator(config)
```

### Template Variables

Available in all templates:

| Variable | Type | Description |
|----------|------|-------------|
| `server_name` | `str` | Human-readable name |
| `contract_address` | `str` | Contract address |
| `network` | `str` | Network name |
| `chain_id` | `int` | Chain ID |
| `read_tools` | `List[MappedTool]` | Read-only tools |
| `write_tools` | `List[MappedTool]` | Write tools |
| `resources` | `List[MappedResource]` | Event resources |
| `detected_standard` | `Optional[str]` | ERC standard |

---

## Examples

### Generate Read-Only Server

```python
from abi_to_mcp.generator import MCPGenerator, GeneratorConfig

config = GeneratorConfig(read_only=True)
generator = MCPGenerator(config)

server = generator.generate(
    parsed=parsed_abi,
    tools=[t for t in tools if t.tool_type == "read"],
    resources=resources,
    contract_address="0x...",
    network="mainnet"
)
```

### Custom Code Generation

```python
from abi_to_mcp.generator import ToolGenerator
from jinja2 import Environment, FileSystemLoader

# Custom template
custom_template = """
@mcp.tool(name="{{ tool.name }}")
async def {{ tool.name }}({{ tool.python_signature }}):
    \"\"\"{{ tool.description }}\"\"\"
    # Custom implementation
    pass
"""

env = Environment()
env.from_string(custom_template)

tool_gen = ToolGenerator(env)
```

### Post-Processing

```python
import black

server = generator.generate(...)

# Format with Black
for file in server.files:
    if file.path.endswith(".py"):
        file.content = black.format_str(
            file.content,
            mode=black.Mode()
        )
```
