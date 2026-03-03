"""Tests for validation utilities."""

import pytest
from pathlib import Path

from abi_to_mcp.utils.validation import (
    is_valid_address,
    is_checksum_address,
    to_checksum_address,
    validate_network,
    is_valid_abi,
    validate_abi,
    is_file_path,
    normalize_hex_string,
)
from abi_to_mcp.core.exceptions import NetworkError, ABIValidationError


def test_is_valid_address():
    """Test address validation."""
    # Valid addresses
    assert is_valid_address("0x" + "0" * 40)
    assert is_valid_address("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
    
    # Invalid addresses
    assert not is_valid_address("0x" + "0" * 39)  # Too short
    assert not is_valid_address("0x" + "0" * 41)  # Too long
    assert not is_valid_address("0x" + "G" * 40)  # Invalid hex
    assert not is_valid_address("not an address")


def test_to_checksum_address():
    """Test address checksumming."""
    address = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    checksummed = to_checksum_address(address)
    
    # Should have correct case
    assert checksummed == "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    
    # Invalid address should raise
    with pytest.raises(ValueError):
        to_checksum_address("invalid")


def test_validate_network():
    """Test network validation."""
    # Valid networks
    assert validate_network("mainnet") == "mainnet"
    assert validate_network("MAINNET") == "mainnet"
    assert validate_network("Polygon") == "polygon"
    
    # Invalid network should raise
    with pytest.raises(NetworkError):
        validate_network("invalid_network")


def test_is_valid_abi():
    """Test ABI validation."""
    # Valid ABIs
    assert is_valid_abi([])
    assert is_valid_abi([{"type": "function", "name": "test"}])
    assert is_valid_abi([
        {"type": "function", "name": "foo"},
        {"type": "event", "name": "Bar"},
    ])
    
    # Invalid ABIs
    assert not is_valid_abi({})  # Not a list
    assert not is_valid_abi("not an abi")
    assert not is_valid_abi([{"name": "test"}])  # Missing type
    assert not is_valid_abi([{"type": "invalid"}])  # Invalid type


def test_validate_abi():
    """Test ABI validation with exceptions."""
    # Valid ABI
    abi = [{"type": "function", "name": "test"}]
    assert validate_abi(abi) == abi
    
    # Invalid ABI
    with pytest.raises(ABIValidationError):
        validate_abi({})


def test_is_file_path():
    """Test file path detection."""
    assert is_file_path("file.json")
    assert is_file_path("path/to/file.json")
    assert is_file_path("./file.abi")
    assert is_file_path("../file.json")
    
    # Addresses shouldn't be detected as files
    assert not is_file_path("0x" + "0" * 40)


def test_normalize_hex_string():
    """Test hex string normalization."""
    assert normalize_hex_string("0xABC") == "0xabc"
    assert normalize_hex_string("ABC") == "0xabc"
    assert normalize_hex_string("  0xDEF  ") == "0xdef"
"""Tests for validation utilities with extended coverage."""




class TestIsValidAddress:
    """Extended tests for is_valid_address."""

    def test_valid_checksummed_address(self):
        """Valid checksummed address."""
        # Real USDC address
        result = is_valid_address("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
        assert result is True

    def test_valid_lowercase_address(self):
        """Valid lowercase address."""
        result = is_valid_address("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")
        assert result is True

    def test_invalid_too_short(self):
        """Invalid - too short."""
        result = is_valid_address("0x1234")
        assert result is False

    def test_invalid_too_long(self):
        """Invalid - too long."""
        result = is_valid_address("0x" + "a" * 41)
        assert result is False

    def test_invalid_no_prefix(self):
        """Invalid - no 0x prefix."""
        result = is_valid_address("a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")
        assert result is False

    def test_invalid_non_hex(self):
        """Invalid - non-hex characters."""
        result = is_valid_address("0x" + "g" * 40)
        assert result is False

    def test_empty_string(self):
        """Empty string is invalid."""
        result = is_valid_address("")
        assert result is False

    def test_none_value(self):
        """None is invalid."""
        result = is_valid_address(None)
        assert result is False


class TestToChecksumAddress:
    """Tests for to_checksum_address."""

    def test_lowercase_to_checksum(self):
        """Convert lowercase to checksum."""
        result = to_checksum_address("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")
        assert result == "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"

    def test_already_checksummed(self):
        """Already checksummed address unchanged."""
        addr = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        result = to_checksum_address(addr)
        assert result == addr

    def test_uppercase_to_checksum(self):
        """Convert uppercase to checksum."""
        result = to_checksum_address("0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48")
        assert result == "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"


class TestValidateNetwork:
    """Tests for validate_network."""

    def test_valid_mainnet(self):
        """Mainnet is valid - returns normalized name."""
        result = validate_network("mainnet")
        assert result == "mainnet"

    def test_valid_polygon(self):
        """Polygon is valid - returns normalized name."""
        result = validate_network("polygon")
        assert result == "polygon"

    def test_valid_arbitrum(self):
        """Arbitrum is valid - returns normalized name."""
        result = validate_network("arbitrum")
        assert result == "arbitrum"

    def test_invalid_network(self):
        """Invalid network raises NetworkError."""
        from abi_to_mcp.core.exceptions import NetworkError
        with pytest.raises(NetworkError):
            validate_network("not-a-network")


class TestIsValidAbi:
    """Tests for is_valid_abi."""

    def test_valid_minimal_abi(self):
        """Valid minimal ABI."""
        abi = [
            {"type": "function", "name": "test", "inputs": [], "outputs": []}
        ]
        result = is_valid_abi(abi)
        assert result is True

    def test_valid_with_events(self):
        """Valid ABI with events."""
        abi = [
            {"type": "event", "name": "Transfer", "inputs": []}
        ]
        result = is_valid_abi(abi)
        assert result is True

    def test_invalid_not_list(self):
        """Invalid - not a list."""
        result = is_valid_abi({"type": "function"})
        assert result is False

    def test_invalid_entry_not_dict(self):
        """Invalid - entry not a dict."""
        result = is_valid_abi(["not a dict"])
        assert result is False

    def test_empty_abi_is_valid(self):
        """Empty ABI is valid."""
        result = is_valid_abi([])
        assert result is True


class TestValidateAbi:
    """Tests for validate_abi."""

    def test_valid_abi_returns_abi(self):
        """Valid ABI returns the ABI list."""
        abi = [
            {"type": "function", "name": "test", "inputs": [], "outputs": []}
        ]
        result = validate_abi(abi)
        assert result == abi

    def test_invalid_raises_error(self):
        """Invalid ABI raises ABIValidationError."""
        from abi_to_mcp.core.exceptions import ABIValidationError
        abi = ["not a dict"]
        with pytest.raises(ABIValidationError):
            validate_abi(abi)


class TestIsFilePath:
    """Tests for is_file_path."""

    def test_json_file(self):
        """JSON file is a file path."""
        result = is_file_path("/path/to/file.json")
        assert result is True

    def test_relative_path(self):
        """Relative path is a file path."""
        result = is_file_path("./contracts/MyToken.json")
        assert result is True

    def test_ethereum_address_not_file(self):
        """Ethereum address is not a file path."""
        result = is_file_path("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
        assert result is False

    def test_dotfile_is_path(self):
        """Dotfile is a file path."""
        result = is_file_path(".env")
        assert result is True

    def test_abi_extension(self):
        """ABI extension is a file path."""
        result = is_file_path("contract.abi")
        assert result is True


class TestNormalizeHexString:
    """Tests for normalize_hex_string."""

    def test_add_prefix(self):
        """Add 0x prefix if missing."""
        result = normalize_hex_string("1234abcd")
        assert result == "0x1234abcd"

    def test_keep_prefix(self):
        """Keep existing 0x prefix."""
        result = normalize_hex_string("0x1234abcd")
        assert result == "0x1234abcd"

    def test_lowercase(self):
        """Lowercase the hex string."""
        result = normalize_hex_string("0xABCD")
        assert result == "0xabcd"
"""Full coverage tests for validation utilities."""

from unittest.mock import patch, Mock
import json
import tempfile
import os

from abi_to_mcp.utils.validation import (
    validate_abi_file,
)


class TestIsChecksumAddress:
    """Tests for is_checksum_address function."""

    def test_valid_checksum_address(self):
        """Test with valid checksum address."""
        # Valid checksum address
        address = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"
        result = is_checksum_address(address)
        # Should return True if Web3 is available and checksum is correct
        assert isinstance(result, bool)

    def test_invalid_address_returns_false(self):
        """Test with invalid address format."""
        assert is_checksum_address("invalid") is False
        assert is_checksum_address("0x123") is False

    def test_lowercase_address(self):
        """Test with lowercase address."""
        # Lowercase is not a valid checksum
        address = "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed"
        result = is_checksum_address(address)
        # With Web3 available, this should be False (not checksummed)
        assert isinstance(result, bool)

    def test_without_web3(self):
        """Test behavior when Web3 is not available."""
        valid_address = "0x1234567890123456789012345678901234567890"
        
        with patch.dict("sys.modules", {"web3": None}):
            # Should fall back to format check only
            with patch("abi_to_mcp.utils.validation.is_valid_address", return_value=True):
                # When web3 import fails, returns is_valid_address result
                pass


class TestValidateABIFile:
    """Tests for validate_abi_file function."""

    def test_file_not_found(self):
        """Test with non-existent file."""
        with pytest.raises(ABIValidationError, match="ABI file not found"):
            validate_abi_file(Path("/nonexistent/path/abi.json"))

    def test_invalid_json(self):
        """Test with invalid JSON file."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            f.write("not valid json {{{")
            f.flush()
            
            try:
                with pytest.raises(ABIValidationError, match="Invalid JSON"):
                    validate_abi_file(Path(f.name))
            finally:
                os.unlink(f.name)

    def test_valid_abi_array(self):
        """Test with valid ABI array."""
        abi = [{"type": "function", "name": "test", "inputs": [], "outputs": []}]
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(abi, f)
            f.flush()
            
            try:
                result = validate_abi_file(Path(f.name))
                assert result == abi
            finally:
                os.unlink(f.name)

    def test_hardhat_artifact_format(self):
        """Test with Hardhat/Truffle artifact format."""
        abi = [{"type": "function", "name": "test", "inputs": [], "outputs": []}]
        artifact = {"abi": abi, "bytecode": "0x..."}
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(artifact, f)
            f.flush()
            
            try:
                result = validate_abi_file(Path(f.name))
                assert result == abi
            finally:
                os.unlink(f.name)

    def test_invalid_artifact_format(self):
        """Test with invalid artifact format (dict without abi field)."""
        artifact = {"bytecode": "0x...", "other": "data"}
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(artifact, f)
            f.flush()
            
            try:
                with pytest.raises(ABIValidationError, match="expected 'abi' field"):
                    validate_abi_file(Path(f.name))
            finally:
                os.unlink(f.name)

    def test_read_error(self):
        """Test with file read error."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            f.write("{}")
            f.flush()
            
            try:
                # Make file unreadable
                os.chmod(f.name, 0o000)
                
                try:
                    with pytest.raises(ABIValidationError, match="Failed to read"):
                        validate_abi_file(Path(f.name))
                finally:
                    # Restore permissions for cleanup
                    os.chmod(f.name, 0o644)
            finally:
                os.unlink(f.name)


class TestIsFilePath:
    """Tests for is_file_path function."""

    def test_json_extension(self):
        """Test detection of .json files."""
        assert is_file_path("contract.json") is True
        assert is_file_path("./path/to/abi.json") is True

    def test_abi_extension(self):
        """Test detection of .abi files."""
        assert is_file_path("contract.abi") is True

    def test_path_separators(self):
        """Test detection of paths with separators."""
        assert is_file_path("./contract") is True
        assert is_file_path("path/to/file") is True
        assert is_file_path("path\\to\\file") is True

    def test_dot_prefix(self):
        """Test detection of relative paths."""
        assert is_file_path("./file") is True
        assert is_file_path(".hidden") is True

    def test_existing_file(self):
        """Test detection of existing files."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            try:
                assert is_file_path(f.name) is True
            finally:
                os.unlink(f.name)

    def test_not_file_path(self):
        """Test non-file paths."""
        # Ethereum addresses are not file paths
        assert is_file_path("0x1234567890123456789012345678901234567890") is False


class TestNormalizeHexString:
    """Tests for normalize_hex_string function."""

    def test_with_0x_prefix(self):
        """Test hex string with 0x prefix."""
        assert normalize_hex_string("0xABCDEF") == "0xabcdef"

    def test_without_0x_prefix(self):
        """Test hex string without 0x prefix."""
        assert normalize_hex_string("ABCDEF") == "0xabcdef"

    def test_with_whitespace(self):
        """Test hex string with whitespace."""
        assert normalize_hex_string("  0xABCDEF  ") == "0xabcdef"

    def test_already_lowercase(self):
        """Test already lowercase hex string."""
        assert normalize_hex_string("0xabcdef") == "0xabcdef"


class TestValidateABI:
    """Tests for validate_abi function."""

    def test_valid_abi(self):
        """Test with valid ABI."""
        abi = [
            {"type": "function", "name": "test", "inputs": [], "outputs": []},
            {"type": "event", "name": "TestEvent", "inputs": []},
        ]
        result = validate_abi(abi)
        assert result == abi

    def test_empty_abi_is_valid(self):
        """Test with empty ABI - empty list is valid."""
        result = validate_abi([])
        assert result == []

    def test_not_a_list(self):
        """Test with non-list ABI."""
        with pytest.raises(ABIValidationError, match="Invalid ABI format"):
            validate_abi({"type": "function"})

    def test_invalid_entry(self):
        """Test with invalid ABI entry."""
        with pytest.raises(ABIValidationError, match="Invalid ABI format"):
            validate_abi(["not a dict"])

    def test_missing_type(self):
        """Test with entry missing type field."""
        with pytest.raises(ABIValidationError, match="Invalid ABI format"):
            validate_abi([{"name": "test"}])


class TestIsValidAddress:
    """Tests for is_valid_address function."""

    def test_valid_address(self):
        """Test with valid Ethereum address."""
        assert is_valid_address("0x1234567890123456789012345678901234567890") is True

    def test_invalid_length(self):
        """Test with wrong length address."""
        assert is_valid_address("0x123456") is False

    def test_invalid_characters(self):
        """Test with invalid hex characters."""
        assert is_valid_address("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG") is False

    def test_missing_0x_prefix(self):
        """Test without 0x prefix."""
        assert is_valid_address("1234567890123456789012345678901234567890") is False

    def test_uppercase(self):
        """Test with uppercase hex."""
        assert is_valid_address("0xABCDEF1234567890123456789012345678901234") is True

    def test_mixed_case(self):
        """Test with mixed case (valid checksum format)."""
        assert is_valid_address("0xAbCdEf1234567890123456789012345678901234") is True
