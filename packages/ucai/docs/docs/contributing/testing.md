---
title: Testing Guide
description: Writing and running tests for abi-to-mcp
---

# Testing Guide

This guide covers how to write and run tests for abi-to-mcp.

## Running Tests

### All Tests

```bash
# Using Make
make test

# Using pytest directly
pytest

# With verbose output
pytest -v
```

### Specific Tests

```bash
# Run a specific test file
pytest tests/unit/test_parser/test_abi_parser.py

# Run a specific test
pytest tests/unit/test_parser/test_abi_parser.py::test_parse_erc20

# Run tests matching a pattern
pytest -k "test_parse"

# Run only unit tests
pytest tests/unit/

# Run only integration tests
pytest tests/integration/
```

### Coverage

```bash
# Run with coverage
make coverage

# Or directly
pytest --cov=abi_to_mcp --cov-report=html

# View report
open htmlcov/index.html
```

## Test Structure

```
tests/
├── conftest.py              # Shared fixtures
├── unit/                    # Unit tests
│   ├── test_parser/
│   │   ├── test_abi_parser.py
│   │   ├── test_function_parser.py
│   │   ├── test_event_parser.py
│   │   └── test_type_parser.py
│   ├── test_mapper/
│   │   ├── test_type_mapper.py
│   │   ├── test_function_mapper.py
│   │   └── test_schema_builder.py
│   ├── test_fetchers/
│   │   ├── test_file.py
│   │   ├── test_etherscan.py
│   │   └── test_sourcify.py
│   └── test_generator/
│       ├── test_tool_generator.py
│       └── test_server_generator.py
├── integration/             # Integration tests
│   ├── test_cli.py
│   ├── test_end_to_end.py
│   └── test_generated_server.py
└── fixtures/                # Test data
    └── abis/
        ├── erc20.json
        ├── erc721.json
        └── uniswap_router.json
```

## Writing Tests

### Unit Tests

Test individual functions/methods in isolation:

```python
# tests/unit/test_parser/test_type_parser.py
import pytest
from abi_to_mcp.parser import TypeParser


class TestTypeParser:
    """Tests for TypeParser."""
    
    def test_parse_simple_type(self):
        """Parse a simple type string."""
        parser = TypeParser()
        result = parser.parse("uint256")
        
        assert result.base_type == "uint256"
        assert result.is_array is False
    
    def test_parse_array_type(self):
        """Parse an array type."""
        parser = TypeParser()
        result = parser.parse("address[]")
        
        assert result.base_type == "address"
        assert result.is_array is True
        assert result.array_size is None
    
    def test_parse_fixed_array(self):
        """Parse a fixed-size array."""
        parser = TypeParser()
        result = parser.parse("bytes32[10]")
        
        assert result.array_size == 10
    
    @pytest.mark.parametrize("type_str,expected_base", [
        ("uint8", "uint8"),
        ("int256", "int256"),
        ("address", "address"),
        ("bool", "bool"),
        ("bytes", "bytes"),
        ("string", "string"),
    ])
    def test_parse_base_types(self, type_str, expected_base):
        """Parse various base types."""
        parser = TypeParser()
        result = parser.parse(type_str)
        assert result.base_type == expected_base
```

### Fixtures

Use pytest fixtures for shared setup:

```python
# tests/conftest.py
import pytest
import json
from pathlib import Path


@pytest.fixture
def erc20_abi():
    """Load ERC20 ABI fixture."""
    path = Path(__file__).parent / "fixtures/abis/erc20.json"
    with open(path) as f:
        return json.load(f)


@pytest.fixture
def parser():
    """Create a fresh ABIParser."""
    from abi_to_mcp.parser import ABIParser
    return ABIParser()


@pytest.fixture
def parsed_erc20(parser, erc20_abi):
    """Parse ERC20 ABI."""
    return parser.parse(erc20_abi)
```

Using fixtures:

```python
def test_erc20_detection(parsed_erc20):
    """ERC20 standard should be detected."""
    assert parsed_erc20.detected_standard == "ERC20"


def test_erc20_has_transfer(parsed_erc20):
    """ERC20 should have transfer function."""
    names = [f.name for f in parsed_erc20.functions]
    assert "transfer" in names
```

### Async Tests

Use `pytest-asyncio` for async tests:

```python
import pytest


@pytest.mark.asyncio
async def test_fetch_from_file():
    """Test fetching ABI from file."""
    from abi_to_mcp.fetchers import FileFetcher
    
    fetcher = FileFetcher()
    result = await fetcher.fetch("tests/fixtures/abis/erc20.json")
    
    assert result.source == "file"
    assert len(result.abi) > 0
```

### Mocking External Services

Mock external APIs to avoid network calls:

```python
import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_etherscan_fetch():
    """Test Etherscan fetcher with mocked response."""
    from abi_to_mcp.fetchers import EtherscanFetcher
    
    mock_response = {
        "status": "1",
        "message": "OK",
        "result": '[{"type":"function","name":"balanceOf"...}]'
    }
    
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value.json.return_value = mock_response
        mock_get.return_value.status_code = 200
        
        fetcher = EtherscanFetcher(api_key="test-key")
        result = await fetcher.fetch("0x...", network="mainnet")
        
        assert result.source == "etherscan"
```

### Integration Tests

Test components working together:

```python
# tests/integration/test_end_to_end.py
import pytest
from pathlib import Path


@pytest.mark.asyncio
async def test_full_pipeline():
    """Test the complete generation pipeline."""
    from abi_to_mcp.fetchers import create_default_registry
    from abi_to_mcp.parser import ABIParser
    from abi_to_mcp.mapper import TypeMapper, FunctionMapper
    from abi_to_mcp.generator import MCPGenerator
    
    # Fetch
    registry = create_default_registry()
    result = await registry.fetch("tests/fixtures/abis/erc20.json")
    
    # Parse
    parser = ABIParser()
    parsed = parser.parse(result.abi)
    
    # Map
    type_mapper = TypeMapper()
    func_mapper = FunctionMapper(type_mapper)
    tools = [func_mapper.map_function(f) for f in parsed.functions]
    
    # Generate
    generator = MCPGenerator()
    server = generator.generate(
        parsed=parsed,
        tools=tools,
        resources=[],
        contract_address="0x1234567890123456789012345678901234567890",
        network="mainnet",
    )
    
    # Verify
    assert any(f.path == "server.py" for f in server.files)
    
    # Check generated code is valid Python
    server_py = next(f for f in server.files if f.path == "server.py")
    compile(server_py.content, "server.py", "exec")
```

### CLI Tests

Test CLI commands using Typer's test runner:

```python
# tests/integration/test_cli.py
from typer.testing import CliRunner
from abi_to_mcp.cli.main import app

runner = CliRunner()


def test_generate_help():
    """Test generate command help."""
    result = runner.invoke(app, ["generate", "--help"])
    
    assert result.exit_code == 0
    assert "Generate an MCP server" in result.stdout


def test_generate_from_file(tmp_path):
    """Test generating from a local file."""
    output = tmp_path / "output"
    
    result = runner.invoke(app, [
        "generate",
        "tests/fixtures/abis/erc20.json",
        "--output", str(output),
        "--address", "0x1234567890123456789012345678901234567890",
    ])
    
    assert result.exit_code == 0
    assert (output / "server.py").exists()


def test_validate_valid_abi():
    """Test validating a valid ABI."""
    result = runner.invoke(app, [
        "validate",
        "tests/fixtures/abis/erc20.json",
    ])
    
    assert result.exit_code == 0
    assert "valid" in result.stdout.lower()
```

## Best Practices

### 1. One Assertion Per Concept

```python
# Good: Clear what failed
def test_transfer_function_properties():
    transfer = get_transfer_function()
    
    assert transfer.name == "transfer"
    assert len(transfer.inputs) == 2
    assert transfer.state_mutability == StateMutability.NONPAYABLE

# Avoid: Too many unrelated assertions
def test_everything():
    assert this
    assert that
    assert something_else
    assert another_thing
```

### 2. Use Descriptive Names

```python
# Good
def test_parse_nested_tuple_with_array_component():
    ...

# Avoid
def test_1():
    ...
```

### 3. Test Edge Cases

```python
def test_empty_abi():
    """Empty ABI should parse to empty ParsedABI."""
    parser = ABIParser()
    result = parser.parse([])
    
    assert result.functions == []
    assert result.events == []


def test_abi_with_only_constructor():
    """ABI with only constructor should work."""
    abi = [{"type": "constructor", "inputs": []}]
    parser = ABIParser()
    result = parser.parse(abi)
    
    assert result.has_constructor is True
    assert result.functions == []
```

### 4. Use Fixtures for DRY

```python
# Define once in conftest.py
@pytest.fixture
def type_mapper():
    return TypeMapper()

# Use everywhere
def test_map_address(type_mapper):
    schema = type_mapper.to_json_schema(...)
```

### 5. Mark Slow Tests

```python
@pytest.mark.slow
def test_large_abi_parsing():
    """This test takes a while."""
    ...

# Run fast tests only
# pytest -m "not slow"
```

## Test Coverage Goals

| Module | Target Coverage |
|--------|-----------------|
| Parser | 95% |
| Mapper | 95% |
| Generator | 90% |
| Fetchers | 85% (external calls mocked) |
| CLI | 80% |
| Runtime | 85% |

Check coverage:

```bash
make coverage
```
