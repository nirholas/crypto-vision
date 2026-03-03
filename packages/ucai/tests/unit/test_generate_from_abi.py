"""Tests for the generate_from_abi convenience function."""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from pathlib import Path
import tempfile
import json
import os


class TestGenerateFromABI:
    """Tests for generate_from_abi function."""

    @pytest.fixture
    def valid_abi(self):
        """Create a valid ABI."""
        return [
            {
                "type": "function",
                "name": "balanceOf",
                "inputs": [{"name": "account", "type": "address"}],
                "outputs": [{"name": "", "type": "uint256"}],
                "stateMutability": "view",
            }
        ]

    @pytest.fixture
    def abi_file(self, valid_abi):
        """Create a temporary ABI file."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(valid_abi, f)
            f.flush()
            yield f.name
        os.unlink(f.name)

    def test_generate_from_abi_with_file(self, abi_file):
        """Test generate_from_abi with a file source."""
        from abi_to_mcp import generate_from_abi
        
        with tempfile.TemporaryDirectory() as output_dir:
            result = generate_from_abi(
                abi_source=abi_file,
                contract_address="0xabcdef1234567890123456789012345678901234",
                output_dir=output_dir,
            )
            
            # Should return a GeneratedServer
            assert result is not None
            assert hasattr(result, 'files')  # GeneratedServer has files attribute

    def test_generate_from_abi_with_read_only(self, abi_file):
        """Test generate_from_abi with read_only option."""
        from abi_to_mcp import generate_from_abi
        
        with tempfile.TemporaryDirectory() as output_dir:
            result = generate_from_abi(
                abi_source=abi_file,
                contract_address="0xabcdef1234567890123456789012345678901234",
                output_dir=output_dir,
                read_only=True,
            )
            
            assert result is not None

    def test_generate_from_abi_includes_events(self, valid_abi):
        """Test generate_from_abi with events."""
        # Create ABI with event
        abi_with_event = valid_abi + [
            {
                "type": "event",
                "name": "Transfer",
                "inputs": [
                    {"name": "from", "type": "address", "indexed": True},
                    {"name": "to", "type": "address", "indexed": True},
                    {"name": "value", "type": "uint256", "indexed": False},
                ],
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(abi_with_event, f)
            f.flush()
            
            try:
                from abi_to_mcp import generate_from_abi
                
                with tempfile.TemporaryDirectory() as output_dir:
                    result = generate_from_abi(
                        abi_source=f.name,
                        contract_address="0xabcdef1234567890123456789012345678901234",
                        output_dir=output_dir,
                        include_events=True,
                    )
                    
                    assert result is not None
            finally:
                os.unlink(f.name)

    def test_generate_from_abi_with_network(self, abi_file):
        """Test generate_from_abi with network parameter."""
        from abi_to_mcp import generate_from_abi
        
        with tempfile.TemporaryDirectory() as output_dir:
            result = generate_from_abi(
                abi_source=abi_file,
                contract_address="0xabcdef1234567890123456789012345678901234",
                output_dir=output_dir,
                network="mainnet",
            )
            
            assert result is not None
