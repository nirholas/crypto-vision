"""Tests for schema builder module."""

import pytest

from abi_to_mcp.mapper.schema_builder import SchemaBuilder, build_tool_schema


def test_schema_builder_basic():
    """Test basic schema building."""
    builder = SchemaBuilder()
    builder.title("Test Schema")
    builder.description("A test schema")
    builder.add_property("name", {"type": "string"}, required=True)
    
    schema = builder.build()
    
    assert schema["type"] == "object"
    assert schema["title"] == "Test Schema"
    assert schema["description"] == "A test schema"
    assert "name" in schema["properties"]
    assert "name" in schema["required"]


def test_schema_builder_optional_property():
    """Test optional property."""
    builder = SchemaBuilder()
    builder.add_property("optional", {"type": "string"}, required=False)
    builder.add_property("required", {"type": "string"}, required=True)
    
    schema = builder.build()
    
    assert "optional" in schema["properties"]
    assert "required" in schema["properties"]
    assert "optional" not in schema["required"]
    assert "required" in schema["required"]


def test_schema_builder_multiple_properties():
    """Test multiple properties."""
    builder = SchemaBuilder()
    builder.add_property("prop1", {"type": "string"})
    builder.add_property("prop2", {"type": "number"})
    builder.add_property("prop3", {"type": "boolean"})
    
    schema = builder.build()
    
    assert len(schema["properties"]) == 3


def test_schema_builder_no_additional_properties():
    """Test that additionalProperties is set to false."""
    builder = SchemaBuilder()
    schema = builder.build()
    
    assert schema["additionalProperties"] is False


def test_build_tool_schema():
    """Test tool schema builder helper."""
    parameters = [
        {"name": "to", "schema": {"type": "string"}},
        {"name": "amount", "schema": {"type": "string"}}
    ]
    
    tool_schema = build_tool_schema(
        name="transfer",
        description="Transfer tokens",
        parameters=parameters,
        required=["to", "amount"]
    )
    
    assert tool_schema["name"] == "transfer"
    assert tool_schema["description"] == "Transfer tokens"
    assert "inputSchema" in tool_schema
    assert tool_schema["inputSchema"]["type"] == "object"
    assert len(tool_schema["inputSchema"]["properties"]) == 2
    assert tool_schema["inputSchema"]["required"] == ["to", "amount"]


def test_build_tool_schema_no_required():
    """Test tool schema with no required parameters."""
    tool_schema = build_tool_schema(
        name="test",
        description="Test tool",
        parameters=[],
        required=[]
    )
    
    assert tool_schema["inputSchema"]["required"] == []
    assert tool_schema["inputSchema"]["properties"] == {}
