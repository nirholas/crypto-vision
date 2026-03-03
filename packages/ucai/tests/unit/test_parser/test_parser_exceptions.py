"""Tests for parser exception handling to achieve 100% coverage."""

import pytest
from unittest.mock import patch, Mock


class TestABIParserExceptionHandling:
    """Test exception handling in ABI parser."""
    
    def test_parse_entry_raises_abi_parse_error_reraises(self):
        """Test that ABIParseError is re-raised as-is."""
        from abi_to_mcp.parser.abi_parser import ABIParser
        from abi_to_mcp.core.exceptions import ABIParseError
        
        parser = ABIParser()
        
        # Create a function parser that raises ABIParseError
        with patch.object(parser.function_parser, 'parse', side_effect=ABIParseError("Invalid function")):
            with pytest.raises(ABIParseError, match="Invalid function"):
                parser.parse([{"type": "function", "name": "test", "inputs": [], "outputs": []}])
    
    def test_parse_entry_generic_exception_wrapped(self):
        """Test that generic exceptions are wrapped in ABIParseError."""
        from abi_to_mcp.parser.abi_parser import ABIParser
        from abi_to_mcp.core.exceptions import ABIParseError
        
        parser = ABIParser()
        
        # Create a function parser that raises a generic exception
        with patch.object(parser.function_parser, 'parse', side_effect=ValueError("Unexpected error")):
            with pytest.raises(ABIParseError, match="Failed to parse entry 0"):
                parser.parse([{"type": "function", "name": "test", "inputs": [], "outputs": []}])
    
    def test_parse_entry_non_dict_exception(self):
        """Test exception handling for non-dict entry types."""
        from abi_to_mcp.parser.abi_parser import ABIParser
        from abi_to_mcp.core.exceptions import ABIParseError
        
        parser = ABIParser()
        
        # Pass a non-dict entry that causes an exception
        with pytest.raises(ABIParseError):
            parser.parse(["not a dict"])
    
    def test_validate_invalid_identifier(self):
        """Test validation catches invalid identifiers."""
        from abi_to_mcp.parser.abi_parser import ABIParser
        
        parser = ABIParser()
        
        # Test with invalid identifier starting with number
        errors = parser.validate([{"type": "function", "name": "123invalid", "inputs": [], "outputs": []}])
        assert any("invalid identifier" in err.lower() or "name" in err.lower() for err in errors)
    
    def test_is_valid_identifier_empty_name(self):
        """Test _is_valid_identifier with empty name."""
        from abi_to_mcp.parser.abi_parser import ABIParser
        
        parser = ABIParser()
        assert parser._is_valid_identifier("") is False
    
    def test_is_valid_identifier_starts_with_number(self):
        """Test _is_valid_identifier with name starting with number."""
        from abi_to_mcp.parser.abi_parser import ABIParser
        
        parser = ABIParser()
        assert parser._is_valid_identifier("1invalid") is False
    
    def test_is_valid_identifier_valid_underscore_start(self):
        """Test _is_valid_identifier with underscore start."""
        from abi_to_mcp.parser.abi_parser import ABIParser
        
        parser = ABIParser()
        assert parser._is_valid_identifier("_valid") is True
    
    def test_is_valid_identifier_special_chars(self):
        """Test _is_valid_identifier with special characters."""
        from abi_to_mcp.parser.abi_parser import ABIParser
        
        parser = ABIParser()
        assert parser._is_valid_identifier("invalid-name") is False
        assert parser._is_valid_identifier("invalid.name") is False


class TestErrorParserExceptionHandling:
    """Test exception handling in error parser."""
    
    def test_parse_handles_missing_name(self):
        """Test error parser handles missing name gracefully."""
        from abi_to_mcp.parser.error_parser import ErrorParser
        
        parser = ErrorParser()
        
        # Missing 'name' field uses default empty string
        result = parser.parse({"type": "error", "inputs": []})
        assert result.name == ""
    
    def test_parse_raises_exception_on_invalid_inputs(self):
        """Test error parser raises ABIParseError on truly malformed input."""
        from abi_to_mcp.parser.error_parser import ErrorParser
        from abi_to_mcp.core.exceptions import ABIParseError
        
        parser = ErrorParser()
        
        # Pass something that causes an exception during iteration
        with pytest.raises(ABIParseError):
            parser.parse({"type": "error", "inputs": "not_a_list"})


class TestEventParserExceptionHandling:
    """Test exception handling in event parser."""
    
    def test_parse_handles_missing_name(self):
        """Test event parser handles missing name gracefully."""
        from abi_to_mcp.parser.event_parser import EventParser
        
        parser = EventParser()
        
        # Missing 'name' field uses default empty string
        result = parser.parse({"type": "event", "inputs": []})
        assert result.name == ""
    
    def test_parse_raises_exception_on_invalid_inputs(self):
        """Test event parser raises ABIParseError on truly malformed input."""
        from abi_to_mcp.parser.event_parser import EventParser
        from abi_to_mcp.core.exceptions import ABIParseError
        
        parser = EventParser()
        
        # Pass something that causes an exception during iteration
        with pytest.raises(ABIParseError):
            parser.parse({"type": "event", "inputs": "not_a_list"})


class TestFunctionParserExceptionHandling:
    """Test exception handling in function parser."""
    
    def test_parse_handles_missing_name(self):
        """Test function parser handles missing name gracefully."""
        from abi_to_mcp.parser.function_parser import FunctionParser
        
        parser = FunctionParser()
        
        # Missing 'name' field uses default empty string
        result = parser.parse({"type": "function", "inputs": [], "outputs": []})
        assert result.name == ""
    
    def test_parse_raises_exception_on_invalid_inputs(self):
        """Test function parser raises ABIParseError on truly malformed input."""
        from abi_to_mcp.parser.function_parser import FunctionParser
        from abi_to_mcp.core.exceptions import ABIParseError
        
        parser = FunctionParser()
        
        # Pass something that causes an exception during iteration
        with pytest.raises(ABIParseError):
            parser.parse({"type": "function", "name": "test", "inputs": "not_a_list", "outputs": []})


class TestTypeParserExceptionHandling:
    """Test exception handling in type parser."""
    
    def test_parse_unknown_type(self):
        """Test type parser handles unknown types."""
        from abi_to_mcp.parser.type_parser import TypeParser
        
        parser = TypeParser()
        
        # Parse an unknown type
        result = parser.parse("unknownType123")
        
        # Should return something (base type or the type itself)
        assert result is not None


class TestABIParserDetectStandard:
    """Test detect_standard method."""
    
    def test_detect_standard_no_match(self):
        """Test detect_standard returns None when no standard matches."""
        from abi_to_mcp.parser.abi_parser import ABIParser
        from abi_to_mcp.core.models import ABIFunction, StateMutability
        
        parser = ABIParser()
        
        # Create functions that don't match any standard
        functions = [
            ABIFunction(
                name="customFunction",
                inputs=[],
                outputs=[],
                state_mutability=StateMutability.VIEW,
            )
        ]
        events = []
        
        result = parser.detect_standard(functions, events)
        assert result is None


class TestABIParserValidation:
    """Test validation edge cases."""
    
    def test_validate_non_list_abi(self):
        """Test validation with non-list ABI."""
        from abi_to_mcp.parser.abi_parser import ABIParser
        
        parser = ABIParser()
        errors = parser.validate("not a list")  # type: ignore
        
        assert len(errors) == 1
        assert "must be a list" in errors[0]
    
    def test_validate_non_dict_entry(self):
        """Test validation with non-dict entry."""
        from abi_to_mcp.parser.abi_parser import ABIParser
        
        parser = ABIParser()
        errors = parser.validate(["string entry", 123])
        
        assert len(errors) == 2
        assert all("must be an object" in err for err in errors)
    
    def test_validate_unknown_type(self):
        """Test validation with unknown entry type."""
        from abi_to_mcp.parser.abi_parser import ABIParser
        
        parser = ABIParser()
        errors = parser.validate([{"type": "unknownType", "name": "test"}])
        
        assert any("unknown type" in err.lower() for err in errors)
    
    def test_validate_missing_name(self):
        """Test validation with missing name."""
        from abi_to_mcp.parser.abi_parser import ABIParser
        
        parser = ABIParser()
        errors = parser.validate([{"type": "function", "inputs": [], "outputs": []}])
        
        assert any("missing 'name'" in err.lower() for err in errors)
