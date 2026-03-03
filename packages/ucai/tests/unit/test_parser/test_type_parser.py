"""Tests for type parser module."""

import pytest

from abi_to_mcp.parser.type_parser import TypeParser


def test_parse_basic_types():
    """Parse basic Solidity types."""
    parser = TypeParser()
    
    # Address
    parsed = parser.parse("address")
    assert parsed.base_type == "address"
    assert not parsed.is_array
    
    # Bool
    parsed = parser.parse("bool")
    assert parsed.base_type == "bool"
    
    # String
    parsed = parser.parse("string")
    assert parsed.base_type == "string"
    
    # Bytes
    parsed = parser.parse("bytes")
    assert parsed.base_type == "bytes"


def test_parse_uint_types():
    """Parse uint types."""
    parser = TypeParser()
    
    # Default uint -> uint256
    parsed = parser.parse("uint")
    assert parsed.base_type == "uint256"
    
    # Explicit uint256
    parsed = parser.parse("uint256")
    assert parsed.base_type == "uint256"
    
    # uint8
    parsed = parser.parse("uint8")
    assert parsed.base_type == "uint8"
    
    # uint128
    parsed = parser.parse("uint128")
    assert parsed.base_type == "uint128"


def test_parse_int_types():
    """Parse int types."""
    parser = TypeParser()
    
    # Default int -> int256
    parsed = parser.parse("int")
    assert parsed.base_type == "int256"
    
    # Explicit int256
    parsed = parser.parse("int256")
    assert parsed.base_type == "int256"
    
    # int64
    parsed = parser.parse("int64")
    assert parsed.base_type == "int64"


def test_parse_fixed_bytes():
    """Parse fixed-size bytes types."""
    parser = TypeParser()
    
    parsed = parser.parse("bytes32")
    assert parsed.base_type == "bytes32"
    
    parsed = parser.parse("bytes1")
    assert parsed.base_type == "bytes1"


def test_parse_dynamic_array():
    """Parse dynamic array types."""
    parser = TypeParser()
    
    # address[]
    parsed = parser.parse("address[]")
    assert parsed.base_type == "address"
    assert parsed.is_array
    assert parsed.array_dimensions == [None]  # None means dynamic
    
    # uint256[]
    parsed = parser.parse("uint256[]")
    assert parsed.base_type == "uint256"
    assert parsed.is_array


def test_parse_fixed_array():
    """Parse fixed-size array types."""
    parser = TypeParser()
    
    # uint256[5]
    parsed = parser.parse("uint256[5]")
    assert parsed.base_type == "uint256"
    assert parsed.is_array
    assert parsed.array_dimensions == [5]
    
    # bytes32[10]
    parsed = parser.parse("bytes32[10]")
    assert parsed.base_type == "bytes32"
    assert parsed.array_dimensions == [10]


def test_parse_nested_array():
    """Parse nested array types."""
    parser = TypeParser()
    
    # address[][]
    parsed = parser.parse("address[][]")
    assert parsed.base_type == "address"
    assert parsed.is_array
    assert parsed.array_dimensions == [None, None]
    
    # uint256[5][]
    parsed = parser.parse("uint256[5][]")
    assert parsed.base_type == "uint256"
    assert parsed.array_dimensions == [5, None]
    
    # uint256[][3]
    parsed = parser.parse("uint256[][3]")
    assert parsed.base_type == "uint256"
    assert parsed.array_dimensions == [None, 3]


def test_parse_tuple():
    """Parse tuple type."""
    parser = TypeParser()
    
    parsed = parser.parse("tuple")
    assert parsed.base_type == "tuple"
    assert parsed.is_tuple


def test_is_dynamic_type():
    """Test dynamic type detection."""
    parser = TypeParser()
    
    # Dynamic types
    assert parser.is_dynamic_type("string")
    assert parser.is_dynamic_type("bytes")
    assert parser.is_dynamic_type("address[]")
    assert parser.is_dynamic_type("uint256[]")
    
    # Static types
    assert not parser.is_dynamic_type("address")
    assert not parser.is_dynamic_type("uint256")
    assert not parser.is_dynamic_type("bool")
    assert not parser.is_dynamic_type("bytes32")
    assert not parser.is_dynamic_type("uint256[5]")


def test_normalize_types():
    """Test type normalization."""
    parser = TypeParser()
    
    # uint -> uint256
    parsed = parser.parse("uint")
    assert parsed.base_type == "uint256"
    
    # int -> int256
    parsed = parser.parse("int")
    assert parsed.base_type == "int256"
