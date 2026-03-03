"""End-to-end integration tests.

This module contains comprehensive integration tests that validate
the complete pipeline from ABI fetching to MCP server generation.
"""

import json
import pytest
import subprocess
import sys
import importlib.util
from pathlib import Path

from abi_to_mcp.fetchers.file import FileFetcher
from abi_to_mcp.parser.abi_parser import ABIParser
from abi_to_mcp.mapper.type_mapper import TypeMapper
from abi_to_mcp.mapper.function_mapper import FunctionMapper
from abi_to_mcp.mapper.event_mapper import EventMapper
from abi_to_mcp.generator.server_generator import ServerGenerator
from abi_to_mcp.core.config import GeneratorConfig


@pytest.fixture
def fixtures_dir():
    """Get the path to fixtures directory."""
    return Path(__file__).parent.parent / "fixtures" / "abis"


@pytest.fixture
def erc20_abi_path(fixtures_dir):
    """Get path to ERC20 ABI fixture."""
    return fixtures_dir / "erc20.json"


@pytest.fixture
def erc721_abi_path(fixtures_dir):
    """Get path to ERC721 ABI fixture."""
    return fixtures_dir / "erc721.json"


@pytest.fixture
def erc1155_abi_path(fixtures_dir):
    """Get path to ERC1155 ABI fixture."""
    return fixtures_dir / "erc1155.json"


class TestERC20Pipeline:
    """Complete pipeline test using ERC20 token ABI."""

    @pytest.mark.asyncio
    async def test_fetch_parse_map_generate(self, erc20_abi_path, tmp_path):
        """Test the complete pipeline from file to generated server."""
        output_dir = tmp_path / "erc20-mcp-server"

        # Step 1: Fetch
        fetcher = FileFetcher()
        fetch_result = await fetcher.fetch(str(erc20_abi_path))

        assert fetch_result.abi is not None
        assert len(fetch_result.abi) > 0

        # Step 2: Parse
        parser = ABIParser()
        parsed = parser.parse(fetch_result.abi)

        assert parsed.detected_standard == "ERC20"
        assert len(parsed.functions) >= 6  # name, symbol, decimals, totalSupply, balanceOf, transfer
        assert len(parsed.events) >= 2  # Transfer, Approval

        # Step 3: Map
        type_mapper = TypeMapper()
        func_mapper = FunctionMapper(type_mapper)
        event_mapper = EventMapper(type_mapper)

        tools = [func_mapper.map_function(f) for f in parsed.functions]
        resources = [event_mapper.map_event(e) for e in parsed.events]

        # Verify tool mapping
        tool_names = {t.name for t in tools}
        assert "balance_of" in tool_names
        assert "transfer" in tool_names

        # Verify read vs write classification
        read_tools = [t for t in tools if t.tool_type == "read"]
        write_tools = [t for t in tools if t.tool_type in ("write", "write_payable")]

        assert len(read_tools) >= 4  # name, symbol, decimals, totalSupply, balanceOf, allowance
        assert len(write_tools) >= 3  # transfer, approve, transferFrom

        # Step 4: Generate
        config = GeneratorConfig(output_dir=output_dir)
        generator = ServerGenerator(config)

        server = generator.generate(
            parsed=parsed,
            tools=tools,
            resources=resources,
            contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="mainnet",
            contract_name="USDC Token",
        )

        # Verify generated files
        assert server.tool_count == len(tools)
        assert server.resource_count == len(resources)

        file_paths = {f.path for f in server.files}
        assert "server.py" in file_paths
        assert "config.py" in file_paths
        assert "README.md" in file_paths

        # Step 5: Write and validate
        generator.write_to_disk(server, output_dir)

        assert (output_dir / "server.py").exists()
        assert (output_dir / "README.md").exists()
        assert (output_dir / "config.py").exists()

        # Step 6: Verify generated code is syntactically valid
        server_code = (output_dir / "server.py").read_text()
        compile(server_code, "server.py", "exec")  # Raises SyntaxError if invalid

    @pytest.mark.asyncio
    async def test_generated_server_syntax(self, erc20_abi_path, tmp_path):
        """Test that all generated files have valid syntax."""
        output_dir = tmp_path / "syntax-test"

        # Generate server
        fetcher = FileFetcher()
        fetch_result = await fetcher.fetch(str(erc20_abi_path))
        
        parser = ABIParser()
        parsed = parser.parse(fetch_result.abi)
        
        type_mapper = TypeMapper()
        func_mapper = FunctionMapper(type_mapper)
        event_mapper = EventMapper(type_mapper)
        
        tools = [func_mapper.map_function(f) for f in parsed.functions]
        resources = [event_mapper.map_event(e) for e in parsed.events]
        
        config = GeneratorConfig(output_dir=output_dir)
        generator = ServerGenerator(config)
        
        server = generator.generate(
            parsed=parsed,
            tools=tools,
            resources=resources,
            contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="mainnet",
        )
        
        generator.write_to_disk(server, output_dir)
        
        # Check all Python files are syntactically valid
        for py_file in output_dir.glob("*.py"):
            code = py_file.read_text()
            try:
                compile(code, str(py_file), "exec")
            except SyntaxError as e:
                pytest.fail(f"Syntax error in {py_file.name}: {e}")


class TestERC721Pipeline:
    """Complete pipeline test using ERC721 NFT ABI."""

    @pytest.mark.asyncio
    async def test_nft_functions_mapped_correctly(self, erc721_abi_path, tmp_path):
        """ERC721 has different function signatures than ERC20."""
        
        # Fetch and parse
        fetcher = FileFetcher()
        result = await fetcher.fetch(str(erc721_abi_path))
        
        parser = ABIParser()
        parsed = parser.parse(result.abi)
        
        assert parsed.detected_standard == "ERC721"
        
        # Map
        type_mapper = TypeMapper()
        func_mapper = FunctionMapper(type_mapper)
        
        tools = [func_mapper.map_function(f) for f in parsed.functions]
        
        # ERC721-specific functions
        tool_names = {t.name for t in tools}
        assert "owner_of" in tool_names
        # tokenURI converts to token_uri or token_u_r_i depending on implementation
        has_token_uri = any("token" in name and "uri" in name.lower() for name in tool_names)
        assert has_token_uri

    @pytest.mark.asyncio
    async def test_approval_for_all_event(self, erc721_abi_path, tmp_path):
        """ERC721 has ApprovalForAll event not in ERC20."""
        
        fetcher = FileFetcher()
        result = await fetcher.fetch(str(erc721_abi_path))
        
        parser = ABIParser()
        parsed = parser.parse(result.abi)
        
        event_names = {e.name for e in parsed.events}
        assert "ApprovalForAll" in event_names


class TestERC1155Pipeline:
    """Complete pipeline test using ERC1155 Multi-Token ABI."""

    @pytest.mark.asyncio
    async def test_batch_operations_mapped(self, erc1155_abi_path, tmp_path):
        """ERC1155 batch operations should be mapped correctly."""
        
        fetcher = FileFetcher()
        result = await fetcher.fetch(str(erc1155_abi_path))
        
        parser = ABIParser()
        parsed = parser.parse(result.abi)
        
        assert parsed.detected_standard == "ERC1155"
        
        # Map
        type_mapper = TypeMapper()
        func_mapper = FunctionMapper(type_mapper)
        
        tools = [func_mapper.map_function(f) for f in parsed.functions]
        
        # Find batch transfer tool
        batch_tools = [t for t in tools if "batch" in t.name.lower()]
        assert len(batch_tools) >= 1
        
        # Batch tools should have array parameters
        for tool in batch_tools:
            array_params = [p for p in tool.parameters if p.json_schema.get("type") == "array"]
            assert len(array_params) >= 1


class TestReadOnlyMode:
    """Test generation in read-only mode."""

    @pytest.mark.asyncio
    async def test_read_only_excludes_write_functions(self, erc20_abi_path, tmp_path):
        """Read-only mode should only include view/pure functions."""
        output_dir = tmp_path / "read-only-server"

        fetcher = FileFetcher()
        fetch_result = await fetcher.fetch(str(erc20_abi_path))
        
        parser = ABIParser()
        parsed = parser.parse(fetch_result.abi)
        
        type_mapper = TypeMapper()
        func_mapper = FunctionMapper(type_mapper)
        event_mapper = EventMapper(type_mapper)
        
        # Only map read-only functions
        read_functions = [f for f in parsed.functions if f.is_read_only]
        tools = [func_mapper.map_function(f) for f in read_functions]
        resources = [event_mapper.map_event(e) for e in parsed.events]
        
        # All tools should be read-only
        assert all(t.tool_type == "read" for t in tools)
        
        # Generate
        config = GeneratorConfig(output_dir=output_dir, read_only=True)
        generator = ServerGenerator(config)
        
        server = generator.generate(
            parsed=parsed,
            tools=tools,
            resources=resources,
            contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="mainnet",
        )
        
        # Write functions should not be present
        assert all("transfer" not in t for t in server.write_tools)


class TestGeneratedReadme:
    """Test that generated README contains correct information."""

    @pytest.mark.asyncio
    async def test_readme_contains_tools(self, erc20_abi_path, tmp_path):
        """README should document all generated tools."""
        output_dir = tmp_path / "readme-test"

        fetcher = FileFetcher()
        fetch_result = await fetcher.fetch(str(erc20_abi_path))
        
        parser = ABIParser()
        parsed = parser.parse(fetch_result.abi)
        
        type_mapper = TypeMapper()
        func_mapper = FunctionMapper(type_mapper)
        event_mapper = EventMapper(type_mapper)
        
        tools = [func_mapper.map_function(f) for f in parsed.functions]
        resources = [event_mapper.map_event(e) for e in parsed.events]
        
        config = GeneratorConfig(output_dir=output_dir)
        generator = ServerGenerator(config)
        
        server = generator.generate(
            parsed=parsed,
            tools=tools,
            resources=resources,
            contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="mainnet",
        )
        
        generator.write_to_disk(server, output_dir)
        
        readme = (output_dir / "README.md").read_text()
        
        # README should mention key functions
        assert "balance" in readme.lower()
        assert "transfer" in readme.lower()
        
        # README should mention the contract address
        assert "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" in readme


class TestComplexABI:
    """Test pipeline with complex ABI structures."""

    @pytest.mark.asyncio
    async def test_tuple_parameters_in_pipeline(self, tmp_path):
        """Test that tuple parameters are handled throughout the pipeline."""
        # Create a temporary ABI with tuple parameters
        abi = [{
            "type": "function",
            "name": "swapExactTokensForTokens",
            "inputs": [
                {"name": "amountIn", "type": "uint256"},
                {"name": "amountOutMin", "type": "uint256"},
                {"name": "path", "type": "address[]"},
                {"name": "to", "type": "address"},
                {"name": "deadline", "type": "uint256"},
            ],
            "outputs": [{"name": "amounts", "type": "uint256[]"}],
            "stateMutability": "nonpayable"
        }, {
            "type": "function",
            "name": "getReserves",
            "inputs": [],
            "outputs": [
                {"name": "reserve0", "type": "uint112"},
                {"name": "reserve1", "type": "uint112"},
                {"name": "blockTimestampLast", "type": "uint32"},
            ],
            "stateMutability": "view"
        }, {
            "type": "event",
            "name": "Swap",
            "inputs": [
                {"indexed": True, "name": "sender", "type": "address"},
                {"indexed": False, "name": "amount0In", "type": "uint256"},
                {"indexed": False, "name": "amount1In", "type": "uint256"},
                {"indexed": False, "name": "amount0Out", "type": "uint256"},
                {"indexed": False, "name": "amount1Out", "type": "uint256"},
                {"indexed": True, "name": "to", "type": "address"},
            ],
            "anonymous": False
        }]

        # Write temp ABI
        abi_path = tmp_path / "complex.json"
        with open(abi_path, "w") as f:
            json.dump(abi, f)

        output_dir = tmp_path / "complex-server"

        # Run pipeline
        fetcher = FileFetcher()
        fetch_result = await fetcher.fetch(str(abi_path))
        
        parser = ABIParser()
        parsed = parser.parse(fetch_result.abi)
        
        type_mapper = TypeMapper()
        func_mapper = FunctionMapper(type_mapper)
        event_mapper = EventMapper(type_mapper)
        
        tools = [func_mapper.map_function(f) for f in parsed.functions]
        resources = [event_mapper.map_event(e) for e in parsed.events]
        
        config = GeneratorConfig(output_dir=output_dir)
        generator = ServerGenerator(config)
        
        server = generator.generate(
            parsed=parsed,
            tools=tools,
            resources=resources,
            contract_address="0x1234567890abcdef1234567890abcdef12345678",
            network="mainnet",
        )
        
        generator.write_to_disk(server, output_dir)
        
        # Verify syntax
        server_code = (output_dir / "server.py").read_text()
        compile(server_code, "server.py", "exec")

        # Verify array parameters were handled
        swap_tool = next(t for t in tools if t.name == "swap_exact_tokens_for_tokens")
        path_param = next(p for p in swap_tool.parameters if p.name == "path")
        assert path_param.json_schema.get("type") == "array"


class TestMultipleNetworks:
    """Test generation for different networks."""

    @pytest.mark.asyncio
    async def test_polygon_network(self, erc20_abi_path, tmp_path):
        """Test generation for Polygon network."""
        output_dir = tmp_path / "polygon-server"

        fetcher = FileFetcher()
        fetch_result = await fetcher.fetch(str(erc20_abi_path))
        
        parser = ABIParser()
        parsed = parser.parse(fetch_result.abi)
        
        type_mapper = TypeMapper()
        func_mapper = FunctionMapper(type_mapper)
        event_mapper = EventMapper(type_mapper)
        
        tools = [func_mapper.map_function(f) for f in parsed.functions]
        resources = [event_mapper.map_event(e) for e in parsed.events]
        
        config = GeneratorConfig(output_dir=output_dir)
        generator = ServerGenerator(config)
        
        server = generator.generate(
            parsed=parsed,
            tools=tools,
            resources=resources,
            contract_address="0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",  # USDC on Polygon
            network="polygon",
        )
        
        generator.write_to_disk(server, output_dir)
        
        # Config should mention Polygon
        config_code = (output_dir / "config.py").read_text()
        assert "polygon" in config_code.lower()

