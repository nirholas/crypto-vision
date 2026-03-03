"""Unit tests for ServerGenerator."""

import pytest
import json
from pathlib import Path
import tempfile

from abi_to_mcp.core.config import GeneratorConfig
from abi_to_mcp.core.models import (
    ParsedABI,
    ABIFunction,
    ABIEvent,
    ABIParameter,
    MappedTool,
    MappedResource,
    ToolParameter,
    ResourceField,
    StateMutability,
)
from abi_to_mcp.generator.server_generator import ServerGenerator


@pytest.fixture
def generator_config():
    """Create a test generator configuration."""
    return GeneratorConfig(
        output_dir=Path(tempfile.mkdtemp()),
        simulation_default=True,
        read_only=False,
        include_events=True,
        include_utilities=True,
    )


@pytest.fixture
def server_generator(generator_config):
    """Create a ServerGenerator instance."""
    return ServerGenerator(generator_config)


@pytest.fixture
def sample_parsed_abi():
    """Create a sample ParsedABI for testing."""
    return ParsedABI(
        functions=[
            ABIFunction(
                name="name",
                inputs=[],
                outputs=[ABIParameter(name="", type="string")],
                state_mutability=StateMutability.VIEW,
            ),
            ABIFunction(
                name="symbol",
                inputs=[],
                outputs=[ABIParameter(name="", type="string")],
                state_mutability=StateMutability.VIEW,
            ),
            ABIFunction(
                name="balanceOf",
                inputs=[ABIParameter(name="account", type="address")],
                outputs=[ABIParameter(name="", type="uint256")],
                state_mutability=StateMutability.VIEW,
            ),
            ABIFunction(
                name="transfer",
                inputs=[
                    ABIParameter(name="to", type="address"),
                    ABIParameter(name="amount", type="uint256"),
                ],
                outputs=[ABIParameter(name="", type="bool")],
                state_mutability=StateMutability.NONPAYABLE,
            ),
        ],
        events=[
            ABIEvent(
                name="Transfer",
                inputs=[
                    ABIParameter(name="from", type="address", indexed=True),
                    ABIParameter(name="to", type="address", indexed=True),
                    ABIParameter(name="value", type="uint256", indexed=False),
                ],
            ),
        ],
        errors=[],
        raw_abi=[
            {"type": "function", "name": "name", "inputs": [], "outputs": [{"type": "string"}], "stateMutability": "view"},
            {"type": "function", "name": "symbol", "inputs": [], "outputs": [{"type": "string"}], "stateMutability": "view"},
            {"type": "function", "name": "balanceOf", "inputs": [{"name": "account", "type": "address"}], "outputs": [{"type": "uint256"}], "stateMutability": "view"},
            {"type": "function", "name": "transfer", "inputs": [{"name": "to", "type": "address"}, {"name": "amount", "type": "uint256"}], "outputs": [{"type": "bool"}], "stateMutability": "nonpayable"},
            {"type": "event", "name": "Transfer", "inputs": [{"name": "from", "type": "address", "indexed": True}, {"name": "to", "type": "address", "indexed": True}, {"name": "value", "type": "uint256"}]},
        ],
        detected_standard="ERC20",
    )


@pytest.fixture
def sample_tools():
    """Create sample mapped tools."""
    return [
        MappedTool(
            name="name",
            original_name="name",
            description="Get the token name.",
            tool_type="read",
            parameters=[],
            return_schema={"type": "string", "python_type": "str"},
            return_description="Token name",
            python_signature="def name() -> str:",
        ),
        MappedTool(
            name="balance_of",
            original_name="balanceOf",
            description="Get token balance for an address.",
            tool_type="read",
            parameters=[
                ToolParameter(
                    name="account",
                    original_name="account",
                    solidity_type="address",
                    json_schema={"type": "string", "pattern": "^0x[a-fA-F0-9]{40}$"},
                    python_type="str",
                    description="Account address",
                ),
            ],
            return_schema={"type": "string", "python_type": "str"},
            return_description="Token balance",
            python_signature="def balance_of(account: str) -> str:",
        ),
        MappedTool(
            name="transfer",
            original_name="transfer",
            description="Transfer tokens to another address.",
            tool_type="write",
            parameters=[
                ToolParameter(
                    name="to",
                    original_name="to",
                    solidity_type="address",
                    json_schema={"type": "string"},
                    python_type="str",
                    description="Recipient",
                ),
                ToolParameter(
                    name="amount",
                    original_name="amount",
                    solidity_type="uint256",
                    json_schema={"type": "string"},
                    python_type="str",
                    description="Amount",
                ),
            ],
            return_schema={"type": "object"},
            return_description="Transaction result",
            python_signature="def transfer(to: str, amount: str) -> Dict:",
        ),
    ]


@pytest.fixture
def sample_resources():
    """Create sample mapped resources."""
    return [
        MappedResource(
            name="transfer",
            original_name="Transfer",
            description="Query Transfer events from the contract.",
            uri_template="events://transfer",
            fields=[
                ResourceField(
                    name="from_address",
                    original_name="from",
                    solidity_type="address",
                    json_schema={"type": "string"},
                    description="Sender address",
                    indexed=True,
                ),
                ResourceField(
                    name="to",
                    original_name="to",
                    solidity_type="address",
                    json_schema={"type": "string"},
                    description="Recipient address",
                    indexed=True,
                ),
                ResourceField(
                    name="value",
                    original_name="value",
                    solidity_type="uint256",
                    json_schema={"type": "string"},
                    description="Transfer amount",
                    indexed=False,
                ),
            ],
            function_name="get_transfer_events",
        ),
    ]


class TestServerGenerator:
    """Tests for ServerGenerator class."""

    def test_generate_complete_server(
        self,
        server_generator,
        sample_parsed_abi,
        sample_tools,
        sample_resources,
    ):
        """Generate a complete MCP server package."""
        result = server_generator.generate(
            parsed=sample_parsed_abi,
            tools=sample_tools,
            resources=sample_resources,
            contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="mainnet",
            contract_name="USDC Token",
        )
        
        # Verify file count
        assert len(result.files) >= 5
        
        # Verify required files exist
        assert any(f.path == "server.py" for f in result.files)
        assert any(f.path == "config.py" for f in result.files)
        assert any(f.path == "README.md" for f in result.files)
        assert any(f.path == "pyproject.toml" for f in result.files)
        assert any(f.path == "requirements.txt" for f in result.files)
        assert any(f.path == ".env.example" for f in result.files)

    def test_server_py_is_valid_python(
        self,
        server_generator,
        sample_parsed_abi,
        sample_tools,
        sample_resources,
    ):
        """Verify generated server.py is syntactically valid Python."""
        result = server_generator.generate(
            parsed=sample_parsed_abi,
            tools=sample_tools,
            resources=sample_resources,
            contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="mainnet",
        )
        
        server_file = next(f for f in result.files if f.path == "server.py")
        
        # Should not raise SyntaxError
        compile(server_file.content, "server.py", "exec")

    def test_read_only_mode(
        self,
        sample_parsed_abi,
        sample_tools,
        sample_resources,
    ):
        """Test read-only mode excludes write operations."""
        config = GeneratorConfig(read_only=True)
        generator = ServerGenerator(config)
        
        result = generator.generate(
            parsed=sample_parsed_abi,
            tools=sample_tools,
            resources=sample_resources,
            contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="mainnet",
        )
        
        assert "transfer" not in result.write_tools
        assert len(result.write_tools) == 0

    def test_server_name_from_contract_name(
        self,
        server_generator,
        sample_parsed_abi,
        sample_tools,
        sample_resources,
    ):
        """Test server name is derived from contract name."""
        result = server_generator.generate(
            parsed=sample_parsed_abi,
            tools=sample_tools,
            resources=sample_resources,
            contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="mainnet",
            contract_name="My Token",
        )
        
        assert result.server_name == "My Token MCP Server"

    def test_server_name_from_standard(
        self,
        server_generator,
        sample_parsed_abi,
        sample_tools,
        sample_resources,
    ):
        """Test server name is derived from detected standard."""
        result = server_generator.generate(
            parsed=sample_parsed_abi,
            tools=sample_tools,
            resources=sample_resources,
            contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="mainnet",
        )
        
        assert "ERC20" in result.server_name

    def test_tool_counts(
        self,
        server_generator,
        sample_parsed_abi,
        sample_tools,
        sample_resources,
    ):
        """Test tool counting is correct."""
        result = server_generator.generate(
            parsed=sample_parsed_abi,
            tools=sample_tools,
            resources=sample_resources,
            contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="mainnet",
        )
        
        assert result.tool_count == 3
        assert len(result.read_tools) == 2
        assert len(result.write_tools) == 1
        assert result.resource_count == 1

    def test_network_configuration(self, server_generator, sample_parsed_abi, sample_tools, sample_resources):
        """Test network configuration is applied correctly."""
        result = server_generator.generate(
            parsed=sample_parsed_abi,
            tools=sample_tools,
            resources=sample_resources,
            contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="polygon",
        )
        
        config_file = next(f for f in result.files if f.path == "config.py")
        
        assert "polygon" in config_file.content.lower()
        assert "137" in config_file.content  # Polygon chain ID


class TestServerGeneratorHelpers:
    """Tests for ServerGenerator helper methods."""

    def test_to_snake_case(self):
        """Test snake_case conversion."""
        assert ServerGenerator._to_snake_case("balanceOf") == "balance_of"
        assert ServerGenerator._to_snake_case("transferFrom") == "transfer_from"
        assert ServerGenerator._to_snake_case("ERC20Token") == "erc20_token"
        assert ServerGenerator._to_snake_case("simpleWord") == "simple_word"

    def test_to_package_name(self):
        """Test package name generation."""
        assert ServerGenerator._to_package_name("USDC Token MCP Server") == "usdc_token"
        assert ServerGenerator._to_package_name("My Contract") == "my_contract"
        assert ServerGenerator._to_package_name("123 Token") == "contract_123_token"
        assert ServerGenerator._to_package_name("") == "mcp_server"

    def test_write_to_disk(self, server_generator, sample_parsed_abi, sample_tools, sample_resources):
        """Test writing generated server to disk."""
        result = server_generator.generate(
            parsed=sample_parsed_abi,
            tools=sample_tools,
            resources=sample_resources,
            contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="mainnet",
        )
        
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = server_generator.write_to_disk(result, Path(tmpdir))
            
            assert (output_path / "server.py").exists()
            assert (output_path / "README.md").exists()
            assert (output_path / "config.py").exists()


class TestGeneratedFiles:
    """Tests for specific generated file contents."""

    def test_readme_contains_tools(
        self,
        server_generator,
        sample_parsed_abi,
        sample_tools,
        sample_resources,
    ):
        """Test README contains tool documentation."""
        result = server_generator.generate(
            parsed=sample_parsed_abi,
            tools=sample_tools,
            resources=sample_resources,
            contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="mainnet",
        )
        
        readme = next(f for f in result.files if f.path == "README.md")
        
        assert "balance_of" in readme.content
        assert "transfer" in readme.content
        assert "Read Operations" in readme.content

    def test_requirements_txt(self, server_generator, sample_parsed_abi, sample_tools, sample_resources):
        """Test requirements.txt content."""
        result = server_generator.generate(
            parsed=sample_parsed_abi,
            tools=sample_tools,
            resources=sample_resources,
            contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="mainnet",
        )
        
        requirements = next(f for f in result.files if f.path == "requirements.txt")
        
        assert "mcp" in requirements.content
        assert "web3" in requirements.content
        assert "python-dotenv" in requirements.content

    def test_env_example(self, server_generator, sample_parsed_abi, sample_tools, sample_resources):
        """Test .env.example content."""
        result = server_generator.generate(
            parsed=sample_parsed_abi,
            tools=sample_tools,
            resources=sample_resources,
            contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="mainnet",
        )
        
        env_example = next(f for f in result.files if f.path == ".env.example")
        
        assert "RPC_URL" in env_example.content
        assert "PRIVATE_KEY" in env_example.content
        assert "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" in env_example.content

    def test_pyproject_toml(self, server_generator, sample_parsed_abi, sample_tools, sample_resources):
        """Test pyproject.toml content."""
        result = server_generator.generate(
            parsed=sample_parsed_abi,
            tools=sample_tools,
            resources=sample_resources,
            contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="mainnet",
            contract_name="USDC Token",
        )
        
        pyproject = next(f for f in result.files if f.path == "pyproject.toml")
        
        assert "[project]" in pyproject.content
        assert "mcp" in pyproject.content
        assert "requires-python" in pyproject.content
