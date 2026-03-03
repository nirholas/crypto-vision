"""Tests for ABI parser module."""

import json
import pytest
from pathlib import Path

from abi_to_mcp.parser.abi_parser import ABIParser
from abi_to_mcp.core.models import StateMutability
from abi_to_mcp.core.exceptions import ABIParseError


@pytest.fixture
def erc20_abi():
    """Load ERC20 fixture ABI."""
    path = Path(__file__).parent.parent.parent / "fixtures" / "abis" / "erc20.json"
    with open(path) as f:
        return json.load(f)


@pytest.fixture
def erc721_abi():
    """Load ERC721 fixture ABI."""
    path = Path(__file__).parent.parent.parent / "fixtures" / "abis" / "erc721.json"
    with open(path) as f:
        return json.load(f)


def test_parse_erc20_abi(erc20_abi):
    """Parse standard ERC20 ABI and verify all functions/events."""
    parser = ABIParser()
    parsed = parser.parse(erc20_abi)
    
    # Check detected standard
    assert parsed.detected_standard == "ERC20"
    
    # Check minimum expected functions (name, symbol, decimals, totalSupply, balanceOf, transfer, approve, allowance, transferFrom)
    assert len(parsed.functions) >= 9
    
    # Check minimum expected events (Transfer, Approval)
    assert len(parsed.events) >= 2
    
    # Check specific function - transfer
    transfer = next((f for f in parsed.functions if f.name == "transfer"), None)
    assert transfer is not None
    assert len(transfer.inputs) == 2
    assert transfer.inputs[0].type == "address"
    assert transfer.inputs[1].type == "uint256"
    assert transfer.state_mutability == StateMutability.NONPAYABLE
    assert not transfer.is_read_only
    assert not transfer.is_payable


def test_parse_complex_tuple():
    """Parse function with nested tuple parameters."""
    abi = [{
        "type": "function",
        "name": "executeSwap",
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
    
    parser = ABIParser()
    parsed = parser.parse(abi)
    
    func = parsed.functions[0]
    assert func.name == "executeSwap"
    assert func.inputs[0].type == "tuple"
    assert func.inputs[0].components is not None
    assert len(func.inputs[0].components) == 8
    assert func.is_payable


def test_detect_erc721(erc721_abi):
    """Detect ERC721 standard from function signatures."""
    parser = ABIParser()
    parsed = parser.parse(erc721_abi)
    
    assert parsed.detected_standard == "ERC721"


def test_parse_view_function():
    """Parse view function correctly."""
    abi = [{
        "type": "function",
        "name": "balanceOf",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "balance", "type": "uint256"}],
        "stateMutability": "view"
    }]
    
    parser = ABIParser()
    parsed = parser.parse(abi)
    
    func = parsed.functions[0]
    assert func.is_read_only
    assert not func.requires_gas
    assert func.state_mutability == StateMutability.VIEW


def test_parse_payable_function():
    """Parse payable function correctly."""
    abi = [{
        "type": "function",
        "name": "deposit",
        "inputs": [],
        "outputs": [],
        "stateMutability": "payable"
    }]
    
    parser = ABIParser()
    parsed = parser.parse(abi)
    
    func = parsed.functions[0]
    assert func.is_payable
    assert func.requires_gas
    assert not func.is_read_only


def test_parse_events():
    """Parse events with indexed parameters."""
    abi = [{
        "type": "event",
        "name": "Transfer",
        "inputs": [
            {"indexed": True, "name": "from", "type": "address"},
            {"indexed": True, "name": "to", "type": "address"},
            {"indexed": False, "name": "value", "type": "uint256"}
        ],
        "anonymous": False
    }]
    
    parser = ABIParser()
    parsed = parser.parse(abi)
    
    event = parsed.events[0]
    assert event.name == "Transfer"
    assert len(event.indexed_inputs) == 2
    assert len(event.data_inputs) == 1
    assert not event.anonymous


def test_parse_custom_errors():
    """Parse custom errors."""
    abi = [{
        "type": "error",
        "name": "InsufficientBalance",
        "inputs": [
            {"name": "available", "type": "uint256"},
            {"name": "required", "type": "uint256"}
        ]
    }]
    
    parser = ABIParser()
    parsed = parser.parse(abi)
    
    error = parsed.errors[0]
    assert error.name == "InsufficientBalance"
    assert len(error.inputs) == 2


def test_validate_valid_abi(erc20_abi):
    """Validation passes for valid ABI."""
    parser = ABIParser()
    errors = parser.validate(erc20_abi)
    
    assert len(errors) == 0


def test_validate_invalid_type():
    """Validation catches invalid type."""
    abi = [{
        "type": "invalid_type",
        "name": "test"
    }]
    
    parser = ABIParser()
    errors = parser.validate(abi)
    
    assert len(errors) > 0
    assert "unknown type" in errors[0].lower()


def test_validate_missing_name():
    """Validation catches missing name."""
    abi = [{
        "type": "function",
        "inputs": [],
        "outputs": []
    }]
    
    parser = ABIParser()
    errors = parser.validate(abi)
    
    assert len(errors) > 0


def test_parse_constructor():
    """Parse constructor entry."""
    abi = [{
        "type": "constructor",
        "inputs": [{"name": "initialSupply", "type": "uint256"}],
        "stateMutability": "nonpayable"
    }]
    
    parser = ABIParser()
    parsed = parser.parse(abi)
    
    assert parsed.has_constructor
    assert not parsed.has_fallback
    assert not parsed.has_receive


def test_parse_fallback_and_receive():
    """Parse fallback and receive functions."""
    abi = [
        {"type": "fallback", "stateMutability": "payable"},
        {"type": "receive", "stateMutability": "payable"}
    ]
    
    parser = ABIParser()
    parsed = parser.parse(abi)
    
    assert parsed.has_fallback
    assert parsed.has_receive


def test_parse_empty_abi():
    """Parse empty ABI."""
    parser = ABIParser()
    parsed = parser.parse([])
    
    assert len(parsed.functions) == 0
    assert len(parsed.events) == 0
    assert len(parsed.errors) == 0
    assert parsed.detected_standard is None


def test_parse_invalid_abi_type():
    """Reject non-list ABI."""
    parser = ABIParser()
    
    with pytest.raises(ABIParseError):
        parser.parse({"not": "a list"})
