---
title: CLI Internals
description: Command-line interface architecture and implementation
---

# CLI Internals

This page documents the CLI module architecture for contributors. For user-facing documentation, see the [CLI Reference](../cli/index.md).

---

## Module Structure

```
cli/
├── __init__.py       # CLI exports
├── main.py           # Typer app and command definitions
└── commands/
    ├── __init__.py   # Command exports
    ├── generate.py   # Generate command implementation
    ├── inspect.py    # Inspect command implementation
    ├── validate.py   # Validate command implementation
    └── serve.py      # Serve command implementation
```

---

## CLI Application

The CLI is built with [Typer](https://typer.tiangolo.com/), a modern CLI framework built on Click with type hints and auto-completion.

### Entry Point

```python
# src/abi_to_mcp/cli/main.py
import typer

app = typer.Typer(
    name="abi-to-mcp",
    help="UCAI - The ABI-to-MCP Server Generator",
    add_completion=False,
    no_args_is_help=True,
)
```

### Registration

Commands are registered in `pyproject.toml`:

```toml
[project.scripts]
abi-to-mcp = "abi_to_mcp.cli.main:main"
```

---

## Commands

### Generate Command

The main command that orchestrates the full generation pipeline.

**File:** `cli/commands/generate.py`

```python
@app.command()
def generate(
    source: str,          # ABI source (file or address)
    output: Path,         # Output directory
    network: str,         # Network name
    address: str,         # Contract address
    name: str,            # Server name
    read_only: bool,      # Read-only mode
    include_events: bool, # Include event resources
    simulation_default: bool,  # Default simulation mode
    force: bool,          # Overwrite existing
):
    """Generate an MCP server from a smart contract ABI."""
```

#### Pipeline Steps

1. **Fetch ABI** - Uses fetcher registry
2. **Parse ABI** - Extracts functions and events
3. **Map to MCP** - Converts to tools and resources
4. **Generate Code** - Renders templates
5. **Write Files** - Outputs to disk

#### Implementation

```python
async def _generate_async(source, output, network, ...):
    # Step 1: Fetch
    registry = create_default_registry()
    
    if is_valid_address(source):
        fetch_result = await registry.fetch(source, network=network)
    else:
        fetch_result = await registry.fetch(source)
    
    # Step 2: Parse
    parser = ABIParser()
    parsed = parser.parse(fetch_result.abi)
    
    # Step 3: Map
    type_mapper = TypeMapper()
    func_mapper = FunctionMapper(type_mapper)
    event_mapper = EventMapper(type_mapper)
    
    tools = [func_mapper.map_function(f) for f in parsed.functions]
    resources = [event_mapper.map_event(e) for e in parsed.events]
    
    # Step 4: Generate
    generator = MCPGenerator()
    server = generator.generate(parsed=parsed, tools=tools, ...)
    
    # Step 5: Write
    for file in server.files:
        (output / file.path).write_text(file.content)
```

---

### Inspect Command

Analyzes an ABI without generating files.

**File:** `cli/commands/inspect.py`

```python
@app.command()
def inspect(
    source: str,    # ABI source
    network: str,   # Network for lookups
):
    """Inspect an ABI and show what would be generated."""
```

#### Output

- Detected ERC standard
- Function count (read/write)
- Event count
- Error count
- Constructor info
- Estimated tool count

---

### Validate Command

Validates ABI structure without processing.

**File:** `cli/commands/validate.py`

```python
@app.command()
def validate(
    source: str,    # ABI file path
    strict: bool,   # Strict validation
):
    """Validate an ABI without generating."""
```

#### Validation Checks

| Check | Description |
|-------|-------------|
| JSON Structure | Valid JSON syntax |
| ABI Format | Array of entry objects |
| Entry Types | Valid function/event/error types |
| Type Recognition | All Solidity types recognized |
| **Strict Only** | |
| Duplicates | No duplicate function names |
| Named Params | All parameters named |
| Return Types | Functions have return types |

---

### Serve Command

Runs a generated MCP server.

**File:** `cli/commands/serve.py`

```python
@app.command()
def serve(
    directory: Path,    # Server directory
    port: int,          # HTTP port
    transport: str,     # Transport mode
):
    """Run a generated MCP server."""
```

#### Transport Modes

| Mode | Description |
|------|-------------|
| `stdio` | Standard I/O (default, for Claude Desktop) |
| `http` | HTTP server on specified port |

---

### Networks Command

Lists all supported networks.

```python
@app.command()
def networks():
    """List all supported networks."""
```

#### Output Table

| Network ID | Name | Chain ID | Explorer |
|------------|------|----------|----------|
| mainnet | Ethereum Mainnet | 1 | etherscan.io |
| polygon | Polygon Mainnet | 137 | polygonscan.com |
| ... | ... | ... | ... |

---

## Rich Output

The CLI uses [Rich](https://rich.readthedocs.io/) for enhanced terminal output.

### Console

```python
from rich.console import Console

console = Console()
console.print("[bold green]Success![/bold green]")
```

### Progress Indicators

```python
from rich.progress import Progress, SpinnerColumn, TextColumn

with Progress(
    SpinnerColumn(),
    TextColumn("[progress.description]{task.description}"),
) as progress:
    task = progress.add_task("Processing...", total=None)
    # ... do work ...
    progress.update(task, description="✓ Complete")
```

### Tables

```python
from rich.table import Table

table = Table(title="Results")
table.add_column("Name", style="cyan")
table.add_column("Type", style="green")
table.add_row("transfer", "write")
console.print(table)
```

---

## Error Handling

### Custom Exceptions

```python
from abi_to_mcp.core.exceptions import ABIToMCPError

try:
    # CLI operation
except ABIToMCPError as e:
    rprint(f"[bold red]Error:[/bold red] {e.message}")
    raise SystemExit(1)
except Exception as e:
    rprint(f"[bold red]Unexpected error:[/bold red] {e}")
    raise SystemExit(1)
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Runtime error |
| 2 | Invalid arguments (Typer) |

---

## Testing CLI

### Unit Tests

Test individual command functions:

```python
# tests/unit/test_cli/test_generate.py
from abi_to_mcp.cli.commands.generate import generate

def test_generate_from_file(tmp_path, sample_abi_file):
    generate(
        source=str(sample_abi_file),
        output=tmp_path / "output",
        network="mainnet",
        contract_address="0x...",
        name="Test",
        read_only=False,
        include_events=True,
        simulation_default=True,
    )
    
    assert (tmp_path / "output" / "server.py").exists()
```

### Integration Tests

Test full CLI invocation:

```python
# tests/integration/test_cli.py
from typer.testing import CliRunner
from abi_to_mcp.cli.main import app

runner = CliRunner()

def test_version():
    result = runner.invoke(app, ["--version"])
    assert result.exit_code == 0
    assert "UCAI" in result.stdout

def test_generate_from_file(sample_abi_file, tmp_path):
    result = runner.invoke(app, [
        "generate",
        str(sample_abi_file),
        "-a", "0x1234...",
        "-o", str(tmp_path / "output"),
    ])
    assert result.exit_code == 0
```

---

## Adding New Commands

1. **Create command file:**

```python
# src/abi_to_mcp/cli/commands/new_command.py
from rich.console import Console

console = Console()

def new_command(arg1: str, option1: bool) -> None:
    """Implementation of new command."""
    console.print(f"Running with {arg1}")
```

2. **Register in main.py:**

```python
@app.command()
def new_command(
    arg1: str = typer.Argument(..., help="Description"),
    option1: bool = typer.Option(False, "--flag", help="Flag"),
):
    """
    New command description.
    
    EXAMPLES:
        abi-to-mcp new-command foo --flag
    """
    from abi_to_mcp.cli.commands import new_command as cmd_new

    cmd_new(arg1=arg1, option1=option1)
```

3. **Export in commands/__init__.py:**

```python
from .new_command import new_command
```

4. **Add documentation** in `docs/docs/cli/new_command.md`

5. **Add tests** in `tests/unit/test_cli/test_new_command.py`

---

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ETHERSCAN_API_KEY` | Etherscan API key |
| `POLYGONSCAN_API_KEY` | Polygonscan API key |
| `ARBISCAN_API_KEY` | Arbiscan API key |
| `NO_COLOR` | Disable colored output |
| `ABI_TO_MCP_LOG_LEVEL` | Log level (DEBUG, INFO, etc.) |

### Config Files

UCAI searches for config files in order:

1. `./abi-to-mcp.toml`
2. `./abi-to-mcp.json`
3. `~/.config/abi-to-mcp/config.toml`

---

## Best Practices

1. **Use async where beneficial** - Network operations are async
2. **Show progress** - Long operations should show spinners
3. **Provide examples** - Include EXAMPLES in docstrings
4. **Validate early** - Check inputs before processing
5. **Exit cleanly** - Use proper exit codes
6. **Test thoroughly** - Both unit and integration tests
---

## Auto-Generated API Reference

The following sections are automatically generated from source code docstrings using mkdocstrings.

### CLI Main Module

::: abi_to_mcp.cli.main
    options:
      show_root_heading: true
      show_source: false
      members_order: source
      heading_level: 4
      show_if_no_docstring: false

### CLI Utils Module

::: abi_to_mcp.cli.utils
    options:
      show_root_heading: true
      show_source: false
      members_order: source
      heading_level: 4
      show_if_no_docstring: false