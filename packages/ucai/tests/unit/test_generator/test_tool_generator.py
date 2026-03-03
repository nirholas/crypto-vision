"""Unit tests for ToolGenerator."""

import pytest
from jinja2 import Environment, DictLoader

from abi_to_mcp.core.models import MappedTool, ToolParameter
from abi_to_mcp.generator.tool_generator import ToolGenerator
from abi_to_mcp.generator.templates import create_jinja_env


@pytest.fixture
def jinja_env():
    """Create a Jinja2 environment for testing."""
    return create_jinja_env()


@pytest.fixture
def tool_generator(jinja_env):
    """Create a ToolGenerator instance."""
    return ToolGenerator(jinja_env)


@pytest.fixture
def read_tool():
    """Create a sample read-only tool."""
    return MappedTool(
        name="balance_of",
        original_name="balanceOf",
        description="Get token balance for an address.",
        tool_type="read",
        parameters=[
            ToolParameter(
                name="account",
                original_name="account",
                solidity_type="address",
                json_schema={
                    "type": "string",
                    "pattern": "^0x[a-fA-F0-9]{40}$",
                    "description": "Ethereum address (20 bytes)",
                },
                python_type="str",
                description="The account address to query balance for",
            )
        ],
        return_schema={"type": "string"},
        return_description="The token balance as a string (in wei)",
        python_signature="def balance_of(account: str) -> str:",
    )


@pytest.fixture
def write_tool():
    """Create a sample write tool."""
    return MappedTool(
        name="transfer",
        original_name="transfer",
        description="Transfer tokens to another address.",
        tool_type="write",
        parameters=[
            ToolParameter(
                name="to",
                original_name="to",
                solidity_type="address",
                json_schema={
                    "type": "string",
                    "pattern": "^0x[a-fA-F0-9]{40}$",
                },
                python_type="str",
                description="Recipient address",
            ),
            ToolParameter(
                name="amount",
                original_name="amount",
                solidity_type="uint256",
                json_schema={
                    "type": "string",
                    "pattern": "^[0-9]+$",
                },
                python_type="str",
                description="Amount to transfer (in wei)",
            ),
        ],
        return_schema={"type": "object"},
        return_description="Transaction result with hash and status",
        python_signature="def transfer(to: str, amount: str, simulate: bool = True) -> Dict:",
    )


@pytest.fixture
def payable_tool():
    """Create a sample payable tool."""
    return MappedTool(
        name="deposit",
        original_name="deposit",
        description="Deposit ETH into the contract.",
        tool_type="write_payable",
        parameters=[],
        return_schema={"type": "object"},
        return_description="Transaction result with hash and status",
        python_signature="def deposit(value_wei: str = '0', simulate: bool = True) -> Dict:",
    )


class TestToolGenerator:
    """Tests for ToolGenerator class."""

    def test_generate_read_tool(self, tool_generator, read_tool):
        """Generate code for a read-only tool."""
        code = tool_generator.generate_tool(read_tool)
        
        assert "@mcp.tool" in code
        assert "def balance_of(" in code
        assert "account: str" in code
        assert "contract.functions.balanceOf" in code
        assert ".call()" in code
        assert "simulate" not in code  # Read tools don't have simulate

    def test_generate_write_tool_with_simulation(self, tool_generator, write_tool):
        """Generate code for a write tool with simulation."""
        code = tool_generator.generate_tool(write_tool)
        
        assert "@mcp.tool" in code
        assert "def transfer(" in code
        assert "to: str" in code
        assert "amount: str" in code
        assert "simulate: bool" in code
        assert "if simulate:" in code
        assert "build_transaction" in code
        assert "sign_transaction" in code

    def test_generate_payable_tool(self, tool_generator, payable_tool):
        """Generate code for a payable tool."""
        code = tool_generator.generate_tool(payable_tool)
        
        assert "@mcp.tool" in code
        assert "def deposit(" in code
        assert "value_wei: str" in code
        assert "simulate: bool" in code
        assert '"value": int(value_wei)' in code

    def test_generate_all_tools(self, tool_generator, read_tool, write_tool):
        """Generate code for multiple tools."""
        tools = [read_tool, write_tool]
        code = tool_generator.generate_all_tools(tools)
        
        assert "READ FUNCTIONS" in code
        assert "WRITE FUNCTIONS" in code
        assert "balance_of" in code
        assert "transfer" in code

    def test_inline_tool_generation(self, tool_generator, read_tool):
        """Test inline tool generation without templates."""
        code = tool_generator.generate_inline_tool(read_tool)
        
        assert "@mcp.tool" in code
        assert "def balance_of(account: str)" in code
        assert "Get token balance for an address." in code
        assert "Args:" in code
        assert "Returns:" in code

    def test_read_tool_no_params(self, tool_generator, jinja_env):
        """Test read tool with no parameters."""
        tool = MappedTool(
            name="decimals",
            original_name="decimals",
            description="Get the number of decimals for the token.",
            tool_type="read",
            parameters=[],
            return_schema={"type": "integer"},
            return_description="Number of decimals",
            python_signature="def decimals() -> int:",
        )
        
        code = tool_generator.generate_tool(tool)
        
        assert "def decimals(" in code
        assert "contract.functions.decimals().call()" in code


class TestToolGeneratorEdgeCases:
    """Edge case tests for ToolGenerator."""

    def test_tool_with_multiple_params(self, tool_generator, jinja_env):
        """Test tool with many parameters."""
        tool = MappedTool(
            name="transfer_from",
            original_name="transferFrom",
            description="Transfer tokens from one address to another.",
            tool_type="write",
            parameters=[
                ToolParameter(
                    name="from_address",
                    original_name="from",
                    solidity_type="address",
                    json_schema={"type": "string"},
                    python_type="str",
                    description="Source address",
                ),
                ToolParameter(
                    name="to",
                    original_name="to",
                    solidity_type="address",
                    json_schema={"type": "string"},
                    python_type="str",
                    description="Destination address",
                ),
                ToolParameter(
                    name="amount",
                    original_name="amount",
                    solidity_type="uint256",
                    json_schema={"type": "string"},
                    python_type="str",
                    description="Amount to transfer",
                ),
            ],
            return_schema={"type": "object"},
            return_description="Transaction result",
            python_signature="def transfer_from(...) -> Dict:",
        )
        
        code = tool_generator.generate_tool(tool)
        
        assert "from_address: str" in code
        assert "to: str" in code
        assert "amount: str" in code

    def test_empty_tools_list(self, tool_generator):
        """Test generating code for empty tools list."""
        code = tool_generator.generate_all_tools([])
        
        assert code == ""

    def test_only_read_tools(self, tool_generator, read_tool):
        """Test generating code with only read tools."""
        code = tool_generator.generate_all_tools([read_tool])
        
        assert "READ FUNCTIONS" in code
        assert "WRITE FUNCTIONS" not in code

    def test_only_write_tools(self, tool_generator, write_tool):
        """Test generating code with only write tools."""
        code = tool_generator.generate_all_tools([write_tool])
        
        assert "READ FUNCTIONS" not in code
        assert "WRITE FUNCTIONS" in code
"""Tests for ToolGenerator with extended coverage."""

import pytest
from unittest.mock import Mock, MagicMock



class TestToolGeneratorInline:
    """Tests for inline tool generation (no templates)."""

    @pytest.fixture
    def generator(self):
        """Create a ToolGenerator with mock environment."""
        env = Environment(loader=DictLoader({
            "tool.py.jinja2": "# template {{ tool.name }}",
        }))
        return ToolGenerator(env)

    @pytest.fixture
    def read_tool(self):
        """Create a read-only tool."""
        return MappedTool(
            name="balance_of",
            original_name="balanceOf",
            description="Get the balance of an account",
            tool_type="read",
            parameters=[
                ToolParameter(
                    name="account",
                    original_name="account",
                    solidity_type="address",
                    python_type="str",
                    json_schema={"type": "string"},
                    description="Account address",
                ),
            ],
            return_schema={"type": "integer"},
            return_description="The account balance",
            python_signature="def balance_of(account: str) -> int:",
        )

    @pytest.fixture
    def write_tool(self):
        """Create a write tool."""
        return MappedTool(
            name="transfer",
            original_name="transfer",
            description="Transfer tokens to an address",
            tool_type="write",
            parameters=[
                ToolParameter(
                    name="to",
                    original_name="to",
                    solidity_type="address",
                    python_type="str",
                    json_schema={"type": "string"},
                    description="Recipient address",
                ),
                ToolParameter(
                    name="amount",
                    original_name="amount",
                    solidity_type="uint256",
                    python_type="str",
                    json_schema={"type": "string"},
                    description="Amount to transfer",
                ),
            ],
            return_schema={"type": "boolean"},
            return_description="Success status",
            python_signature="def transfer(to: str, amount: str) -> dict:",
        )

    @pytest.fixture
    def payable_tool(self):
        """Create a payable write tool."""
        return MappedTool(
            name="deposit",
            original_name="deposit",
            description="Deposit ETH",
            tool_type="write_payable",
            parameters=[],
            return_schema={"type": "object"},
            return_description="Transaction result",
            python_signature="def deposit() -> dict:",
        )

    def test_generate_inline_read_tool(self, generator, read_tool):
        """Generate inline code for read tool."""
        code = generator.generate_inline_tool(read_tool)

        assert "@mcp.tool" in code
        assert "def balance_of" in code
        assert "account: str" in code
        assert '"""' in code
        assert "Get the balance" in code
        assert "balanceOf" in code  # Original function name

    def test_generate_inline_write_tool(self, generator, write_tool):
        """Generate inline code for write tool."""
        code = generator.generate_inline_tool(write_tool)

        assert "@mcp.tool" in code
        assert "def transfer" in code
        assert "to: str" in code
        assert "amount: str" in code
        assert "simulate: bool = True" in code
        assert "READ_ONLY_MODE" in code

    def test_generate_inline_payable_tool(self, generator, payable_tool):
        """Generate inline code for payable tool."""
        code = generator.generate_inline_tool(payable_tool)

        assert "@mcp.tool" in code
        assert "def deposit" in code
        assert 'value_wei: str = "0"' in code
        assert "simulate: bool = True" in code

    def test_build_param_list_read(self, generator, read_tool):
        """Build parameter list for read function."""
        params = generator._build_param_list(read_tool)

        assert "account: str" in params
        assert "simulate" not in params

    def test_build_param_list_write(self, generator, write_tool):
        """Build parameter list for write function."""
        params = generator._build_param_list(write_tool)

        assert "to: str" in params
        assert "amount: str" in params
        assert "simulate: bool = True" in params

    def test_build_param_list_payable(self, generator, payable_tool):
        """Build parameter list for payable function."""
        params = generator._build_param_list(payable_tool)

        assert 'value_wei: str = "0"' in params
        assert "simulate: bool = True" in params

    def test_get_return_type_read(self, generator, read_tool):
        """Get return type for read function."""
        return_type = generator._get_return_type(read_tool)

        assert return_type == "int"

    def test_get_return_type_write(self, generator, write_tool):
        """Get return type for write function."""
        return_type = generator._get_return_type(write_tool)

        assert return_type == "Dict[str, Any]"

    def test_get_return_type_string(self, generator):
        """Get return type for string return."""
        tool = MappedTool(
            name="name",
            original_name="name",
            description="Get name",
            tool_type="read",
            parameters=[],
            return_schema={"type": "string"},
            return_description="The name",
            python_signature="def name() -> str:",
        )

        return_type = generator._get_return_type(tool)
        assert return_type == "str"

    def test_get_return_type_boolean(self, generator):
        """Get return type for boolean return."""
        tool = MappedTool(
            name="is_active",
            original_name="isActive",
            description="Check active",
            tool_type="read",
            parameters=[],
            return_schema={"type": "boolean"},
            return_description="Active status",
            python_signature="def is_active() -> bool:",
        )

        return_type = generator._get_return_type(tool)
        assert return_type == "bool"

    def test_get_return_type_array(self, generator):
        """Get return type for array return."""
        tool = MappedTool(
            name="get_list",
            original_name="getList",
            description="Get list",
            tool_type="read",
            parameters=[],
            return_schema={"type": "array"},
            return_description="List of items",
            python_signature="def get_list() -> list:",
        )

        return_type = generator._get_return_type(tool)
        assert return_type == "List"

    def test_generate_read_body(self, generator, read_tool):
        """Generate body for read function."""
        lines = generator._generate_read_body(read_tool)

        assert len(lines) > 0
        code = "\n".join(lines)
        assert "balanceOf" in code
        assert "account" in code
        assert ".call()" in code

    def test_generate_read_body_no_params(self, generator):
        """Generate body for read function with no parameters."""
        tool = MappedTool(
            name="total_supply",
            original_name="totalSupply",
            description="Get total supply",
            tool_type="read",
            parameters=[],
            return_schema={"type": "integer"},
            return_description="Total supply",
            python_signature="def total_supply() -> int:",
        )

        lines = generator._generate_read_body(tool)
        code = "\n".join(lines)

        assert "totalSupply()" in code
        assert ".call()" in code

    def test_generate_write_body(self, generator, write_tool):
        """Generate body for write function."""
        lines = generator._generate_write_body(write_tool)

        code = "\n".join(lines)
        assert "READ_ONLY_MODE" in code
        assert "_get_signer()" in code
        assert "simulate" in code
        assert "build_transaction" in code
        assert "sign_transaction" in code

    def test_generate_section_header(self, generator):
        """Generate section header comment."""
        header = generator._generate_section_header("READ FUNCTIONS", "No gas required")

        assert "READ FUNCTIONS" in header
        assert "No gas required" in header
        assert "=" in header


class TestToolGeneratorAllTools:
    """Tests for generate_all_tools method."""

    @pytest.fixture
    def generator(self):
        """Create a ToolGenerator with mock environment."""
        env = Environment(loader=DictLoader({
            "tool.py.jinja2": "# {{ tool.name }}",
        }))
        return ToolGenerator(env)

    def test_generate_all_tools_mixed(self, generator):
        """Generate all tools with read and write."""
        tools = [
            MappedTool(
                name="balance_of",
                original_name="balanceOf",
                description="Get balance",
                tool_type="read",
                parameters=[],
                return_schema={"type": "integer"},
                return_description="Balance",
                python_signature="def balance_of() -> int:",
            ),
            MappedTool(
                name="transfer",
                original_name="transfer",
                description="Transfer",
                tool_type="write",
                parameters=[],
                return_schema={"type": "boolean"},
                return_description="Success",
                python_signature="def transfer() -> dict:",
            ),
        ]

        code = generator.generate_all_tools(tools)

        assert "READ FUNCTIONS" in code
        assert "WRITE FUNCTIONS" in code
        assert "balance_of" in code
        assert "transfer" in code

    def test_generate_all_tools_read_only(self, generator):
        """Generate all tools with only read functions."""
        tools = [
            MappedTool(
                name="balance_of",
                original_name="balanceOf",
                description="Get balance",
                tool_type="read",
                parameters=[],
                return_schema={"type": "integer"},
                return_description="Balance",
                python_signature="def balance_of() -> int:",
            ),
        ]

        code = generator.generate_all_tools(tools)

        assert "READ FUNCTIONS" in code
        assert "WRITE FUNCTIONS" not in code

    def test_generate_all_tools_write_only(self, generator):
        """Generate all tools with only write functions."""
        tools = [
            MappedTool(
                name="transfer",
                original_name="transfer",
                description="Transfer",
                tool_type="write",
                parameters=[],
                return_schema={"type": "boolean"},
                return_description="Success",
                python_signature="def transfer() -> dict:",
            ),
        ]

        code = generator.generate_all_tools(tools)

        assert "READ FUNCTIONS" not in code
        assert "WRITE FUNCTIONS" in code
