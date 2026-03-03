"""Tests for function mapper module."""

import pytest

from abi_to_mcp.mapper.function_mapper import FunctionMapper
from abi_to_mcp.mapper.type_mapper import TypeMapper
from abi_to_mcp.core.models import ABIFunction, ABIParameter, StateMutability


def test_map_simple_function():
    """Map a simple function to MCP tool."""
    type_mapper = TypeMapper()
    func_mapper = FunctionMapper(type_mapper)
    
    func = ABIFunction(
        name="balanceOf",
        inputs=[ABIParameter(name="account", type="address")],
        outputs=[ABIParameter(name="", type="uint256")],
        state_mutability=StateMutability.VIEW,
    )
    
    tool = func_mapper.map_function(func)
    
    assert tool.name == "balance_of"
    assert tool.original_name == "balanceOf"
    assert tool.tool_type == "read"
    assert len(tool.parameters) == 1
    assert tool.parameters[0].name == "account"


def test_map_function_to_tool():
    """Map a function to MCP tool definition."""
    type_mapper = TypeMapper()
    func_mapper = FunctionMapper(type_mapper)
    
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
    
    assert tool.name == "transfer_from"
    assert tool.original_name == "transferFrom"
    assert tool.tool_type == "write"
    assert len(tool.parameters) == 3
    # Note: 'from' is a Python keyword, so it's escaped to 'from_'
    assert "from_" in tool.required_params
    assert "simulate" in tool.python_signature


def test_map_payable_function():
    """Map payable function to tool."""
    type_mapper = TypeMapper()
    func_mapper = FunctionMapper(type_mapper)
    
    func = ABIFunction(
        name="deposit",
        inputs=[],
        outputs=[],
        state_mutability=StateMutability.PAYABLE,
    )
    
    tool = func_mapper.map_function(func)
    
    assert tool.tool_type == "write_payable"
    assert "ETH" in tool.description or "Ether" in tool.description


def test_map_view_function():
    """Map view function to read tool."""
    type_mapper = TypeMapper()
    func_mapper = FunctionMapper(type_mapper)
    
    func = ABIFunction(
        name="totalSupply",
        inputs=[],
        outputs=[ABIParameter(name="", type="uint256")],
        state_mutability=StateMutability.VIEW,
    )
    
    tool = func_mapper.map_function(func)
    
    assert tool.tool_type == "read"
    assert "read-only" in tool.description.lower() or "gas" in tool.description.lower()
    assert "simulate" not in tool.python_signature


def test_map_pure_function():
    """Map pure function to read tool."""
    type_mapper = TypeMapper()
    func_mapper = FunctionMapper(type_mapper)
    
    func = ABIFunction(
        name="calculate",
        inputs=[
            ABIParameter(name="a", type="uint256"),
            ABIParameter(name="b", type="uint256")
        ],
        outputs=[ABIParameter(name="", type="uint256")],
        state_mutability=StateMutability.PURE,
    )
    
    tool = func_mapper.map_function(func)
    
    assert tool.tool_type == "read"


def test_camel_to_snake_case():
    """Test camelCase to snake_case conversion."""
    type_mapper = TypeMapper()
    func_mapper = FunctionMapper(type_mapper)
    
    assert func_mapper._to_snake_case("balanceOf") == "balance_of"
    assert func_mapper._to_snake_case("transferFrom") == "transfer_from"
    assert func_mapper._to_snake_case("setApprovalForAll") == "set_approval_for_all"
    assert func_mapper._to_snake_case("safeTransferFrom") == "safe_transfer_from"


def test_generate_description():
    """Test description generation."""
    type_mapper = TypeMapper()
    func_mapper = FunctionMapper(type_mapper)
    
    func = ABIFunction(
        name="transfer",
        inputs=[
            ABIParameter(name="to", type="address"),
            ABIParameter(name="amount", type="uint256")
        ],
        outputs=[ABIParameter(name="", type="bool")],
        state_mutability=StateMutability.NONPAYABLE,
    )
    
    description = func_mapper.generate_description(func)
    
    assert len(description) > 0
    assert "Transfer" in description or "transfer" in description


def test_map_function_unnamed_params():
    """Map function with unnamed parameters."""
    type_mapper = TypeMapper()
    func_mapper = FunctionMapper(type_mapper)
    
    func = ABIFunction(
        name="getValue",
        inputs=[ABIParameter(name="", type="uint256")],  # Unnamed param
        outputs=[ABIParameter(name="", type="uint256")],
        state_mutability=StateMutability.VIEW,
    )
    
    tool = func_mapper.map_function(func)
    
    # Should generate a parameter name
    assert len(tool.parameters) == 1
    assert tool.parameters[0].name  # Should have some name


def test_python_type_conversion():
    """Test Solidity to Python type conversion."""
    type_mapper = TypeMapper()
    func_mapper = FunctionMapper(type_mapper)
    
    assert "str" in func_mapper._to_python_type("address")
    assert "str" in func_mapper._to_python_type("uint256")
    assert "bool" in func_mapper._to_python_type("bool")
    assert "List" in func_mapper._to_python_type("address[]")
"""Tests for mapper edge cases to achieve 100% coverage."""

from unittest.mock import patch, Mock


class TestEventMapperEdgeCases:
    """Test edge cases in event mapper."""
    
    def test_components_to_dicts_with_dict_input(self):
        """Test _components_to_dicts with dict inputs."""
        from abi_to_mcp.mapper.event_mapper import EventMapper
        from abi_to_mcp.mapper.type_mapper import TypeMapper
        
        type_mapper = TypeMapper()
        mapper = EventMapper(type_mapper)
        
        # Test with dict components
        components = [
            {"name": "amount", "type": "uint256"},
            {"name": "to", "type": "address"},
        ]
        
        result = mapper._components_to_dicts(components)
        assert result == components
    
    def test_components_to_dicts_with_abi_parameter_objects(self):
        """Test _components_to_dicts with ABIParameter objects."""
        from abi_to_mcp.mapper.event_mapper import EventMapper
        from abi_to_mcp.mapper.type_mapper import TypeMapper
        from abi_to_mcp.core.models import ABIParameter
        
        type_mapper = TypeMapper()
        mapper = EventMapper(type_mapper)
        
        # Test with ABIParameter objects
        components = [
            ABIParameter(name="amount", type="uint256"),
            ABIParameter(name="to", type="address"),
        ]
        
        result = mapper._components_to_dicts(components)
        assert result == [
            {"name": "amount", "type": "uint256"},
            {"name": "to", "type": "address"},
        ]
    
    def test_components_to_dicts_with_nested_components(self):
        """Test _components_to_dicts with nested components."""
        from abi_to_mcp.mapper.event_mapper import EventMapper
        from abi_to_mcp.mapper.type_mapper import TypeMapper
        from abi_to_mcp.core.models import ABIParameter
        
        type_mapper = TypeMapper()
        mapper = EventMapper(type_mapper)
        
        # Test with nested ABIParameter objects
        inner_components = [
            ABIParameter(name="value", type="uint256"),
        ]
        components = [
            ABIParameter(name="data", type="tuple", components=inner_components),
        ]
        
        result = mapper._components_to_dicts(components)
        assert result[0]["name"] == "data"
        assert result[0]["type"] == "tuple"
        assert result[0]["components"] == [{"name": "value", "type": "uint256"}]


class TestFunctionMapperEdgeCases:
    """Test edge cases in function mapper."""
    
    def test_map_function_basic(self):
        """Test basic function mapping."""
        from abi_to_mcp.mapper.function_mapper import FunctionMapper
        from abi_to_mcp.mapper.type_mapper import TypeMapper
        from abi_to_mcp.core.models import ABIFunction, ABIParameter, StateMutability
        
        type_mapper = TypeMapper()
        mapper = FunctionMapper(type_mapper)
        
        func = ABIFunction(
            name="transfer",
            inputs=[
                ABIParameter(name="to", type="address"),
                ABIParameter(name="amount", type="uint256"),
            ],
            outputs=[ABIParameter(name="", type="bool")],
            state_mutability=StateMutability.NONPAYABLE,
        )
        
        result = mapper.map_function(func)
        assert result.name == "transfer"
        assert result.original_name == "transfer"
        assert len(result.parameters) == 2
    
    def test_map_function_with_camel_case(self):
        """Test function mapping with camelCase name."""
        from abi_to_mcp.mapper.function_mapper import FunctionMapper
        from abi_to_mcp.mapper.type_mapper import TypeMapper
        from abi_to_mcp.core.models import ABIFunction, StateMutability
        
        type_mapper = TypeMapper()
        mapper = FunctionMapper(type_mapper)
        
        func = ABIFunction(
            name="transferFrom",
            inputs=[],
            outputs=[],
            state_mutability=StateMutability.NONPAYABLE,
        )
        
        result = mapper.map_function(func)
        assert result.name == "transfer_from"
    
    def test_map_function_with_reserved_keyword(self):
        """Test function mapping with Python reserved keyword."""
        from abi_to_mcp.mapper.function_mapper import FunctionMapper
        from abi_to_mcp.mapper.type_mapper import TypeMapper
        from abi_to_mcp.core.models import ABIFunction, ABIParameter, StateMutability
        
        type_mapper = TypeMapper()
        mapper = FunctionMapper(type_mapper)
        
        func = ABIFunction(
            name="transfer",
            inputs=[ABIParameter(name="from", type="address")],  # 'from' is reserved
            outputs=[],
            state_mutability=StateMutability.NONPAYABLE,
        )
        
        result = mapper.map_function(func)
        # The parameter name should be escaped
        assert result.parameters[0].name == "from_"
    
    def test_generate_description_read_only(self):
        """Test description generation for read-only function."""
        from abi_to_mcp.mapper.function_mapper import FunctionMapper
        from abi_to_mcp.mapper.type_mapper import TypeMapper
        from abi_to_mcp.core.models import ABIFunction, StateMutability
        
        type_mapper = TypeMapper()
        mapper = FunctionMapper(type_mapper)
        
        func = ABIFunction(
            name="balanceOf",
            inputs=[],
            outputs=[],
            state_mutability=StateMutability.VIEW,
        )
        
        desc = mapper.generate_description(func)
        assert "read-only" in desc.lower() or "no gas" in desc.lower()
    
    def test_generate_description_payable(self):
        """Test description generation for payable function."""
        from abi_to_mcp.mapper.function_mapper import FunctionMapper
        from abi_to_mcp.mapper.type_mapper import TypeMapper
        from abi_to_mcp.core.models import ABIFunction, StateMutability
        
        type_mapper = TypeMapper()
        mapper = FunctionMapper(type_mapper)
        
        func = ABIFunction(
            name="deposit",
            inputs=[],
            outputs=[],
            state_mutability=StateMutability.PAYABLE,
        )
        
        desc = mapper.generate_description(func)
        assert "ETH" in desc or "payable" in desc.lower()
    
    def test_components_to_dicts_with_nested_components(self):
        """Test _components_to_dicts with nested ABIParameter."""
        from abi_to_mcp.mapper.function_mapper import FunctionMapper
        from abi_to_mcp.mapper.type_mapper import TypeMapper
        from abi_to_mcp.core.models import ABIParameter
        
        type_mapper = TypeMapper()
        mapper = FunctionMapper(type_mapper)
        
        inner = [ABIParameter(name="value", type="uint256")]
        components = [ABIParameter(name="data", type="tuple", components=inner)]
        
        result = mapper._components_to_dicts(components)
        assert result[0]["components"] == [{"name": "value", "type": "uint256"}]


class TestSchemaBuilderEdgeCases:
    """Test edge cases in schema builder."""
    
    def test_build_schema_with_properties(self):
        """Test schema building with properties."""
        from abi_to_mcp.mapper.schema_builder import SchemaBuilder
        
        builder = SchemaBuilder()
        builder.title("TestSchema")
        builder.description("A test schema")
        builder.add_property("name", {"type": "string"}, required=True)
        builder.add_property("age", {"type": "integer"}, required=False)
        
        schema = builder.build()
        assert schema["title"] == "TestSchema"
        assert schema["description"] == "A test schema"
        assert "name" in schema["properties"]
        assert "age" in schema["properties"]
        assert "name" in schema["required"]
        assert "age" not in schema["required"]
    
    def test_build_tool_schema_function(self):
        """Test the build_tool_schema helper function."""
        from abi_to_mcp.mapper.schema_builder import build_tool_schema
        
        schema = build_tool_schema(
            name="test_tool",
            description="A test tool",
            parameters=[
                {"name": "param1", "schema": {"type": "string"}},
                {"name": "param2", "schema": {"type": "integer"}},
            ],
            required=["param1"],
        )
        
        assert schema["name"] == "test_tool"
        assert schema["description"] == "A test tool"
        assert "inputSchema" in schema
        assert "param1" in schema["inputSchema"]["properties"]
        assert "param2" in schema["inputSchema"]["properties"]
"""Tests for edge cases in function and event mapping.

This module contains tests for edge cases in the FunctionMapper and
EventMapper classes that map ABI definitions to MCP tool/resource definitions.
"""


from abi_to_mcp.core.models import ABIEvent
from abi_to_mcp.mapper.event_mapper import EventMapper


class TestFunctionMapperEdgeCases:
    """Edge cases in function to tool mapping."""

    @pytest.fixture
    def mapper(self):
        return FunctionMapper(TypeMapper())

    def test_function_with_no_params_no_returns(self, mapper):
        """Map a function that takes nothing and returns nothing."""
        func = ABIFunction(
            name="pause",
            inputs=[],
            outputs=[],
            state_mutability=StateMutability.NONPAYABLE,
        )
        
        tool = mapper.map_function(func)
        
        assert tool.name == "pause"
        assert len(tool.parameters) == 0
        assert tool.tool_type == "write"

    def test_function_with_empty_param_names(self, mapper):
        """Parameters with empty names should get synthetic names."""
        func = ABIFunction(
            name="getValue",
            inputs=[
                ABIParameter(name="", type="uint256"),
                ABIParameter(name="", type="address"),
            ],
            outputs=[ABIParameter(name="", type="uint256")],
            state_mutability=StateMutability.VIEW,
        )
        
        tool = mapper.map_function(func)
        
        # Should generate unique names
        assert len(tool.parameters) == 2
        param_names = [p.name for p in tool.parameters]
        assert len(set(param_names)) == 2  # All unique
        # Names should be valid identifiers
        assert all(name.isidentifier() or "_" in name for name in param_names)

    def test_read_only_function(self, mapper):
        """View functions should be mapped as read-only tools."""
        func = ABIFunction(
            name="balanceOf",
            inputs=[ABIParameter(name="account", type="address")],
            outputs=[ABIParameter(name="", type="uint256")],
            state_mutability=StateMutability.VIEW,
        )
        
        tool = mapper.map_function(func)
        
        assert tool.tool_type == "read"
        assert tool.is_read_only
        assert "read" in tool.description.lower() or "no gas" in tool.description.lower()

    def test_pure_function(self, mapper):
        """Pure functions should also be mapped as read-only tools."""
        func = ABIFunction(
            name="add",
            inputs=[
                ABIParameter(name="a", type="uint256"),
                ABIParameter(name="b", type="uint256"),
            ],
            outputs=[ABIParameter(name="", type="uint256")],
            state_mutability=StateMutability.PURE,
        )
        
        tool = mapper.map_function(func)
        
        assert tool.tool_type == "read"
        assert tool.is_read_only

    def test_payable_function(self, mapper):
        """Payable functions should be marked specially."""
        func = ABIFunction(
            name="deposit",
            inputs=[],
            outputs=[],
            state_mutability=StateMutability.PAYABLE,
        )
        
        tool = mapper.map_function(func)
        
        assert tool.tool_type == "write_payable"
        assert tool.is_payable
        assert "ETH" in tool.description or "⚠️" in tool.description

    def test_very_long_function_name(self, mapper):
        """Functions with very long names should still work."""
        long_name = "thisIsAVeryLongFunctionNameThatExceedsNormalLimits" * 2
        
        func = ABIFunction(
            name=long_name,
            inputs=[],
            outputs=[],
            state_mutability=StateMutability.VIEW,
        )
        
        tool = mapper.map_function(func)
        
        assert tool.original_name == long_name
        # Snake case name should be valid Python identifier
        assert "_" in tool.name or tool.name.isidentifier()

    def test_function_returning_multiple_values(self, mapper):
        """Functions with multiple return values should create object schema."""
        func = ABIFunction(
            name="getReserves",
            inputs=[],
            outputs=[
                ABIParameter(name="reserve0", type="uint112"),
                ABIParameter(name="reserve1", type="uint112"),
                ABIParameter(name="blockTimestampLast", type="uint32"),
            ],
            state_mutability=StateMutability.VIEW,
        )
        
        tool = mapper.map_function(func)
        
        # Return schema should be an object with multiple properties
        assert tool.return_schema.get("type") == "object" or len(tool.return_schema.get("properties", {})) > 0

    def test_function_returning_single_value(self, mapper):
        """Functions with single return value."""
        func = ABIFunction(
            name="totalSupply",
            inputs=[],
            outputs=[ABIParameter(name="", type="uint256")],
            state_mutability=StateMutability.VIEW,
        )
        
        tool = mapper.map_function(func)
        
        # Should have a return schema
        assert tool.return_schema is not None

    def test_camel_case_to_snake_case_conversion(self, mapper):
        """CamelCase function names should convert to snake_case."""
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
        
        tool = mapper.map_function(func)
        
        assert tool.name == "transfer_from"
        assert tool.original_name == "transferFrom"

    def test_uppercase_acronyms(self, mapper):
        """Handle function names with uppercase acronyms."""
        func = ABIFunction(
            name="getETHBalance",
            inputs=[ABIParameter(name="account", type="address")],
            outputs=[ABIParameter(name="", type="uint256")],
            state_mutability=StateMutability.VIEW,
        )
        
        tool = mapper.map_function(func)
        
        # Should handle acronyms reasonably
        assert tool.name.startswith("get_")
        assert "balance" in tool.name.lower()

    def test_function_with_tuple_parameter(self, mapper):
        """Functions with tuple parameters should generate object schemas."""
        func = ABIFunction(
            name="executeSwap",
            inputs=[
                ABIParameter(
                    name="params",
                    type="tuple",
                    components=[
                        ABIParameter(name="tokenIn", type="address"),
                        ABIParameter(name="tokenOut", type="address"),
                        ABIParameter(name="amount", type="uint256"),
                    ]
                )
            ],
            outputs=[ABIParameter(name="amountOut", type="uint256")],
            state_mutability=StateMutability.NONPAYABLE,
        )
        
        tool = mapper.map_function(func)
        
        assert len(tool.parameters) == 1
        param_schema = tool.parameters[0].json_schema
        assert param_schema.get("type") == "object"

    def test_function_with_array_parameter(self, mapper):
        """Functions with array parameters should generate array schemas."""
        func = ABIFunction(
            name="batchTransfer",
            inputs=[
                ABIParameter(name="recipients", type="address[]"),
                ABIParameter(name="amounts", type="uint256[]"),
            ],
            outputs=[ABIParameter(name="", type="bool")],
            state_mutability=StateMutability.NONPAYABLE,
        )
        
        tool = mapper.map_function(func)
        
        assert len(tool.parameters) == 2
        for param in tool.parameters:
            assert param.json_schema.get("type") == "array"

    def test_python_signature_generation(self, mapper):
        """Generated Python signatures should be valid."""
        func = ABIFunction(
            name="transfer",
            inputs=[
                ABIParameter(name="to", type="address"),
                ABIParameter(name="amount", type="uint256"),
            ],
            outputs=[ABIParameter(name="", type="bool")],
            state_mutability=StateMutability.NONPAYABLE,
        )
        
        tool = mapper.map_function(func)
        
        # Signature should be parseable
        assert "def transfer(" in tool.python_signature
        assert "simulate" in tool.python_signature  # Write functions have simulate param

    def test_read_function_no_simulate_param(self, mapper):
        """Read-only functions should not have simulate parameter."""
        func = ABIFunction(
            name="balanceOf",
            inputs=[ABIParameter(name="account", type="address")],
            outputs=[ABIParameter(name="", type="uint256")],
            state_mutability=StateMutability.VIEW,
        )
        
        tool = mapper.map_function(func)
        
        # Simulate should not be in read-only function signature
        assert "simulate" not in tool.python_signature


class TestEventMapperEdgeCases:
    """Edge cases in event to resource mapping."""

    @pytest.fixture
    def mapper(self):
        return EventMapper(TypeMapper())

    def test_anonymous_event(self, mapper):
        """Anonymous events should be handled specially."""
        event = ABIEvent(
            name="AnonymousTransfer",
            inputs=[
                ABIParameter(name="from", type="address", indexed=True),
                ABIParameter(name="to", type="address", indexed=True),
            ],
            anonymous=True,
        )
        
        resource = mapper.map_event(event)
        
        # Should still create a valid resource
        assert resource.name is not None
        assert resource.original_name == "AnonymousTransfer"

    def test_event_with_no_params(self, mapper):
        """Events with no parameters are valid."""
        event = ABIEvent(
            name="Paused",
            inputs=[],
            anonymous=False,
        )
        
        resource = mapper.map_event(event)
        
        assert resource.name == "paused"
        assert len(resource.fields) == 0

    def test_event_all_indexed(self, mapper):
        """Event with all indexed parameters (max 3)."""
        event = ABIEvent(
            name="ThreeWayTransfer",
            inputs=[
                ABIParameter(name="from", type="address", indexed=True),
                ABIParameter(name="to", type="address", indexed=True),
                ABIParameter(name="operator", type="address", indexed=True),
            ],
            anonymous=False,
        )
        
        resource = mapper.map_event(event)
        
        assert len(resource.indexed_fields) == 3
        assert len(resource.data_fields) == 0

    def test_event_mixed_indexed_data(self, mapper):
        """Event with both indexed and non-indexed parameters."""
        event = ABIEvent(
            name="Transfer",
            inputs=[
                ABIParameter(name="from", type="address", indexed=True),
                ABIParameter(name="to", type="address", indexed=True),
                ABIParameter(name="value", type="uint256", indexed=False),
            ],
            anonymous=False,
        )
        
        resource = mapper.map_event(event)
        
        assert len(resource.indexed_fields) == 2
        assert len(resource.data_fields) == 1

    def test_event_name_to_snake_case(self, mapper):
        """Event names should be converted to snake_case."""
        event = ABIEvent(
            name="ApprovalForAll",
            inputs=[
                ABIParameter(name="owner", type="address", indexed=True),
                ABIParameter(name="operator", type="address", indexed=True),
                ABIParameter(name="approved", type="bool", indexed=False),
            ],
            anonymous=False,
        )
        
        resource = mapper.map_event(event)
        
        assert resource.name == "approval_for_all"
        assert resource.original_name == "ApprovalForAll"

    def test_event_uri_template(self, mapper):
        """Events should have proper URI templates."""
        event = ABIEvent(
            name="Transfer",
            inputs=[
                ABIParameter(name="from", type="address", indexed=True),
                ABIParameter(name="to", type="address", indexed=True),
                ABIParameter(name="value", type="uint256", indexed=False),
            ],
            anonymous=False,
        )
        
        resource = mapper.map_event(event)
        
        assert resource.uri_template.startswith("events://")
        assert "transfer" in resource.uri_template.lower()

    def test_event_function_name(self, mapper):
        """Events should have proper Python function names."""
        event = ABIEvent(
            name="TokensLocked",
            inputs=[
                ABIParameter(name="user", type="address", indexed=True),
                ABIParameter(name="amount", type="uint256", indexed=False),
            ],
            anonymous=False,
        )
        
        resource = mapper.map_event(event)
        
        assert "get_" in resource.function_name
        assert "events" in resource.function_name or "tokens_locked" in resource.function_name

    def test_event_with_array_data(self, mapper):
        """Events can have array parameters in data section."""
        event = ABIEvent(
            name="BatchMint",
            inputs=[
                ABIParameter(name="operator", type="address", indexed=True),
                ABIParameter(name="ids", type="uint256[]", indexed=False),
                ABIParameter(name="amounts", type="uint256[]", indexed=False),
            ],
            anonymous=False,
        )
        
        resource = mapper.map_event(event)
        
        # The array fields should be in data (non-indexed)
        assert len(resource.data_fields) == 2
        assert len(resource.indexed_fields) == 1

    def test_event_with_tuple_data(self, mapper):
        """Events can have tuple parameters."""
        event = ABIEvent(
            name="ConfigUpdated",
            inputs=[
                ABIParameter(name="admin", type="address", indexed=True),
                ABIParameter(
                    name="config",
                    type="tuple",
                    indexed=False,
                    components=[
                        ABIParameter(name="fee", type="uint256"),
                        ABIParameter(name="enabled", type="bool"),
                    ]
                ),
            ],
            anonymous=False,
        )
        
        resource = mapper.map_event(event)
        
        assert len(resource.fields) == 2
        # The tuple field should have an object schema
        config_field = next(f for f in resource.fields if f.original_name == "config")
        assert config_field.json_schema.get("type") == "object"


class TestSnakeCaseConversion:
    """Test snake_case conversion edge cases."""

    @pytest.fixture
    def func_mapper(self):
        return FunctionMapper(TypeMapper())

    @pytest.fixture
    def event_mapper(self):
        return EventMapper(TypeMapper())

    def test_simple_camel_case(self, func_mapper):
        """Simple camelCase conversion."""
        func = ABIFunction(
            name="transferFrom",
            inputs=[],
            outputs=[],
            state_mutability=StateMutability.VIEW,
        )
        tool = func_mapper.map_function(func)
        assert tool.name == "transfer_from"

    def test_consecutive_capitals(self, func_mapper):
        """Handle consecutive capital letters."""
        func = ABIFunction(
            name="getUSDPrice",
            inputs=[],
            outputs=[],
            state_mutability=StateMutability.VIEW,
        )
        tool = func_mapper.map_function(func)
        # Should handle USD reasonably
        assert "get" in tool.name
        assert "price" in tool.name

    def test_already_snake_case(self, func_mapper):
        """Already snake_case names should work."""
        func = ABIFunction(
            name="get_balance",
            inputs=[],
            outputs=[],
            state_mutability=StateMutability.VIEW,
        )
        tool = func_mapper.map_function(func)
        assert tool.name == "get_balance"

    def test_single_word(self, func_mapper):
        """Single word names should work."""
        func = ABIFunction(
            name="pause",
            inputs=[],
            outputs=[],
            state_mutability=StateMutability.VIEW,
        )
        tool = func_mapper.map_function(func)
        assert tool.name == "pause"

    def test_numbers_in_name(self, func_mapper):
        """Names with numbers should work."""
        func = ABIFunction(
            name="getV2Price",
            inputs=[],
            outputs=[],
            state_mutability=StateMutability.VIEW,
        )
        tool = func_mapper.map_function(func)
        assert "get" in tool.name
        assert "v2" in tool.name.lower() or "2" in tool.name


class TestDescriptionGeneration:
    """Test human-readable description generation."""

    @pytest.fixture
    def mapper(self):
        return FunctionMapper(TypeMapper())

    def test_read_function_description(self, mapper):
        """Read functions should mention they're read-only."""
        func = ABIFunction(
            name="balanceOf",
            inputs=[ABIParameter(name="account", type="address")],
            outputs=[ABIParameter(name="", type="uint256")],
            state_mutability=StateMutability.VIEW,
        )
        
        tool = mapper.map_function(func)
        
        # Description should mention read-only or no gas
        desc_lower = tool.description.lower()
        assert "read" in desc_lower or "no gas" in desc_lower

    def test_write_function_description(self, mapper):
        """Write functions should mention they modify state."""
        func = ABIFunction(
            name="transfer",
            inputs=[
                ABIParameter(name="to", type="address"),
                ABIParameter(name="amount", type="uint256"),
            ],
            outputs=[ABIParameter(name="", type="bool")],
            state_mutability=StateMutability.NONPAYABLE,
        )
        
        tool = mapper.map_function(func)
        
        # Description should mention state modification or gas
        desc_lower = tool.description.lower()
        assert "state" in desc_lower or "gas" in desc_lower or "⚠️" in tool.description

    def test_payable_function_description(self, mapper):
        """Payable functions should mention ETH requirement."""
        func = ABIFunction(
            name="deposit",
            inputs=[],
            outputs=[],
            state_mutability=StateMutability.PAYABLE,
        )
        
        tool = mapper.map_function(func)
        
        # Description should mention ETH
        assert "ETH" in tool.description or "⚠️" in tool.description
