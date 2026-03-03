"""Tests for __main__ module."""

import pytest
from unittest.mock import patch


def test_main_entry_point():
    """Test that __main__ calls main()."""
    with patch('abi_to_mcp.cli.main.main') as mock_main:
        # Import and execute __main__
        import importlib
        import abi_to_mcp.__main__
        
        # The module should be importable
        assert hasattr(abi_to_mcp.__main__, '__name__')


def test_main_module_has_main_import():
    """Test that __main__ imports main from cli."""
    import abi_to_mcp.__main__ as main_module
    
    # Check the module has the expected content
    import inspect
    source = inspect.getsource(main_module)
    assert 'from abi_to_mcp.cli.main import main' in source
