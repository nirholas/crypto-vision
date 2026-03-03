"""Tests for generated MCP servers."""

import pytest
from pathlib import Path

from abi_to_mcp.fetchers.file import FileFetcher
from abi_to_mcp.parser.abi_parser import ABIParser
from abi_to_mcp.mapper.type_mapper import TypeMapper
from abi_to_mcp.mapper.function_mapper import FunctionMapper
from abi_to_mcp.mapper.event_mapper import EventMapper
from abi_to_mcp.generator.server_generator import ServerGenerator
from abi_to_mcp.core.config import GeneratorConfig


@pytest.fixture
def erc20_abi_path():
    """Get path to ERC20 ABI fixture."""
    return Path(__file__).parent.parent / "fixtures" / "abis" / "erc20.json"


@pytest.fixture
def erc721_abi_path():
    """Get path to ERC721 ABI fixture."""
    return Path(__file__).parent.parent / "fixtures" / "abis" / "erc721.json"


@pytest.fixture
async def generated_server(erc20_abi_path, tmp_path):
    """Generate an ERC20 server for testing."""
    output_dir = tmp_path / "test-server"

    # Fetch and parse
    fetcher = FileFetcher()
    result = await fetcher.fetch(str(erc20_abi_path))
    parser = ABIParser()
    parsed = parser.parse(result.abi)

    # Map
    type_mapper = TypeMapper()
    func_mapper = FunctionMapper(type_mapper)
    event_mapper = EventMapper(type_mapper)
    tools = [func_mapper.map_function(f) for f in parsed.functions]
    resources = [event_mapper.map_event(e) for e in parsed.events]

    # Generate
    config = GeneratorConfig(output_dir=output_dir)
    generator = ServerGenerator(config)
    server = generator.generate(
        parsed=parsed,
        tools=tools,
        resources=resources,
        contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        network="mainnet",
        contract_name="Test Token",
    )
    generator.write_to_disk(server, output_dir)

    return output_dir


@pytest.fixture
async def generated_nft_server(erc721_abi_path, tmp_path):
    """Generate an ERC721 server for testing."""
    output_dir = tmp_path / "nft-server"

    # Fetch and parse
    fetcher = FileFetcher()
    result = await fetcher.fetch(str(erc721_abi_path))
    parser = ABIParser()
    parsed = parser.parse(result.abi)

    # Map
    type_mapper = TypeMapper()
    func_mapper = FunctionMapper(type_mapper)
    event_mapper = EventMapper(type_mapper)
    tools = [func_mapper.map_function(f) for f in parsed.functions]
    resources = [event_mapper.map_event(e) for e in parsed.events]

    # Generate
    config = GeneratorConfig(output_dir=output_dir)
    generator = ServerGenerator(config)
    server = generator.generate(
        parsed=parsed,
        tools=tools,
        resources=resources,
        contract_address="0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
        network="mainnet",
        contract_name="Test NFT",
    )
    generator.write_to_disk(server, output_dir)

    return output_dir


@pytest.mark.integration
class TestGeneratedServer:
    """Tests for generated MCP server files."""

    @pytest.mark.asyncio
    async def test_generated_server_syntax_valid(self, generated_server):
        """Generated server.py should be syntactically valid Python."""
        server_py = generated_server / "server.py"
        assert server_py.exists(), "server.py should exist"

        code = server_py.read_text()
        # This will raise SyntaxError if the code is invalid
        compile(code, "server.py", "exec")

    @pytest.mark.asyncio
    async def test_generated_server_has_all_tools(self, generated_server):
        """Generated server should have tools for all ABI functions."""
        server_py = generated_server / "server.py"
        code = server_py.read_text()
        code_lower = code.lower()

        # ERC20 functions that should be present
        expected_functions = [
            "balance_of",
            "transfer",
            "approve",
            "allowance",
            "transfer_from",
            "total_supply",
            "name",
            "symbol",
            "decimals",
        ]

        for func in expected_functions:
            # Check both snake_case and original camelCase
            assert func in code_lower or func.replace("_", "") in code_lower, \
                f"Missing tool for {func}"

    @pytest.mark.asyncio
    async def test_generated_server_has_all_resources(self, generated_server):
        """Generated server should have resources for all ABI events."""
        server_py = generated_server / "server.py"
        code = server_py.read_text()
        code_lower = code.lower()

        # ERC20 events
        assert "transfer" in code_lower, "Should have Transfer event"
        assert "approval" in code_lower, "Should have Approval event"

    @pytest.mark.asyncio
    async def test_generated_readme_content(self, generated_server):
        """Generated README should have correct content."""
        readme = generated_server / "README.md"
        assert readme.exists(), "README.md should exist"

        content = readme.read_text()
        content_lower = content.lower()

        # Should contain server name or reference to token
        assert "test" in content_lower or "token" in content_lower, \
            "README should mention the contract name"

        # Should contain contract address
        assert "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48".lower() in content_lower, \
            "README should contain the contract address"

        # Should mention the network
        assert "mainnet" in content_lower, "README should mention the network"

    @pytest.mark.asyncio
    async def test_generated_requirements_valid(self, generated_server):
        """Generated requirements.txt should be valid."""
        requirements = generated_server / "requirements.txt"
        assert requirements.exists(), "requirements.txt should exist"

        content = requirements.read_text()
        content_lower = content.lower()

        # Should have essential dependencies
        assert "web3" in content_lower, "Should require web3"
        # MCP library (could be mcp, fastmcp, or similar)
        has_mcp = "mcp" in content_lower or "fastmcp" in content_lower
        assert has_mcp, "Should require MCP library"

    @pytest.mark.asyncio
    async def test_generated_config_valid(self, generated_server):
        """Generated config.py should be syntactically valid if it exists."""
        config_py = generated_server / "config.py"
        if config_py.exists():
            code = config_py.read_text()
            # This will raise SyntaxError if the code is invalid
            compile(code, "config.py", "exec")

    @pytest.mark.asyncio
    async def test_generated_server_has_essential_imports(self, generated_server):
        """Generated server should have essential imports."""
        server_py = generated_server / "server.py"
        code = server_py.read_text()

        # Should import from web3 or have web3 reference
        assert "web3" in code.lower() or "Web3" in code, \
            "Server should reference web3"

    @pytest.mark.asyncio
    async def test_nft_server_has_owner_of(self, generated_nft_server):
        """Generated NFT server should have ownerOf function."""
        server_py = generated_nft_server / "server.py"
        code = server_py.read_text()
        code_lower = code.lower()

        # ERC721 specific functions
        assert "owner_of" in code_lower or "ownerof" in code_lower, \
            "NFT server should have ownerOf"
        assert "token_uri" in code_lower or "tokenuri" in code_lower, \
            "NFT server should have tokenURI"

    @pytest.mark.asyncio
    async def test_nft_server_has_approval_for_all_event(self, generated_nft_server):
        """Generated NFT server should have ApprovalForAll event."""
        server_py = generated_nft_server / "server.py"
        code = server_py.read_text()
        code_lower = code.lower()

        assert "approvalforall" in code_lower or "approval_for_all" in code_lower, \
            "NFT server should have ApprovalForAll event"


@pytest.mark.integration
class TestGeneratedServerStructure:
    """Tests for generated server file structure."""

    @pytest.mark.asyncio
    async def test_all_expected_files_exist(self, generated_server):
        """Generated server should have all expected files."""
        expected_files = ["server.py", "README.md", "requirements.txt"]

        for filename in expected_files:
            path = generated_server / filename
            assert path.exists(), f"{filename} should exist"

    @pytest.mark.asyncio
    async def test_no_syntax_errors_in_all_py_files(self, generated_server):
        """All generated Python files should be syntactically valid."""
        for py_file in generated_server.glob("*.py"):
            code = py_file.read_text()
            try:
                compile(code, str(py_file), "exec")
            except SyntaxError as e:
                pytest.fail(f"Syntax error in {py_file.name}: {e}")

    @pytest.mark.asyncio
    async def test_server_file_not_empty(self, generated_server):
        """server.py should not be empty."""
        server_py = generated_server / "server.py"
        content = server_py.read_text()

        assert len(content) > 100, "server.py should have substantial content"
        assert "def " in content or "async def " in content, \
            "server.py should contain function definitions"
