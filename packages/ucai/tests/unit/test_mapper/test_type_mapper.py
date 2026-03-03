"""Tests for type mapper module."""

import pytest

from abi_to_mcp.mapper.type_mapper import TypeMapper


def test_parse_basic_types():
    """Test parsing basic Solidity types."""
    mapper = TypeMapper()
    
    # Address
    parsed = mapper.parse_type("address")
    assert parsed.base_type == "address"
    assert not parsed.is_array
    
    # Uint256
    parsed = mapper.parse_type("uint256")
    assert parsed.base_type == "uint256"


def test_to_json_schema_address():
    """Test address to JSON Schema."""
    mapper = TypeMapper()
    
    parsed = mapper.parse_type("address")
    schema = mapper.to_json_schema(parsed, "recipient")
    
    assert schema["type"] == "string"
    assert "pattern" in schema
    assert schema["description"]


def test_to_json_schema_uint():
    """Test uint to JSON Schema."""
    mapper = TypeMapper()
    
    parsed = mapper.parse_type("uint256")
    schema = mapper.to_json_schema(parsed, "amount")
    
    assert schema["type"] == "string"
    assert "pattern" in schema


def test_to_json_schema_bool():
    """Test bool to JSON Schema."""
    mapper = TypeMapper()
    
    parsed = mapper.parse_type("bool")
    schema = mapper.to_json_schema(parsed, "flag")
    
    assert schema["type"] == "boolean"


def test_to_json_schema_string():
    """Test string to JSON Schema."""
    mapper = TypeMapper()
    
    parsed = mapper.parse_type("string")
    schema = mapper.to_json_schema(parsed, "name")
    
    assert schema["type"] == "string"


def test_to_json_schema_bytes():
    """Test bytes to JSON Schema."""
    mapper = TypeMapper()
    
    # Dynamic bytes
    parsed = mapper.parse_type("bytes")
    schema = mapper.to_json_schema(parsed, "data")
    assert schema["type"] == "string"
    
    # Fixed bytes
    parsed = mapper.parse_type("bytes32")
    schema = mapper.to_json_schema(parsed, "hash")
    assert schema["type"] == "string"


def test_to_json_schema_dynamic_array():
    """Test dynamic array to JSON Schema."""
    mapper = TypeMapper()
    
    parsed = mapper.parse_type("address[]")
    schema = mapper.to_json_schema(parsed, "recipients")
    
    assert schema["type"] == "array"
    assert "items" in schema
    assert schema["items"]["type"] == "string"
    assert "minItems" not in schema  # Dynamic array


def test_to_json_schema_fixed_array():
    """Test fixed array to JSON Schema."""
    mapper = TypeMapper()
    
    parsed = mapper.parse_type("uint256[3]")
    schema = mapper.to_json_schema(parsed, "values")
    
    assert schema["type"] == "array"
    assert schema["minItems"] == 3
    assert schema["maxItems"] == 3


def test_to_json_schema_nested_array():
    """Test nested array to JSON Schema."""
    mapper = TypeMapper()
    
    parsed = mapper.parse_type("address[][]")
    schema = mapper.to_json_schema(parsed, "recipients")
    
    assert schema["type"] == "array"
    assert schema["items"]["type"] == "array"
    assert schema["items"]["items"]["type"] == "string"


def test_map_function_outputs_single():
    """Test mapping single function output."""
    mapper = TypeMapper()
    
    outputs = [{"name": "balance", "type": "uint256"}]
    schema = mapper.map_function_outputs(outputs)
    
    assert schema["type"] == "string"


def test_map_function_outputs_multiple():
    """Test mapping multiple function outputs."""
    mapper = TypeMapper()
    
    outputs = [
        {"name": "balance", "type": "uint256"},
        {"name": "owner", "type": "address"}
    ]
    schema = mapper.map_function_outputs(outputs)
    
    assert schema["type"] == "object"
    assert "properties" in schema
    assert len(schema["properties"]) == 2


def test_map_function_outputs_no_outputs():
    """Test mapping function with no outputs."""
    mapper = TypeMapper()
    
    schema = mapper.map_function_outputs([])
    
    assert schema["type"] == "null"
"""Full coverage tests for TypeMapper."""

from abi_to_mcp.mapper.type_mapper import SolidityType


class TestTypeMapperFullCoverage:
    """Complete coverage tests for TypeMapper."""

    @pytest.fixture
    def mapper(self):
        """Create a TypeMapper instance."""
        return TypeMapper()

    def test_parse_multi_dimensional_array(self, mapper):
        """Test parsing multi-dimensional arrays."""
        result = mapper.parse_type("address[][]")
        assert result.is_array is True
        # The base_type should be the inner array
        assert "address[]" in result.base_type or result.base_type == "address[]"

    def test_parse_fixed_multi_dimensional_array(self, mapper):
        """Test parsing fixed-size multi-dimensional arrays."""
        result = mapper.parse_type("uint256[3][5]")
        assert result.is_array is True
        assert result.array_length == 5  # Outer dimension

    def test_to_json_schema_fixed_array(self, mapper):
        """Test JSON schema for fixed-size arrays."""
        solidity_type = mapper.parse_type("uint256[5]")
        schema = mapper.to_json_schema(solidity_type)
        
        assert schema["type"] == "array"
        assert schema["minItems"] == 5
        assert schema["maxItems"] == 5

    def test_to_json_schema_dynamic_array(self, mapper):
        """Test JSON schema for dynamic arrays."""
        solidity_type = mapper.parse_type("address[]")
        schema = mapper.to_json_schema(solidity_type)
        
        assert schema["type"] == "array"
        assert "minItems" not in schema

    def test_to_json_schema_tuple(self, mapper):
        """Test JSON schema for tuple/struct types."""
        components = [
            {"name": "recipient", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ]
        solidity_type = mapper.parse_type("tuple", components=components)
        schema = mapper.to_json_schema(solidity_type)
        
        assert schema["type"] == "object"
        assert "recipient" in schema["properties"]
        assert "amount" in schema["properties"]
        assert schema["additionalProperties"] is False

    def test_to_json_schema_tuple_without_names(self, mapper):
        """Test JSON schema for tuple without field names."""
        components = [
            {"name": "", "type": "address"},
            {"name": "", "type": "uint256"},
        ]
        solidity_type = mapper.parse_type("tuple", components=components)
        schema = mapper.to_json_schema(solidity_type)
        
        assert schema["type"] == "object"
        # Should use field_0, field_1 naming
        assert "field_0" in schema["properties"] or "address" in str(schema)

    def test_to_json_schema_nested_tuple(self, mapper):
        """Test JSON schema for nested tuples."""
        inner_components = [
            {"name": "x", "type": "uint256"},
            {"name": "y", "type": "uint256"},
        ]
        components = [
            {"name": "id", "type": "uint256"},
            {"name": "position", "type": "tuple", "components": inner_components},
        ]
        solidity_type = mapper.parse_type("tuple", components=components)
        schema = mapper.to_json_schema(solidity_type)
        
        assert schema["type"] == "object"
        assert "id" in schema["properties"]
        assert "position" in schema["properties"]
        assert schema["properties"]["position"]["type"] == "object"

    def test_to_json_schema_tuple_array(self, mapper):
        """Test JSON schema for array of tuples."""
        components = [
            {"name": "addr", "type": "address"},
            {"name": "value", "type": "uint256"},
        ]
        solidity_type = mapper.parse_type("tuple[]", components=components)
        schema = mapper.to_json_schema(solidity_type)
        
        assert schema["type"] == "array"
        assert schema["items"]["type"] == "object"

    def test_to_json_schema_unknown_type(self, mapper):
        """Test JSON schema for unknown types."""
        # Create a SolidityType with an unknown base type
        unknown_type = SolidityType(base_type="unknownType123")
        schema = mapper.to_json_schema(unknown_type)
        
        assert schema["type"] == "string"
        assert "Unknown Solidity type" in schema.get("description", "")

    def test_to_json_schema_with_description(self, mapper):
        """Test JSON schema with parameter description."""
        solidity_type = mapper.parse_type("address")
        schema = mapper.to_json_schema(solidity_type, "The recipient address")
        
        assert "description" in schema

    def test_parse_bytes_type(self, mapper):
        """Test parsing bytes types."""
        result = mapper.parse_type("bytes")
        assert result.base_type == "bytes"
        assert result.is_array is False

    def test_parse_bytes32_type(self, mapper):
        """Test parsing bytes32 types."""
        result = mapper.parse_type("bytes32")
        assert result.base_type == "bytes32"
        assert result.is_array is False

    def test_parse_string_type(self, mapper):
        """Test parsing string types."""
        result = mapper.parse_type("string")
        assert result.base_type == "string"
        assert result.is_array is False

    def test_parse_bool_type(self, mapper):
        """Test parsing bool types."""
        result = mapper.parse_type("bool")
        assert result.base_type == "bool"
        assert result.is_array is False

    def test_to_json_schema_int_types(self, mapper):
        """Test JSON schema for int types."""
        for bits in [8, 16, 32, 64, 128, 256]:
            solidity_type = mapper.parse_type(f"int{bits}")
            schema = mapper.to_json_schema(solidity_type)
            assert schema["type"] in ["string", "integer"]

    def test_to_json_schema_uint_types(self, mapper):
        """Test JSON schema for uint types."""
        for bits in [8, 16, 32, 64, 128, 256]:
            solidity_type = mapper.parse_type(f"uint{bits}")
            schema = mapper.to_json_schema(solidity_type)
            assert schema["type"] in ["string", "integer"]

    def test_to_json_schema_address(self, mapper):
        """Test JSON schema for address type."""
        solidity_type = mapper.parse_type("address")
        schema = mapper.to_json_schema(solidity_type)
        
        assert schema["type"] == "string"
        assert "pattern" in schema

    def test_to_json_schema_bool(self, mapper):
        """Test JSON schema for bool type."""
        solidity_type = mapper.parse_type("bool")
        schema = mapper.to_json_schema(solidity_type)
        
        assert schema["type"] == "boolean"

    def test_to_json_schema_string(self, mapper):
        """Test JSON schema for string type."""
        solidity_type = mapper.parse_type("string")
        schema = mapper.to_json_schema(solidity_type)
        
        assert schema["type"] == "string"

    def test_to_json_schema_bytes(self, mapper):
        """Test JSON schema for bytes type."""
        solidity_type = mapper.parse_type("bytes")
        schema = mapper.to_json_schema(solidity_type)
        
        assert schema["type"] == "string"

    def test_to_json_schema_bytes_fixed(self, mapper):
        """Test JSON schema for fixed bytes types."""
        for size in [1, 4, 8, 16, 20, 32]:
            solidity_type = mapper.parse_type(f"bytes{size}")
            schema = mapper.to_json_schema(solidity_type)
            assert schema["type"] == "string"

    def test_custom_types_registry(self, mapper):
        """Test custom types can be registered."""
        mapper.custom_types["MyToken"] = {
            "type": "object",
            "properties": {"id": {"type": "string"}},
        }
        assert "MyToken" in mapper.custom_types

    def test_parse_single_dimension_array(self, mapper):
        """Test parsing single dimension array."""
        result = mapper.parse_type("uint256[]")
        assert result.is_array is True
        assert result.array_length is None
        assert result.base_type == "uint256"

    def test_parse_fixed_array(self, mapper):
        """Test parsing fixed size array."""
        result = mapper.parse_type("address[10]")
        assert result.is_array is True
        assert result.array_length == 10
        assert result.base_type == "address"

    def test_to_json_schema_array_of_arrays(self, mapper):
        """Test JSON schema for nested arrays."""
        # address[][] is an array of arrays
        solidity_type = mapper.parse_type("address[][]")
        schema = mapper.to_json_schema(solidity_type)
        
        assert schema["type"] == "array"
        assert schema["items"]["type"] == "array"

    def test_solidity_type_dataclass(self):
        """Test SolidityType dataclass."""
        st = SolidityType(
            base_type="address",
            is_array=True,
            array_length=5,
            is_tuple=False,
            tuple_components=None,
            tuple_names=None,
        )
        assert st.base_type == "address"
        assert st.is_array is True
        assert st.array_length == 5
        assert st.is_tuple is False

    def test_to_python_type_mapping(self, mapper):
        """Test getting Python type for Solidity types."""
        from abi_to_mcp.core.constants import SOLIDITY_TO_PYTHON_TYPE
        
        assert "address" in SOLIDITY_TO_PYTHON_TYPE
        assert "uint256" in SOLIDITY_TO_PYTHON_TYPE
        assert "bool" in SOLIDITY_TO_PYTHON_TYPE


class TestTypeMapperEdgeCases:
    """Edge case tests for TypeMapper."""

    @pytest.fixture
    def mapper(self):
        return TypeMapper()

    def test_empty_type_string(self, mapper):
        """Test handling of empty type string."""
        result = mapper.parse_type("")
        assert result.base_type == ""

    def test_whitespace_type_string(self, mapper):
        """Test handling of whitespace in type string."""
        # This tests robustness - may or may not handle well
        result = mapper.parse_type("uint256 ")
        assert "uint256" in result.base_type

    def test_complex_nested_tuple_array(self, mapper):
        """Test complex nested tuple array."""
        inner = [
            {"name": "a", "type": "uint256"},
            {"name": "b", "type": "address"},
        ]
        outer = [
            {"name": "items", "type": "tuple[]", "components": inner},
            {"name": "count", "type": "uint256"},
        ]
        
        solidity_type = mapper.parse_type("tuple", components=outer)
        schema = mapper.to_json_schema(solidity_type)
        
        assert schema["type"] == "object"
        assert "items" in schema["properties"]
        assert "count" in schema["properties"]
"""Additional type mapper tests for full coverage."""

import pytest


class TestTypeMapperMethodCoverage:
    """Tests targeting uncovered methods in TypeMapper."""

    @pytest.fixture
    def mapper(self):
        return TypeMapper()

    def test_to_python_type_array(self, mapper):
        """Test to_python_type for arrays."""
        solidity_type = mapper.parse_type("address[]")
        result = mapper.to_python_type(solidity_type)
        assert result == "List[str]"

    def test_to_python_type_nested_array(self, mapper):
        """Test to_python_type for nested arrays."""
        solidity_type = mapper.parse_type("uint256[][]")
        result = mapper.to_python_type(solidity_type)
        assert "List" in result

    def test_to_python_type_tuple(self, mapper):
        """Test to_python_type for tuples."""
        components = [
            {"name": "a", "type": "uint256"},
            {"name": "b", "type": "address"},
        ]
        solidity_type = mapper.parse_type("tuple", components=components)
        result = mapper.to_python_type(solidity_type)
        assert result == "Dict[str, Any]"

    def test_to_python_type_basic_types(self, mapper):
        """Test to_python_type for basic types."""
        # Note: uint256 maps to str (not int) due to size
        test_cases = [
            ("address", "str"),
            ("bool", "bool"),
            ("uint256", "str"),  # Large numbers as strings
            ("uint8", "int"),    # Small numbers as int
            ("bytes32", "str"),
            ("string", "str"),
        ]
        for solidity, expected in test_cases:
            solidity_type = mapper.parse_type(solidity)
            result = mapper.to_python_type(solidity_type)
            assert result == expected, f"Failed for {solidity}"

    def test_camel_to_readable(self, mapper):
        """Test _camel_to_readable conversion."""
        test_cases = [
            ("balanceOf", "Balance of"),
            ("getTokenURI", "Get token u r i"),
            ("name", "Name"),
            ("totalSupply", "Total supply"),
        ]
        for camel, expected in test_cases:
            result = mapper._camel_to_readable(camel)
            assert result == expected, f"Failed for {camel}"

    def test_map_function_params(self, mapper):
        """Test map_function_params."""
        params = [
            {"name": "recipient", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ]
        properties, required = mapper.map_function_params(params)
        
        assert "recipient" in properties
        assert "amount" in properties
        assert required == ["recipient", "amount"]

    def test_map_function_params_unnamed(self, mapper):
        """Test map_function_params with unnamed parameters."""
        params = [
            {"name": "", "type": "address"},
            {"type": "uint256"},  # No name at all
        ]
        properties, required = mapper.map_function_params(params)
        
        assert "arg0" in properties
        assert "arg1" in properties
        assert required == ["arg0", "arg1"]

    def test_map_function_params_with_tuple(self, mapper):
        """Test map_function_params with tuple type."""
        params = [
            {
                "name": "data",
                "type": "tuple",
                "components": [
                    {"name": "x", "type": "uint256"},
                    {"name": "y", "type": "uint256"},
                ],
            }
        ]
        properties, required = mapper.map_function_params(params)
        
        assert "data" in properties
        assert properties["data"]["type"] == "object"

    def test_map_function_outputs_empty(self, mapper):
        """Test map_function_outputs with no outputs."""
        result = mapper.map_function_outputs([])
        assert result == {"type": "null"}

    def test_map_function_outputs_single(self, mapper):
        """Test map_function_outputs with single output."""
        outputs = [{"name": "balance", "type": "uint256"}]
        result = mapper.map_function_outputs(outputs)
        
        assert result["type"] in ["string", "integer"]

    def test_map_function_outputs_multiple(self, mapper):
        """Test map_function_outputs with multiple outputs."""
        outputs = [
            {"name": "success", "type": "bool"},
            {"name": "value", "type": "uint256"},
        ]
        result = mapper.map_function_outputs(outputs)
        
        assert result["type"] == "object"
        assert "success" in result["properties"]
        assert "value" in result["properties"]

    def test_map_function_outputs_unnamed(self, mapper):
        """Test map_function_outputs with unnamed outputs."""
        outputs = [
            {"name": "", "type": "bool"},
            {"type": "uint256"},  # No name
        ]
        result = mapper.map_function_outputs(outputs)
        
        assert result["type"] == "object"
        assert "output0" in result["properties"]
        assert "output1" in result["properties"]

    def test_to_json_schema_with_param_name_generates_description(self, mapper):
        """Test that param_name generates a description."""
        solidity_type = mapper.parse_type("address")
        schema = mapper.to_json_schema(solidity_type, param_name="recipientAddress")
        
        # Should have description from camelCase conversion
        assert "description" in schema

    def test_to_json_schema_with_explicit_description(self, mapper):
        """Test that explicit description overrides generated."""
        solidity_type = mapper.parse_type("address")
        schema = mapper.to_json_schema(
            solidity_type,
            param_name="recipient",
            param_description="The recipient of the transfer"
        )
        
        assert schema["description"] == "The recipient of the transfer"
