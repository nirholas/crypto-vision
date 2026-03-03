"""Tests for models module with extended coverage."""

import pytest

from abi_to_mcp.core.models import (
    StateMutability,
    ToolType,
    ABIParameter,
    ABIFunction,
    ABIEvent,
    ABIError,
    ParsedABI,
    ToolParameter,
    MappedTool,
    ResourceField,
    MappedResource,
    GeneratedFile,
    GeneratedServer,
    FetchResult,
)


class TestStateMutability:
    """Tests for StateMutability enum."""

    def test_pure_is_read_only(self):
        """Pure is read only."""
        assert StateMutability.PURE.is_read_only is True
        assert StateMutability.PURE.requires_gas is False

    def test_view_is_read_only(self):
        """View is read only."""
        assert StateMutability.VIEW.is_read_only is True
        assert StateMutability.VIEW.requires_gas is False

    def test_nonpayable_requires_gas(self):
        """Nonpayable requires gas."""
        assert StateMutability.NONPAYABLE.is_read_only is False
        assert StateMutability.NONPAYABLE.requires_gas is True

    def test_payable_requires_gas(self):
        """Payable requires gas."""
        assert StateMutability.PAYABLE.is_read_only is False
        assert StateMutability.PAYABLE.requires_gas is True


class TestToolType:
    """Tests for ToolType enum."""

    def test_tool_types(self):
        """Test tool type values."""
        assert ToolType.READ.value == "read"
        assert ToolType.WRITE.value == "write"
        assert ToolType.WRITE_PAYABLE.value == "write_payable"


class TestABIParameter:
    """Tests for ABIParameter dataclass."""

    def test_basic_parameter(self):
        """Create basic parameter."""
        param = ABIParameter(
            name="amount",
            type="uint256",
        )
        
        assert param.name == "amount"
        assert param.type == "uint256"
        assert param.indexed is False
        assert param.components is None

    def test_indexed_parameter(self):
        """Create indexed parameter."""
        param = ABIParameter(
            name="from",
            type="address",
            indexed=True,
        )
        
        assert param.indexed is True

    def test_tuple_parameter(self):
        """Create tuple parameter with components."""
        param = ABIParameter(
            name="data",
            type="tuple",
            components=[
                ABIParameter(name="x", type="uint256"),
                ABIParameter(name="y", type="uint256"),
            ],
        )
        
        assert param.components is not None
        assert len(param.components) == 2

    def test_from_dict(self):
        """Create parameter from dict."""
        data = {
            "name": "value",
            "type": "uint256",
            "indexed": True,
            "internalType": "uint256",
        }
        param = ABIParameter.from_dict(data)
        
        assert param.name == "value"
        assert param.type == "uint256"
        assert param.indexed is True
        assert param.internal_type == "uint256"

    def test_from_dict_with_components(self):
        """Create tuple parameter from dict."""
        data = {
            "name": "data",
            "type": "tuple",
            "components": [
                {"name": "x", "type": "uint256"},
                {"name": "y", "type": "uint256"},
            ]
        }
        param = ABIParameter.from_dict(data)
        
        assert param.components is not None
        assert len(param.components) == 2


class TestABIFunction:
    """Tests for ABIFunction dataclass."""

    def test_view_function(self):
        """Create view function."""
        func = ABIFunction(
            name="balanceOf",
            inputs=[ABIParameter(name="account", type="address")],
            outputs=[ABIParameter(name="", type="uint256")],
            state_mutability=StateMutability.VIEW,
        )
        
        assert func.name == "balanceOf"
        assert func.state_mutability == StateMutability.VIEW
        assert func.is_read_only is True
        assert func.is_payable is False
        assert func.requires_gas is False
        assert func.tool_type == ToolType.READ

    def test_payable_function(self):
        """Create payable function."""
        func = ABIFunction(
            name="deposit",
            inputs=[],
            outputs=[],
            state_mutability=StateMutability.PAYABLE,
        )
        
        assert func.is_payable is True
        assert func.tool_type == ToolType.WRITE_PAYABLE

    def test_nonpayable_function(self):
        """Create nonpayable function."""
        func = ABIFunction(
            name="transfer",
            inputs=[],
            outputs=[],
            state_mutability=StateMutability.NONPAYABLE,
        )
        
        assert func.is_read_only is False
        assert func.is_payable is False
        assert func.requires_gas is True
        assert func.tool_type == ToolType.WRITE

    def test_from_dict(self):
        """Create function from dict."""
        data = {
            "name": "transfer",
            "inputs": [{"name": "to", "type": "address"}],
            "outputs": [{"name": "", "type": "bool"}],
            "stateMutability": "nonpayable",
        }
        func = ABIFunction.from_dict(data)
        
        assert func.name == "transfer"
        assert len(func.inputs) == 1
        assert len(func.outputs) == 1


class TestABIEvent:
    """Tests for ABIEvent dataclass."""

    def test_basic_event(self):
        """Create basic event."""
        event = ABIEvent(
            name="Transfer",
            inputs=[
                ABIParameter(name="from", type="address", indexed=True),
                ABIParameter(name="to", type="address", indexed=True),
                ABIParameter(name="value", type="uint256", indexed=False),
            ],
        )
        
        assert event.name == "Transfer"
        assert len(event.inputs) == 3
        assert event.anonymous is False
        assert len(event.indexed_inputs) == 2
        assert len(event.data_inputs) == 1

    def test_anonymous_event(self):
        """Create anonymous event."""
        event = ABIEvent(
            name="AnonymousEvent",
            inputs=[],
            anonymous=True,
        )
        
        assert event.anonymous is True

    def test_from_dict(self):
        """Create event from dict."""
        data = {
            "name": "Transfer",
            "inputs": [
                {"name": "from", "type": "address", "indexed": True},
            ],
            "anonymous": False,
        }
        event = ABIEvent.from_dict(data)
        
        assert event.name == "Transfer"
        assert len(event.inputs) == 1


class TestABIError:
    """Tests for ABIError dataclass."""

    def test_basic_error(self):
        """Create basic error."""
        err = ABIError(
            name="InsufficientBalance",
            inputs=[ABIParameter(name="balance", type="uint256")],
        )
        
        assert err.name == "InsufficientBalance"
        assert len(err.inputs) == 1

    def test_from_dict(self):
        """Create error from dict."""
        data = {
            "name": "Unauthorized",
            "inputs": [],
        }
        err = ABIError.from_dict(data)
        
        assert err.name == "Unauthorized"


class TestParsedABI:
    """Tests for ParsedABI dataclass."""

    def test_empty_abi(self):
        """Create empty parsed ABI."""
        parsed = ParsedABI(
            functions=[],
            events=[],
            errors=[],
            raw_abi=[],
        )
        
        assert len(parsed.functions) == 0
        assert len(parsed.events) == 0
        assert parsed.detected_standard is None

    def test_with_detected_standard(self):
        """Parsed ABI with detected standard."""
        parsed = ParsedABI(
            functions=[],
            events=[],
            errors=[],
            raw_abi=[],
            detected_standard="ERC20",
        )
        
        assert parsed.detected_standard == "ERC20"

    def test_read_write_functions(self):
        """Test read/write function filtering."""
        view_func = ABIFunction(
            name="balanceOf",
            inputs=[],
            outputs=[],
            state_mutability=StateMutability.VIEW,
        )
        write_func = ABIFunction(
            name="transfer",
            inputs=[],
            outputs=[],
            state_mutability=StateMutability.NONPAYABLE,
        )
        parsed = ParsedABI(
            functions=[view_func, write_func],
            events=[],
            errors=[],
            raw_abi=[],
        )
        
        assert len(parsed.read_functions) == 1
        assert len(parsed.write_functions) == 1


class TestToolParameter:
    """Tests for ToolParameter dataclass."""

    def test_basic_param(self):
        """Create basic tool parameter."""
        param = ToolParameter(
            name="amount",
            original_name="amount",
            solidity_type="uint256",
            json_schema={"type": "string"},
            python_type="str",
            description="Amount in wei",
        )
        
        assert param.name == "amount"
        assert param.python_type == "str"
        assert param.required is True


class TestMappedTool:
    """Tests for MappedTool dataclass."""

    def test_read_tool(self):
        """Create read tool."""
        tool = MappedTool(
            name="balance_of",
            original_name="balanceOf",
            description="Get balance",
            tool_type="read",
            parameters=[],
            return_schema={"type": "integer"},
            return_description="Balance",
            python_signature="def balance_of(account: str) -> int:",
        )
        
        assert tool.tool_type == "read"
        assert tool.is_read_only is True
        assert tool.is_payable is False

    def test_write_payable_tool(self):
        """Create write payable tool."""
        tool = MappedTool(
            name="deposit",
            original_name="deposit",
            description="Deposit tokens",
            tool_type="write_payable",
            parameters=[],
            return_schema={"type": "object"},
            return_description="Transaction result",
            python_signature="def deposit() -> dict:",
        )
        
        assert tool.is_payable is True

    def test_required_params(self):
        """Test required parameters."""
        param = ToolParameter(
            name="to",
            original_name="to",
            solidity_type="address",
            json_schema={"type": "string"},
            python_type="str",
            description="Recipient",
            required=True,
        )
        tool = MappedTool(
            name="transfer",
            original_name="transfer",
            description="Transfer tokens",
            tool_type="write",
            parameters=[param],
            return_schema={},
            return_description="",
            python_signature="def transfer(to: str) -> dict:",
        )
        
        assert "to" in tool.required_params


class TestResourceField:
    """Tests for ResourceField dataclass."""

    def test_basic_field(self):
        """Create basic resource field."""
        field = ResourceField(
            name="from_address",
            original_name="from",
            solidity_type="address",
            json_schema={"type": "string"},
            description="Sender address",
            indexed=True,
        )
        
        assert field.name == "from_address"
        assert field.indexed is True


class TestMappedResource:
    """Tests for MappedResource dataclass."""

    def test_basic_resource(self):
        """Create basic resource."""
        indexed_field = ResourceField(
            name="from",
            original_name="from",
            solidity_type="address",
            json_schema={},
            description="",
            indexed=True,
        )
        data_field = ResourceField(
            name="value",
            original_name="value",
            solidity_type="uint256",
            json_schema={},
            description="",
            indexed=False,
        )
        resource = MappedResource(
            name="transfer_events",
            original_name="Transfer",
            description="Transfer events",
            uri_template="events://transfer/{from_block}",
            fields=[indexed_field, data_field],
            function_name="get_transfer_events",
        )
        
        assert resource.name == "transfer_events"
        assert len(resource.indexed_fields) == 1
        assert len(resource.data_fields) == 1


class TestGeneratedFile:
    """Tests for GeneratedFile dataclass."""

    def test_basic_file(self):
        """Create basic generated file."""
        file = GeneratedFile(
            path="server.py",
            content="# Generated server",
        )
        
        assert file.path == "server.py"
        assert file.is_executable is False

    def test_executable_file(self):
        """Create executable file."""
        file = GeneratedFile(
            path="run.sh",
            content="#!/bin/bash",
            is_executable=True,
        )
        
        assert file.is_executable is True


class TestGeneratedServer:
    """Tests for GeneratedServer dataclass."""

    def test_basic_server(self):
        """Create basic generated server."""
        server = GeneratedServer(
            files=[
                GeneratedFile(path="server.py", content="# Server"),
                GeneratedFile(path="README.md", content="# README"),
            ],
            tool_count=5,
            resource_count=2,
            read_tools=["balance_of"],
            write_tools=["transfer"],
            events=["Transfer"],
            server_name="my-token-server",
            contract_address="0x1234",
            network="mainnet",
        )
        
        assert server.server_name == "my-token-server"
        assert len(server.files) == 2
        assert server.tool_count == 5

    def test_get_file(self):
        """Get file by path."""
        server = GeneratedServer(
            files=[
                GeneratedFile(path="server.py", content="# Server"),
            ],
            tool_count=1,
            resource_count=0,
            read_tools=[],
            write_tools=[],
            events=[],
            server_name="test",
            contract_address="0x1234",
            network="mainnet",
        )
        
        assert server.get_file("server.py") is not None
        assert server.get_file("nonexistent.py") is None


class TestFetchResult:
    """Tests for FetchResult dataclass."""

    def test_basic_fetch_result(self):
        """Create basic fetch result."""
        result = FetchResult(
            abi=[{"type": "function", "name": "test"}],
            source="file",
            source_location="test.json",
        )
        
        assert len(result.abi) == 1
        assert result.source == "file"

    def test_fetch_result_with_metadata(self):
        """Create fetch result with metadata."""
        result = FetchResult(
            abi=[],
            source="etherscan",
            source_location="0x1234",
            contract_name="MyToken",
            is_proxy=True,
            implementation_address="0x5678",
        )
        
        assert result.contract_name == "MyToken"
        assert result.is_proxy is True
        assert result.implementation_address == "0x5678"
