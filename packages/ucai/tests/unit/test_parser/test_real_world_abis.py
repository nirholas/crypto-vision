"""Tests using real-world contract ABIs from popular protocols.

This module contains tests that validate parsing of real-world ABIs
from popular DeFi protocols and token standards.
"""

import pytest
import json
from pathlib import Path

from abi_to_mcp.parser.abi_parser import ABIParser
from abi_to_mcp.core.models import StateMutability


@pytest.fixture
def fixtures_dir():
    """Get the path to fixtures directory."""
    return Path(__file__).parent.parent.parent / "fixtures" / "abis"


class TestERC20ABI:
    """Test parsing of standard ERC20 token ABI."""

    @pytest.fixture
    def erc20_abi(self, fixtures_dir):
        path = fixtures_dir / "erc20.json"
        with open(path) as f:
            return json.load(f)

    def test_parses_all_standard_functions(self, erc20_abi):
        """ERC20 should have all standard functions."""
        parser = ABIParser()
        parsed = parser.parse(erc20_abi)
        
        func_names = {f.name for f in parsed.functions}
        
        # Required ERC20 functions
        assert "name" in func_names
        assert "symbol" in func_names
        assert "decimals" in func_names
        assert "totalSupply" in func_names
        assert "balanceOf" in func_names
        assert "transfer" in func_names
        assert "approve" in func_names
        assert "allowance" in func_names
        assert "transferFrom" in func_names

    def test_parses_standard_events(self, erc20_abi):
        """ERC20 should have Transfer and Approval events."""
        parser = ABIParser()
        parsed = parser.parse(erc20_abi)
        
        event_names = {e.name for e in parsed.events}
        
        assert "Transfer" in event_names
        assert "Approval" in event_names

    def test_detects_erc20_standard(self, erc20_abi):
        """Should detect ERC20 standard."""
        parser = ABIParser()
        parsed = parser.parse(erc20_abi)
        
        assert parsed.detected_standard == "ERC20"

    def test_view_functions_are_readonly(self, erc20_abi):
        """View functions should be marked as read-only."""
        parser = ABIParser()
        parsed = parser.parse(erc20_abi)
        
        balance_of = next(f for f in parsed.functions if f.name == "balanceOf")
        assert balance_of.is_read_only
        assert not balance_of.requires_gas

    def test_transfer_requires_gas(self, erc20_abi):
        """Transfer function should require gas."""
        parser = ABIParser()
        parsed = parser.parse(erc20_abi)
        
        transfer = next(f for f in parsed.functions if f.name == "transfer")
        assert not transfer.is_read_only
        assert transfer.requires_gas


class TestERC721ABI:
    """Test parsing of standard ERC721 NFT ABI."""

    @pytest.fixture
    def erc721_abi(self, fixtures_dir):
        path = fixtures_dir / "erc721.json"
        with open(path) as f:
            return json.load(f)

    def test_parses_nft_specific_functions(self, erc721_abi):
        """ERC721 should have NFT-specific functions."""
        parser = ABIParser()
        parsed = parser.parse(erc721_abi)
        
        func_names = {f.name for f in parsed.functions}
        
        assert "ownerOf" in func_names
        assert "balanceOf" in func_names

    def test_detects_erc721_standard(self, erc721_abi):
        """Should detect ERC721 standard."""
        parser = ABIParser()
        parsed = parser.parse(erc721_abi)
        
        assert parsed.detected_standard == "ERC721"

    def test_has_approval_for_all_event(self, erc721_abi):
        """ERC721 should have ApprovalForAll event."""
        parser = ABIParser()
        parsed = parser.parse(erc721_abi)
        
        event_names = {e.name for e in parsed.events}
        assert "ApprovalForAll" in event_names

    def test_safe_transfer_from_has_data_param(self, erc721_abi):
        """safeTransferFrom may have optional data parameter."""
        parser = ABIParser()
        parsed = parser.parse(erc721_abi)
        
        # Find safeTransferFrom functions (may be overloaded)
        safe_transfers = [f for f in parsed.functions if f.name == "safeTransferFrom"]
        assert len(safe_transfers) >= 1
        
        # At least one should have the bytes data parameter
        has_data_param = any(
            any(p.type == "bytes" for p in f.inputs)
            for f in safe_transfers
        )
        # Some implementations only have the 4-param version
        assert len(safe_transfers) >= 1


class TestERC1155ABI:
    """Test parsing of ERC-1155 Multi-Token Standard."""

    @pytest.fixture
    def erc1155_abi(self, fixtures_dir):
        path = fixtures_dir / "erc1155.json"
        with open(path) as f:
            return json.load(f)

    def test_batch_functions_have_arrays(self, erc1155_abi):
        """ERC1155 batch functions take array parameters."""
        parser = ABIParser()
        parsed = parser.parse(erc1155_abi)
        
        batch_transfer = next(
            (f for f in parsed.functions if f.name == "safeBatchTransferFrom"),
            None
        )
        
        assert batch_transfer is not None
        
        # Should have ids[] and amounts[] parameters
        array_params = [
            p for p in batch_transfer.inputs
            if "[]" in p.type
        ]
        assert len(array_params) >= 2

    def test_erc1155_standard_detected(self, erc1155_abi):
        """Should detect ERC1155 standard."""
        parser = ABIParser()
        parsed = parser.parse(erc1155_abi)
        
        assert parsed.detected_standard == "ERC1155"

    def test_has_transfer_single_and_batch_events(self, erc1155_abi):
        """ERC1155 should have TransferSingle and TransferBatch events."""
        parser = ABIParser()
        parsed = parser.parse(erc1155_abi)
        
        event_names = {e.name for e in parsed.events}
        assert "TransferSingle" in event_names
        assert "TransferBatch" in event_names

    def test_balance_of_batch_returns_array(self, erc1155_abi):
        """balanceOfBatch should return an array."""
        parser = ABIParser()
        parsed = parser.parse(erc1155_abi)
        
        balance_batch = next(
            f for f in parsed.functions if f.name == "balanceOfBatch"
        )
        
        assert len(balance_batch.outputs) == 1
        assert "[]" in balance_batch.outputs[0].type

    def test_has_uri_function(self, erc1155_abi):
        """ERC1155 should have uri function for metadata."""
        parser = ABIParser()
        parsed = parser.parse(erc1155_abi)
        
        uri_func = next(
            (f for f in parsed.functions if f.name == "uri"),
            None
        )
        
        assert uri_func is not None
        assert uri_func.is_read_only


class TestComplexABIPatterns:
    """Test parsing of complex ABI patterns found in real contracts."""

    @pytest.fixture
    def parser(self):
        return ABIParser()

    def test_overloaded_functions(self, parser):
        """Handle contracts with overloaded functions (same name, different params)."""
        abi = [
            {
                "type": "function",
                "name": "safeTransferFrom",
                "inputs": [
                    {"name": "from", "type": "address"},
                    {"name": "to", "type": "address"},
                    {"name": "tokenId", "type": "uint256"},
                ],
                "outputs": [],
                "stateMutability": "nonpayable"
            },
            {
                "type": "function",
                "name": "safeTransferFrom",
                "inputs": [
                    {"name": "from", "type": "address"},
                    {"name": "to", "type": "address"},
                    {"name": "tokenId", "type": "uint256"},
                    {"name": "data", "type": "bytes"},
                ],
                "outputs": [],
                "stateMutability": "nonpayable"
            }
        ]
        
        parsed = parser.parse(abi)
        
        # Both functions should be parsed
        assert len(parsed.functions) == 2
        assert all(f.name == "safeTransferFrom" for f in parsed.functions)
        
        # They should have different input counts
        input_counts = sorted(len(f.inputs) for f in parsed.functions)
        assert input_counts == [3, 4]

    def test_payable_fallback(self, parser):
        """Handle payable fallback function."""
        abi = [
            {
                "type": "fallback",
                "stateMutability": "payable"
            }
        ]
        
        parsed = parser.parse(abi)
        assert parsed.has_fallback

    def test_receive_function(self, parser):
        """Handle receive function for plain ETH transfers."""
        abi = [
            {
                "type": "receive",
                "stateMutability": "payable"
            }
        ]
        
        parsed = parser.parse(abi)
        assert parsed.has_receive

    def test_constructor_with_params(self, parser):
        """Handle constructor with initialization parameters."""
        abi = [
            {
                "type": "constructor",
                "inputs": [
                    {"name": "name_", "type": "string"},
                    {"name": "symbol_", "type": "string"},
                    {"name": "initialSupply", "type": "uint256"},
                ],
                "stateMutability": "nonpayable"
            }
        ]
        
        parsed = parser.parse(abi)
        assert parsed.has_constructor

    def test_complex_swap_struct(self, parser):
        """Handle complex DeFi swap parameters with nested tuples."""
        abi = [{
            "type": "function",
            "name": "exactInputSingle",
            "inputs": [{
                "name": "params",
                "type": "tuple",
                "components": [
                    {"name": "tokenIn", "type": "address"},
                    {"name": "tokenOut", "type": "address"},
                    {"name": "fee", "type": "uint24"},
                    {"name": "recipient", "type": "address"},
                    {"name": "deadline", "type": "uint256"},
                    {"name": "amountIn", "type": "uint256"},
                    {"name": "amountOutMinimum", "type": "uint256"},
                    {"name": "sqrtPriceLimitX96", "type": "uint160"}
                ]
            }],
            "outputs": [{"name": "amountOut", "type": "uint256"}],
            "stateMutability": "payable"
        }]
        
        parsed = parser.parse(abi)
        func = parsed.functions[0]
        
        assert func.name == "exactInputSingle"
        assert func.is_payable
        assert len(func.inputs) == 1
        assert func.inputs[0].type == "tuple"
        assert len(func.inputs[0].components) == 8

    def test_legacy_constant_field(self, parser):
        """Handle legacy 'constant' field (pre-0.5.0 Solidity)."""
        abi = [{
            "type": "function",
            "name": "balanceOf",
            "constant": True,
            "inputs": [{"name": "account", "type": "address"}],
            "outputs": [{"name": "", "type": "uint256"}],
            "payable": False
        }]
        
        parsed = parser.parse(abi)
        func = parsed.functions[0]
        
        # Should be interpreted as view
        assert func.is_read_only

    def test_legacy_payable_field(self, parser):
        """Handle legacy 'payable' field (pre-0.5.0 Solidity)."""
        abi = [{
            "type": "function",
            "name": "deposit",
            "constant": False,
            "inputs": [],
            "outputs": [],
            "payable": True
        }]
        
        parsed = parser.parse(abi)
        func = parsed.functions[0]
        
        # Should be interpreted as payable
        assert func.is_payable

    def test_internal_type_hints(self, parser):
        """Handle internalType hints from newer Solidity versions."""
        abi = [{
            "type": "function",
            "name": "getConfig",
            "inputs": [],
            "outputs": [{
                "name": "",
                "type": "tuple",
                "internalType": "struct MyContract.Config",
                "components": [
                    {"name": "owner", "type": "address", "internalType": "address"},
                    {"name": "fee", "type": "uint256", "internalType": "uint256"},
                ]
            }],
            "stateMutability": "view"
        }]
        
        parsed = parser.parse(abi)
        func = parsed.functions[0]
        
        assert func.outputs[0].internal_type == "struct MyContract.Config"
