"""Tests for event parser module."""

import pytest

from abi_to_mcp.parser.event_parser import EventParser
from abi_to_mcp.core.exceptions import ABIParseError


def test_parse_simple_event():
    """Parse a simple event."""
    entry = {
        "type": "event",
        "name": "Transfer",
        "inputs": [
            {"indexed": True, "name": "from", "type": "address"},
            {"indexed": True, "name": "to", "type": "address"},
            {"indexed": False, "name": "value", "type": "uint256"}
        ],
        "anonymous": False
    }
    
    parser = EventParser()
    event = parser.parse(entry)
    
    assert event.name == "Transfer"
    assert len(event.inputs) == 3
    assert event.inputs[0].indexed
    assert event.inputs[1].indexed
    assert not event.inputs[2].indexed
    assert not event.anonymous


def test_parse_anonymous_event():
    """Parse anonymous event."""
    entry = {
        "type": "event",
        "name": "LogData",
        "inputs": [{"indexed": False, "name": "data", "type": "bytes"}],
        "anonymous": True
    }
    
    parser = EventParser()
    event = parser.parse(entry)
    
    assert event.anonymous


def test_parse_event_with_tuple():
    """Parse event with tuple parameter."""
    entry = {
        "type": "event",
        "name": "SwapExecuted",
        "inputs": [{
            "indexed": False,
            "name": "params",
            "type": "tuple",
            "components": [
                {"name": "tokenIn", "type": "address"},
                {"name": "tokenOut", "type": "address"},
                {"name": "amount", "type": "uint256"}
            ]
        }],
        "anonymous": False
    }
    
    parser = EventParser()
    event = parser.parse(entry)
    
    assert len(event.inputs) == 1
    assert event.inputs[0].type == "tuple"
    assert event.inputs[0].components is not None
    assert len(event.inputs[0].components) == 3


def test_parse_event_no_inputs():
    """Parse event with no inputs."""
    entry = {
        "type": "event",
        "name": "Initialized",
        "inputs": [],
        "anonymous": False
    }
    
    parser = EventParser()
    event = parser.parse(entry)
    
    assert len(event.inputs) == 0


def test_parse_event_indexed_helpers():
    """Test event indexed/data input helpers."""
    entry = {
        "type": "event",
        "name": "Transfer",
        "inputs": [
            {"indexed": True, "name": "from", "type": "address"},
            {"indexed": True, "name": "to", "type": "address"},
            {"indexed": False, "name": "value", "type": "uint256"}
        ]
    }
    
    parser = EventParser()
    event = parser.parse(entry)
    
    assert len(event.indexed_inputs) == 2
    assert len(event.data_inputs) == 1
    assert event.indexed_inputs[0].name == "from"
    assert event.data_inputs[0].name == "value"
