"""Tests for TransactionBuilder."""

import pytest
from unittest.mock import Mock

from abi_to_mcp.runtime.transaction import TransactionBuilder
from abi_to_mcp.runtime.web3_client import Web3Client


@pytest.fixture
def mock_web3_client():
    """Create mock Web3Client."""
    client = Mock(spec=Web3Client)
    client.get_chain_id.return_value = 1
    client.get_transaction_count.return_value = 0
    client.w3 = Mock()
    client.w3.eth = Mock()
    client.w3.eth.gas_price = 50_000_000_000  # 50 gwei
    client.w3.eth.get_block.return_value = {"baseFeePerGas": 30_000_000_000}
    
    return client


def test_transaction_builder_initialization(mock_web3_client):
    """Test TransactionBuilder initialization."""
    builder = TransactionBuilder(mock_web3_client)
    assert builder.client == mock_web3_client


def test_build_transaction_basic(mock_web3_client):
    """Test basic transaction building."""
    builder = TransactionBuilder(mock_web3_client)
    
    # Mock contract function
    mock_function = Mock()
    mock_function.build_transaction.return_value = {
        "from": "0x" + "0" * 40,
        "nonce": 0,
        "chainId": 1,
        "gas": 21000,
    }
    
    tx = builder.build_transaction(
        contract_function=mock_function,
        from_address="0x" + "0" * 40,
    )
    
    assert "from" in tx
    assert "nonce" in tx
    assert "chainId" in tx


def test_build_transaction_with_value(mock_web3_client):
    """Test transaction with ETH value."""
    builder = TransactionBuilder(mock_web3_client)
    
    mock_function = Mock()
    mock_function.build_transaction.return_value = {
        "from": "0x" + "0" * 40,
        "nonce": 0,
        "chainId": 1,
        "value": 10**18,  # 1 ETH
        "gas": 21000,
    }
    
    tx = builder.build_transaction(
        contract_function=mock_function,
        from_address="0x" + "0" * 40,
        value=10**18,
    )
    
    assert tx["value"] == 10**18
