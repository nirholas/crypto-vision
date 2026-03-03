"""Tests for complex Solidity type parsing.

This module contains tests for parsing complex Solidity types including
nested arrays, tuples, and multi-dimensional arrays.
"""

import pytest

from abi_to_mcp.parser.type_parser import TypeParser
from abi_to_mcp.mapper.type_mapper import TypeMapper


class TestNestedArrays:
    """Test parsing of nested array types."""

    @pytest.fixture
    def type_parser(self):
        return TypeParser()

    @pytest.fixture
    def type_mapper(self):
        return TypeMapper()

    def test_one_dimensional_dynamic_array(self, type_parser):
        """Parse uint256[]."""
        parsed = type_parser.parse("uint256[]")
        
        assert parsed.is_array
        assert parsed.array_dimensions is not None
        assert len(parsed.array_dimensions) == 1
        assert parsed.array_dimensions[0] is None  # Dynamic

    def test_one_dimensional_fixed_array(self, type_parser):
        """Parse address[5]."""
        parsed = type_parser.parse("address[5]")
        
        assert parsed.is_array
        assert parsed.array_dimensions is not None
        assert parsed.array_dimensions[0] == 5

    def test_two_dimensional_dynamic_array(self, type_parser):
        """Parse uint256[][]."""
        parsed = type_parser.parse("uint256[][]")
        
        assert parsed.is_array
        assert parsed.array_dimensions is not None
        assert len(parsed.array_dimensions) == 2
        # Both dimensions are dynamic
        assert parsed.array_dimensions[0] is None
        assert parsed.array_dimensions[1] is None

    def test_fixed_two_dimensional_array(self, type_parser):
        """Parse address[3][4] - 4 arrays of 3 addresses each."""
        parsed = type_parser.parse("address[3][4]")
        
        assert parsed.is_array
        assert parsed.array_dimensions is not None
        assert len(parsed.array_dimensions) == 2
        assert parsed.array_dimensions[0] == 3
        assert parsed.array_dimensions[1] == 4

    def test_mixed_array_dimensions(self, type_parser):
        """Parse bytes32[][5] - 5 dynamic arrays of bytes32."""
        parsed = type_parser.parse("bytes32[][5]")
        
        assert parsed.is_array
        assert parsed.array_dimensions is not None
        assert len(parsed.array_dimensions) == 2
        # First dimension is dynamic, second is fixed
        assert parsed.array_dimensions[0] is None
        assert parsed.array_dimensions[1] == 5

    def test_type_mapper_dynamic_array(self, type_mapper):
        """Map uint256[] to JSON Schema."""
        parsed = type_mapper.parse_type("uint256[]")
        schema = type_mapper.to_json_schema(parsed)
        
        assert schema["type"] == "array"
        assert "items" in schema
        # uint256 is represented as string with pattern
        assert schema["items"]["type"] == "string"

    def test_type_mapper_fixed_array(self, type_mapper):
        """Map bytes32[5] to JSON Schema with minItems/maxItems."""
        parsed = type_mapper.parse_type("bytes32[5]")
        schema = type_mapper.to_json_schema(parsed)
        
        assert schema["type"] == "array"
        assert schema["minItems"] == 5
        assert schema["maxItems"] == 5
        assert "items" in schema

    def test_type_mapper_nested_array(self, type_mapper):
        """Map uint256[][] to nested JSON Schema."""
        parsed = type_mapper.parse_type("uint256[][]")
        schema = type_mapper.to_json_schema(parsed)
        
        assert schema["type"] == "array"
        assert schema["items"]["type"] == "array"
        # The innermost items should be strings (uint256)
        assert schema["items"]["items"]["type"] == "string"

    def test_type_mapper_address_array(self, type_mapper):
        """Map address[] to JSON Schema with address pattern."""
        parsed = type_mapper.parse_type("address[]")
        schema = type_mapper.to_json_schema(parsed)
        
        assert schema["type"] == "array"
        assert schema["items"]["type"] == "string"
        assert "pattern" in schema["items"]  # Address pattern


class TestTupleTypes:
    """Test parsing of tuple (struct) types."""

    @pytest.fixture
    def type_parser(self):
        return TypeParser()

    @pytest.fixture
    def type_mapper(self):
        return TypeMapper()

    def test_simple_tuple(self, type_parser):
        """Parse tuple type marker."""
        parsed = type_parser.parse("tuple")
        
        assert parsed.is_tuple or parsed.base_type == "tuple"

    def test_type_mapper_simple_tuple(self, type_mapper):
        """Map simple tuple to JSON Schema."""
        components = [
            {"name": "token", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ]
        
        parsed = type_mapper.parse_type("tuple", components=components)
        
        assert parsed.is_tuple
        assert parsed.tuple_components is not None
        assert len(parsed.tuple_components) == 2
        assert parsed.tuple_names is not None
        assert parsed.tuple_names[0] == "token"
        assert parsed.tuple_names[1] == "amount"

    def test_type_mapper_tuple_to_schema(self, type_mapper):
        """Map tuple to JSON Schema with properties."""
        components = [
            {"name": "recipient", "type": "address"},
            {"name": "amount", "type": "uint256"},
            {"name": "deadline", "type": "uint256"},
        ]
        
        parsed = type_mapper.parse_type("tuple", components=components)
        schema = type_mapper.to_json_schema(parsed)
        
        assert schema["type"] == "object"
        assert "properties" in schema
        assert "recipient" in schema["properties"]
        assert "amount" in schema["properties"]
        assert "deadline" in schema["properties"]

    def test_nested_tuple(self, type_mapper):
        """Parse tuple containing another tuple."""
        components = [
            {"name": "outer", "type": "uint256"},
            {
                "name": "inner",
                "type": "tuple",
                "components": [
                    {"name": "a", "type": "address"},
                    {"name": "b", "type": "uint256"},
                ]
            }
        ]
        
        parsed = type_mapper.parse_type("tuple", components=components)
        
        assert parsed.is_tuple
        assert len(parsed.tuple_components) == 2
        # Second component should also be a tuple
        inner = parsed.tuple_components[1]
        assert inner.is_tuple
        assert len(inner.tuple_components) == 2

    def test_array_of_tuples(self, type_mapper):
        """Parse tuple[] with components."""
        components = [
            {"name": "token", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ]
        
        parsed = type_mapper.parse_type("tuple[]", components=components)
        
        assert parsed.is_array
        assert parsed.is_tuple
        assert parsed.tuple_components is not None

    def test_tuple_array_to_schema(self, type_mapper):
        """Map tuple[] to JSON Schema."""
        components = [
            {"name": "id", "type": "uint256"},
            {"name": "value", "type": "bytes32"},
        ]
        
        parsed = type_mapper.parse_type("tuple[]", components=components)
        schema = type_mapper.to_json_schema(parsed)
        
        assert schema["type"] == "array"
        assert schema["items"]["type"] == "object"
        assert "properties" in schema["items"]


class TestTypeNormalization:
    """Test that type aliases are normalized correctly."""

    @pytest.fixture
    def type_parser(self):
        return TypeParser()

    @pytest.fixture
    def type_mapper(self):
        return TypeMapper()

    def test_uint_normalizes_to_uint256(self, type_parser):
        """'uint' should be treated as 'uint256'."""
        parsed = type_parser.parse("uint")
        assert parsed.base_type == "uint256"

    def test_int_normalizes_to_int256(self, type_parser):
        """'int' should be treated as 'int256'."""
        parsed = type_parser.parse("int")
        assert parsed.base_type == "int256"

    def test_uint_with_size_preserved(self, type_parser):
        """'uint128' should remain 'uint128'."""
        parsed = type_parser.parse("uint128")
        assert parsed.base_type == "uint128"

    def test_int_with_size_preserved(self, type_parser):
        """'int64' should remain 'int64'."""
        parsed = type_parser.parse("int64")
        assert parsed.base_type == "int64"

    def test_dynamic_bytes(self, type_parser):
        """'bytes' should remain 'bytes' (dynamic)."""
        parsed = type_parser.parse("bytes")
        assert parsed.base_type == "bytes"

    def test_fixed_bytes(self, type_parser):
        """'bytes32' should remain 'bytes32'."""
        parsed = type_parser.parse("bytes32")
        assert parsed.base_type == "bytes32"

    def test_type_mapper_uint_normalization(self, type_mapper):
        """Type mapper should normalize 'uint' to 'uint256'."""
        parsed = type_mapper.parse_type("uint")
        assert parsed.base_type == "uint256"

    def test_type_mapper_int_normalization(self, type_mapper):
        """Type mapper should normalize 'int' to 'int256'."""
        parsed = type_mapper.parse_type("int")
        assert parsed.base_type == "int256"


class TestDynamicTypeDetection:
    """Test detection of dynamically-sized types."""

    @pytest.fixture
    def type_parser(self):
        return TypeParser()

    def test_string_is_dynamic(self, type_parser):
        """'string' is dynamically sized."""
        assert type_parser.is_dynamic_type("string")

    def test_bytes_is_dynamic(self, type_parser):
        """'bytes' (without size) is dynamically sized."""
        assert type_parser.is_dynamic_type("bytes")

    def test_bytes32_is_not_dynamic(self, type_parser):
        """'bytes32' is fixed size."""
        assert not type_parser.is_dynamic_type("bytes32")

    def test_dynamic_array_is_dynamic(self, type_parser):
        """'uint256[]' is dynamically sized."""
        assert type_parser.is_dynamic_type("uint256[]")

    def test_fixed_array_is_not_dynamic(self, type_parser):
        """'uint256[5]' is fixed size."""
        assert not type_parser.is_dynamic_type("uint256[5]")

    def test_address_is_not_dynamic(self, type_parser):
        """'address' is fixed size (20 bytes)."""
        assert not type_parser.is_dynamic_type("address")

    def test_uint256_is_not_dynamic(self, type_parser):
        """'uint256' is fixed size (32 bytes)."""
        assert not type_parser.is_dynamic_type("uint256")

    def test_bool_is_not_dynamic(self, type_parser):
        """'bool' is fixed size (1 byte)."""
        assert not type_parser.is_dynamic_type("bool")


class TestEdgeCaseTypes:
    """Test edge cases and unusual but valid types."""

    @pytest.fixture
    def type_parser(self):
        return TypeParser()

    @pytest.fixture
    def type_mapper(self):
        return TypeMapper()

    def test_bool_type(self, type_mapper):
        """Boolean type should map correctly."""
        parsed = type_mapper.parse_type("bool")
        schema = type_mapper.to_json_schema(parsed)
        
        assert schema["type"] == "boolean"

    def test_string_type(self, type_mapper):
        """String type should map correctly."""
        parsed = type_mapper.parse_type("string")
        schema = type_mapper.to_json_schema(parsed)
        
        assert schema["type"] == "string"

    def test_address_type(self, type_mapper):
        """Address type should have pattern validation."""
        parsed = type_mapper.parse_type("address")
        schema = type_mapper.to_json_schema(parsed)
        
        assert schema["type"] == "string"
        assert "pattern" in schema

    def test_bytes4_type(self, type_mapper):
        """bytes4 (function selector) should have pattern validation."""
        parsed = type_mapper.parse_type("bytes4")
        schema = type_mapper.to_json_schema(parsed)
        
        assert schema["type"] == "string"
        assert "pattern" in schema

    def test_small_uint_as_integer(self, type_mapper):
        """Small uints should be JSON integers."""
        parsed = type_mapper.parse_type("uint8")
        schema = type_mapper.to_json_schema(parsed)
        
        assert schema["type"] == "integer"
        assert "minimum" in schema
        assert schema["minimum"] == 0

    def test_large_uint_as_string(self, type_mapper):
        """Large uints should be JSON strings for precision."""
        parsed = type_mapper.parse_type("uint256")
        schema = type_mapper.to_json_schema(parsed)
        
        assert schema["type"] == "string"
        assert "pattern" in schema

    def test_small_int_as_integer(self, type_mapper):
        """Small ints should be JSON integers with negative minimum."""
        parsed = type_mapper.parse_type("int8")
        schema = type_mapper.to_json_schema(parsed)
        
        assert schema["type"] == "integer"
        assert "minimum" in schema
        assert schema["minimum"] < 0
