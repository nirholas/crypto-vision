"""Tests for the package __init__ API."""

import pytest
from unittest.mock import Mock, patch, MagicMock


class TestPackageExports:
    """Test that the package exports are accessible."""

    def test_version_exported(self):
        """Version is exported."""
        from abi_to_mcp import __version__
        assert __version__ is not None
        assert isinstance(__version__, str)

    def test_core_models_exported(self):
        """Core models are exported."""
        from abi_to_mcp import (
            ABIParameter,
            ABIFunction,
            ABIEvent,
            ParsedABI,
            MappedTool,
            MappedResource,
            GeneratedServer,
        )
        # Just verify imports work
        assert ABIParameter is not None
        assert ABIFunction is not None
        assert ParsedABI is not None

    def test_config_classes_exported(self):
        """Config classes are exported."""
        from abi_to_mcp import GeneratorConfig
        assert GeneratorConfig is not None

    def test_exceptions_exported(self):
        """Exceptions are exported."""
        from abi_to_mcp import ABIToMCPError
        assert ABIToMCPError is not None
        assert issubclass(ABIToMCPError, Exception)


class TestGenerateFromABI:
    """Test the high-level generate_from_abi function."""

    @pytest.fixture
    def mock_abi(self):
        """Simple ABI for testing."""
        return [
            {
                "type": "function",
                "name": "balanceOf",
                "inputs": [{"name": "account", "type": "address"}],
                "outputs": [{"name": "", "type": "uint256"}],
                "stateMutability": "view",
            }
        ]

    def test_generate_from_abi_import(self):
        """generate_from_abi can be imported."""
        from abi_to_mcp import generate_from_abi
        assert callable(generate_from_abi)
