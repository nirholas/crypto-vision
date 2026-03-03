"""Tests for function parser module."""

import pytest

from abi_to_mcp.parser.function_parser import FunctionParser
from abi_to_mcp.core.models import StateMutability
from abi_to_mcp.core.exceptions import ABIParseError


def test_parse_simple_function():
    """Parse a simple function with basic types."""
    entry = {
        "type": "function",
        "name": "transfer",
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"}
        ],
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable"
    }
    
    parser = FunctionParser()
    func = parser.parse(entry)
    
    assert func.name == "transfer"
    assert len(func.inputs) == 2
    assert func.inputs[0].name == "to"
    assert func.inputs[0].type == "address"
    assert func.inputs[1].name == "amount"
    assert func.inputs[1].type == "uint256"
    assert len(func.outputs) == 1
    assert func.outputs[0].type == "bool"
    assert func.state_mutability == StateMutability.NONPAYABLE


def test_parse_view_function():
    """Parse a view function."""
    entry = {
        "type": "function",
        "name": "balanceOf",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "balance", "type": "uint256"}],
        "stateMutability": "view"
    }
    
    parser = FunctionParser()
    func = parser.parse(entry)
    
    assert func.state_mutability == StateMutability.VIEW
    assert func.is_read_only


def test_parse_payable_function():
    """Parse a payable function."""
    entry = {
        "type": "function",
        "name": "deposit",
        "inputs": [],
        "outputs": [],
        "stateMutability": "payable"
    }
    
    parser = FunctionParser()
    func = parser.parse(entry)
    
    assert func.state_mutability == StateMutability.PAYABLE
    assert func.is_payable


def test_parse_pure_function():
    """Parse a pure function."""
    entry = {
        "type": "function",
        "name": "calculate",
        "inputs": [{"name": "a", "type": "uint256"}, {"name": "b", "type": "uint256"}],
        "outputs": [{"name": "result", "type": "uint256"}],
        "stateMutability": "pure"
    }
    
    parser = FunctionParser()
    func = parser.parse(entry)
    
    assert func.state_mutability == StateMutability.PURE
    assert func.is_read_only


def test_parse_function_with_tuple():
    """Parse function with tuple parameter."""
    entry = {
        "type": "function",
        "name": "swap",
        "inputs": [{
            "name": "params",
            "type": "tuple",
            "components": [
                {"name": "tokenA", "type": "address"},
                {"name": "tokenB", "type": "address"},
                {"name": "amount", "type": "uint256"}
            ]
        }],
        "outputs": [],
        "stateMutability": "nonpayable"
    }
    
    parser = FunctionParser()
    func = parser.parse(entry)
    
    assert len(func.inputs) == 1
    assert func.inputs[0].type == "tuple"
    assert func.inputs[0].components is not None
    assert len(func.inputs[0].components) == 3
    assert func.inputs[0].components[0].name == "tokenA"


def test_parse_function_with_nested_tuple():
    """Parse function with nested tuple."""
    entry = {
        "type": "function",
        "name": "complex",
        "inputs": [{
            "name": "data",
            "type": "tuple",
            "components": [
                {"name": "id", "type": "uint256"},
                {
                    "name": "details",
                    "type": "tuple",
                    "components": [
                        {"name": "owner", "type": "address"},
                        {"name": "value", "type": "uint256"}
                    ]
                }
            ]
        }],
        "outputs": [],
        "stateMutability": "nonpayable"
    }
    
    parser = FunctionParser()
    func = parser.parse(entry)
    
    assert func.inputs[0].type == "tuple"
    assert len(func.inputs[0].components) == 2
    assert func.inputs[0].components[1].type == "tuple"
    assert len(func.inputs[0].components[1].components) == 2


def test_parse_function_with_arrays():
    """Parse function with array parameters."""
    entry = {
        "type": "function",
        "name": "batchTransfer",
        "inputs": [
            {"name": "recipients", "type": "address[]"},
            {"name": "amounts", "type": "uint256[]"}
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    }
    
    parser = FunctionParser()
    func = parser.parse(entry)
    
    assert func.inputs[0].type == "address[]"
    assert func.inputs[1].type == "uint256[]"


def test_parse_function_with_fixed_array():
    """Parse function with fixed-size array."""
    entry = {
        "type": "function",
        "name": "setValues",
        "inputs": [{"name": "values", "type": "uint256[5]"}],
        "outputs": [],
        "stateMutability": "nonpayable"
    }
    
    parser = FunctionParser()
    func = parser.parse(entry)
    
    assert func.inputs[0].type == "uint256[5]"


def test_parse_function_no_inputs():
    """Parse function with no inputs."""
    entry = {
        "type": "function",
        "name": "totalSupply",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view"
    }
    
    parser = FunctionParser()
    func = parser.parse(entry)
    
    assert len(func.inputs) == 0
    assert len(func.outputs) == 1


def test_parse_function_no_outputs():
    """Parse function with no outputs."""
    entry = {
        "type": "function",
        "name": "burn",
        "inputs": [{"name": "amount", "type": "uint256"}],
        "outputs": [],
        "stateMutability": "nonpayable"
    }
    
    parser = FunctionParser()
    func = parser.parse(entry)
    
    assert len(func.inputs) == 1
    assert len(func.outputs) == 0


def test_parse_function_legacy_constant():
    """Parse function with legacy 'constant' field."""
    entry = {
        "type": "function",
        "name": "balanceOf",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
        "constant": True
    }
    
    parser = FunctionParser()
    func = parser.parse(entry)
    
    # Should default to view
    assert func.state_mutability == StateMutability.VIEW


def test_parse_function_legacy_payable():
    """Parse function with legacy 'payable' field."""
    entry = {
        "type": "function",
        "name": "deposit",
        "inputs": [],
        "outputs": [],
        "payable": True
    }
    
    parser = FunctionParser()
    func = parser.parse(entry)
    
    assert func.state_mutability == StateMutability.PAYABLE


def test_parse_parameter_with_internal_type():
    """Parse parameter with internalType field."""
    param = {
        "name": "token",
        "type": "address",
        "internalType": "contract IERC20"
    }
    
    parser = FunctionParser()
    parsed_param = parser.parse_parameter(param)
    
    assert parsed_param.name == "token"
    assert parsed_param.type == "address"
    assert parsed_param.internal_type == "contract IERC20"


def test_parse_parameter_unnamed():
    """Parse unnamed parameter."""
    param = {
        "type": "uint256"
    }
    
    parser = FunctionParser()
    parsed_param = parser.parse_parameter(param)
    
    assert parsed_param.name == ""
    assert parsed_param.type == "uint256"
