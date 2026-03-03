"""Tests for malformed and invalid ABI inputs.

This module contains tests that verify the parser correctly handles
malformed, invalid, and edge-case ABI inputs with appropriate error
messages.
"""

import pytest

from abi_to_mcp.parser.abi_parser import ABIParser
from abi_to_mcp.core.exceptions import ABIParseError


class TestMalformedABI:
    """Test handling of malformed ABI structures."""

    @pytest.fixture
    def parser(self):
        """Create a fresh parser instance."""
        return ABIParser()

    def test_abi_not_a_list_dict(self, parser):
        """ABI must be a list, not a dict."""
        with pytest.raises(ABIParseError, match="must be a list"):
            parser.parse({"type": "function", "name": "test"})

    def test_abi_not_a_list_string(self, parser):
        """ABI must be a list, not a string."""
        with pytest.raises(ABIParseError, match="must be a list"):
            parser.parse("not an abi")

    def test_abi_not_a_list_none(self, parser):
        """ABI must be a list, not None."""
        with pytest.raises(ABIParseError, match="must be a list"):
            parser.parse(None)

    def test_entry_not_a_dict(self, parser):
        """Each ABI entry must be a dictionary."""
        with pytest.raises(ABIParseError):
            parser.parse(["not a dict", {"type": "function", "name": "test"}])

    def test_missing_function_name(self, parser):
        """Functions must have names (except constructor/fallback/receive)."""
        # Note: The parser allows empty names for backwards compatibility,
        # but validation should catch this
        abi = [{"type": "function", "inputs": [], "outputs": []}]
        
        errors = parser.validate(abi)
        assert any("name" in e.lower() for e in errors)

    def test_invalid_state_mutability(self, parser):
        """State mutability must be a valid value."""
        errors = parser.validate([{
            "type": "function",
            "name": "test",
            "stateMutability": "invalid_value"
        }])
        
        assert any("stateMutability" in e for e in errors)

    def test_valid_state_mutability_values(self, parser):
        """Valid state mutability values should pass validation."""
        for sm in ["pure", "view", "nonpayable", "payable"]:
            errors = parser.validate([{
                "type": "function",
                "name": "test",
                "inputs": [],
                "outputs": [],
                "stateMutability": sm
            }])
            # Should not have errors about stateMutability
            assert not any("stateMutability" in e for e in errors)

    def test_unknown_entry_type(self, parser):
        """Unknown entry types should be flagged in validation."""
        errors = parser.validate([{
            "type": "unknowntype",
            "name": "test"
        }])
        
        assert any("unknown" in e.lower() for e in errors)

    def test_empty_abi(self, parser):
        """Empty ABI should parse successfully."""
        parsed = parser.parse([])
        
        assert parsed.functions == []
        assert parsed.events == []
        assert parsed.errors == []
        assert parsed.detected_standard is None

    def test_invalid_function_name_starting_with_number(self, parser):
        """Function names cannot start with a number."""
        errors = parser.validate([{
            "type": "function",
            "name": "123invalid",
            "inputs": [],
            "outputs": [],
            "stateMutability": "view"
        }])
        
        assert any("invalid" in e.lower() or "name" in e.lower() for e in errors)

    def test_valid_function_name_with_underscore(self, parser):
        """Function names can start with underscore."""
        errors = parser.validate([{
            "type": "function",
            "name": "_privateFunc",
            "inputs": [],
            "outputs": [],
            "stateMutability": "view"
        }])
        
        # Should not have name-related errors
        name_errors = [e for e in errors if "name" in e.lower() and "invalid" in e.lower()]
        assert len(name_errors) == 0

    def test_constructor_without_name(self, parser):
        """Constructor entries don't require a name field."""
        parsed = parser.parse([{
            "type": "constructor",
            "inputs": [{"name": "initialOwner", "type": "address"}],
            "stateMutability": "nonpayable"
        }])
        
        assert parsed.has_constructor

    def test_fallback_without_name(self, parser):
        """Fallback entries don't require a name field."""
        parsed = parser.parse([{
            "type": "fallback",
            "stateMutability": "payable"
        }])
        
        assert parsed.has_fallback

    def test_receive_without_name(self, parser):
        """Receive entries don't require a name field."""
        parsed = parser.parse([{
            "type": "receive",
            "stateMutability": "payable"
        }])
        
        assert parsed.has_receive

    def test_function_with_missing_inputs(self, parser):
        """Functions with missing inputs should parse with empty list."""
        parsed = parser.parse([{
            "type": "function",
            "name": "noInputs",
            "outputs": [{"name": "", "type": "uint256"}],
            "stateMutability": "view"
        }])
        
        func = parsed.functions[0]
        assert func.name == "noInputs"
        assert len(func.inputs) == 0

    def test_function_with_missing_outputs(self, parser):
        """Functions with missing outputs should parse with empty list."""
        parsed = parser.parse([{
            "type": "function",
            "name": "noOutputs",
            "inputs": [{"name": "value", "type": "uint256"}],
            "stateMutability": "nonpayable"
        }])
        
        func = parsed.functions[0]
        assert func.name == "noOutputs"
        assert len(func.outputs) == 0


class TestMalformedParameters:
    """Test handling of malformed parameter definitions."""

    @pytest.fixture
    def parser(self):
        """Create a fresh parser instance."""
        return ABIParser()

    def test_parameter_with_empty_name(self, parser):
        """Parameters with empty names should be allowed (common in outputs)."""
        parsed = parser.parse([{
            "type": "function",
            "name": "test",
            "inputs": [],
            "outputs": [{"name": "", "type": "uint256"}],
            "stateMutability": "view"
        }])
        
        assert len(parsed.functions[0].outputs) == 1
        assert parsed.functions[0].outputs[0].name == ""

    def test_parameter_missing_name_field(self, parser):
        """Parameters missing name field should default to empty string."""
        parsed = parser.parse([{
            "type": "function",
            "name": "test",
            "inputs": [{"type": "address"}],  # No name field
            "outputs": [],
            "stateMutability": "view"
        }])
        
        assert len(parsed.functions[0].inputs) == 1
        assert parsed.functions[0].inputs[0].name == ""

    def test_tuple_with_components(self, parser):
        """Tuple types with components should parse correctly."""
        parsed = parser.parse([{
            "type": "function",
            "name": "testTuple",
            "inputs": [{
                "name": "data",
                "type": "tuple",
                "components": [
                    {"name": "a", "type": "uint256"},
                    {"name": "b", "type": "address"}
                ]
            }],
            "outputs": [],
            "stateMutability": "nonpayable"
        }])
        
        param = parsed.functions[0].inputs[0]
        assert param.type == "tuple"
        assert param.components is not None
        assert len(param.components) == 2
        assert param.components[0].name == "a"
        assert param.components[1].name == "b"


class TestMalformedEvents:
    """Test handling of malformed event definitions."""

    @pytest.fixture
    def parser(self):
        """Create a fresh parser instance."""
        return ABIParser()

    def test_event_missing_name(self, parser):
        """Events must have names in validation."""
        errors = parser.validate([{
            "type": "event",
            "inputs": [{"name": "value", "type": "uint256", "indexed": False}]
        }])
        
        assert any("name" in e.lower() for e in errors)

    def test_anonymous_event(self, parser):
        """Anonymous events should parse correctly."""
        parsed = parser.parse([{
            "type": "event",
            "name": "AnonymousEvent",
            "inputs": [{"name": "value", "type": "uint256", "indexed": False}],
            "anonymous": True
        }])
        
        event = parsed.events[0]
        assert event.name == "AnonymousEvent"
        assert event.anonymous is True

    def test_event_with_indexed_params(self, parser):
        """Events with indexed parameters should parse correctly."""
        parsed = parser.parse([{
            "type": "event",
            "name": "Transfer",
            "inputs": [
                {"name": "from", "type": "address", "indexed": True},
                {"name": "to", "type": "address", "indexed": True},
                {"name": "value", "type": "uint256", "indexed": False}
            ],
            "anonymous": False
        }])
        
        event = parsed.events[0]
        assert len(event.indexed_inputs) == 2
        assert len(event.data_inputs) == 1

    def test_event_with_all_indexed_params(self, parser):
        """Events can have up to 3 indexed parameters for non-anonymous events."""
        parsed = parser.parse([{
            "type": "event",
            "name": "MaxIndexed",
            "inputs": [
                {"name": "a", "type": "address", "indexed": True},
                {"name": "b", "type": "address", "indexed": True},
                {"name": "c", "type": "address", "indexed": True}
            ],
            "anonymous": False
        }])
        
        event = parsed.events[0]
        assert len(event.indexed_inputs) == 3


class TestMalformedErrors:
    """Test handling of malformed custom error definitions."""

    @pytest.fixture
    def parser(self):
        """Create a fresh parser instance."""
        return ABIParser()

    def test_error_entry(self, parser):
        """Custom error entries should parse correctly."""
        parsed = parser.parse([{
            "type": "error",
            "name": "InsufficientBalance",
            "inputs": [
                {"name": "available", "type": "uint256"},
                {"name": "required", "type": "uint256"}
            ]
        }])
        
        assert len(parsed.errors) == 1
        error = parsed.errors[0]
        assert error.name == "InsufficientBalance"
        assert len(error.inputs) == 2

    def test_error_without_inputs(self, parser):
        """Custom errors without inputs should parse correctly."""
        parsed = parser.parse([{
            "type": "error",
            "name": "Unauthorized"
        }])
        
        error = parsed.errors[0]
        assert error.name == "Unauthorized"
        assert len(error.inputs) == 0
