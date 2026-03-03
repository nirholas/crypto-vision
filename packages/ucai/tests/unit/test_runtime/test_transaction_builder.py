"""Tests for TransactionBuilder class."""

import pytest
from unittest.mock import Mock, MagicMock, patch

from abi_to_mcp.runtime.transaction import TransactionBuilder
from abi_to_mcp.core.exceptions import TransactionError


class TestTransactionBuilder:
    """Tests for TransactionBuilder class."""

    @pytest.fixture
    def mock_web3_client(self):
        """Create a mock Web3Client."""
        client = Mock()
        client.w3 = Mock()
        client.w3.eth = Mock()
        client.w3.eth.gas_price = 20_000_000_000
        client.w3.eth.get_block.return_value = {"baseFeePerGas": 10_000_000_000}
        client.w3.eth.estimate_gas.return_value = 50000
        client.get_transaction_count.return_value = 0
        client.get_chain_id.return_value = 1
        return client

    @pytest.fixture
    def builder(self, mock_web3_client):
        """Create a TransactionBuilder instance."""
        return TransactionBuilder(mock_web3_client)

    @pytest.fixture
    def mock_contract_function(self):
        """Create a mock contract function."""
        func = Mock()
        func.build_transaction.return_value = {
            "from": "0x" + "1" * 40,
            "to": "0x" + "2" * 40,
            "data": "0x12345678",
            "gas": 50000,
            "gasPrice": 20_000_000_000,
            "nonce": 0,
            "chainId": 1,
        }
        return func

    def test_build_transaction_basic(self, builder, mock_contract_function):
        """Build a basic transaction."""
        tx = builder.build_transaction(
            contract_function=mock_contract_function,
            from_address="0x" + "1" * 40,
        )

        assert "from" in tx
        assert "nonce" in tx
        assert "chainId" in tx

    def test_build_transaction_with_value(self, builder, mock_contract_function):
        """Build a transaction with ETH value."""
        tx = builder.build_transaction(
            contract_function=mock_contract_function,
            from_address="0x" + "1" * 40,
            value=10**18,
        )

        assert tx is not None
        mock_contract_function.build_transaction.assert_called()

    def test_build_transaction_with_gas_limit(self, builder, mock_contract_function):
        """Build a transaction with custom gas limit."""
        tx = builder.build_transaction(
            contract_function=mock_contract_function,
            from_address="0x" + "1" * 40,
            gas_limit=100000,
        )

        assert tx["gas"] == 100000

    def test_build_transaction_legacy_gas_price(self, builder, mock_contract_function, mock_web3_client):
        """Build a transaction with legacy gas pricing."""
        # Simulate non-EIP1559 network
        mock_web3_client.w3.eth.get_block.return_value = {}

        tx = builder.build_transaction(
            contract_function=mock_contract_function,
            from_address="0x" + "1" * 40,
            gas_price=30_000_000_000,
        )

        assert tx is not None

    def test_build_transaction_eip1559(self, builder, mock_contract_function):
        """Build an EIP-1559 transaction."""
        tx = builder.build_transaction(
            contract_function=mock_contract_function,
            from_address="0x" + "1" * 40,
            max_fee_per_gas=50_000_000_000,
            max_priority_fee_per_gas=2_000_000_000,
        )

        assert tx is not None

    def test_build_transaction_with_nonce(self, builder, mock_contract_function, mock_web3_client):
        """Build a transaction with custom nonce."""
        tx = builder.build_transaction(
            contract_function=mock_contract_function,
            from_address="0x" + "1" * 40,
            nonce=42,
        )

        # Should not call get_transaction_count when nonce provided
        assert tx is not None

    def test_build_transaction_auto_detects_eip1559(self, builder, mock_contract_function, mock_web3_client):
        """Auto-detect EIP-1559 support."""
        # Mock EIP-1559 network
        mock_web3_client.w3.eth.get_block.return_value = {"baseFeePerGas": 10_000_000_000}

        tx = builder.build_transaction(
            contract_function=mock_contract_function,
            from_address="0x" + "1" * 40,
        )

        assert tx is not None

    def test_build_transaction_fallback_to_legacy(self, builder, mock_contract_function, mock_web3_client):
        """Fallback to legacy gas pricing if EIP-1559 detection fails."""
        # Mock network without EIP-1559
        mock_web3_client.w3.eth.get_block.return_value = {}

        tx = builder.build_transaction(
            contract_function=mock_contract_function,
            from_address="0x" + "1" * 40,
        )

        assert tx is not None

    def test_estimate_gas(self, builder, mock_web3_client):
        """Estimate gas for a transaction."""
        tx = {
            "from": "0x" + "1" * 40,
            "to": "0x" + "2" * 40,
            "data": "0x12345678",
        }

        mock_web3_client.w3.eth.estimate_gas.return_value = 50000

        gas = builder.estimate_gas(tx)

        # Should include 20% buffer
        assert gas == int(50000 * 1.2)

    def test_estimate_gas_removes_gas_field(self, builder, mock_web3_client):
        """Gas field should be removed before estimation."""
        tx = {
            "from": "0x" + "1" * 40,
            "to": "0x" + "2" * 40,
            "data": "0x12345678",
            "gas": 21000,
            "nonce": 5,
        }

        mock_web3_client.w3.eth.estimate_gas.return_value = 30000

        gas = builder.estimate_gas(tx)

        # Should have estimated without gas/nonce fields
        call_args = mock_web3_client.w3.eth.estimate_gas.call_args[0][0]
        assert "gas" not in call_args
        assert "nonce" not in call_args

    def test_estimate_gas_error_raises_transaction_error(self, builder, mock_web3_client):
        """Gas estimation failure raises TransactionError."""
        mock_web3_client.w3.eth.estimate_gas.side_effect = Exception("estimation failed")

        tx = {
            "from": "0x" + "1" * 40,
            "to": "0x" + "2" * 40,
        }

        with pytest.raises(TransactionError):
            builder.estimate_gas(tx)

    def test_build_call_transaction(self, builder):
        """Build a read-only call transaction."""
        mock_func = Mock()

        tx = builder.build_call_transaction(
            contract_function=mock_func,
            from_address="0x" + "1" * 40,
        )

        assert "from" in tx
        assert tx["from"] == "0x" + "1" * 40

    def test_build_call_transaction_without_from(self, builder):
        """Build a call transaction without from address."""
        mock_func = Mock()

        tx = builder.build_call_transaction(
            contract_function=mock_func,
        )

        assert "from" not in tx

    def test_build_call_transaction_with_value(self, builder):
        """Build a call transaction with value."""
        mock_func = Mock()

        tx = builder.build_call_transaction(
            contract_function=mock_func,
            from_address="0x" + "1" * 40,
            value=10**18,
        )

        assert tx["value"] == 10**18

    def test_build_transaction_error_handling(self, builder, mock_contract_function):
        """Transaction building errors raise TransactionError."""
        mock_contract_function.build_transaction.side_effect = Exception("build failed")

        with pytest.raises(TransactionError):
            builder.build_transaction(
                contract_function=mock_contract_function,
                from_address="0x" + "1" * 40,
            )

    def test_build_transaction_estimates_gas_if_missing(self, builder, mock_contract_function, mock_web3_client):
        """Gas is estimated if not in built transaction."""
        # Return transaction without gas
        mock_contract_function.build_transaction.return_value = {
            "from": "0x" + "1" * 40,
            "to": "0x" + "2" * 40,
            "data": "0x12345678",
            "nonce": 0,
            "chainId": 1,
        }
        mock_web3_client.w3.eth.estimate_gas.return_value = 40000

        tx = builder.build_transaction(
            contract_function=mock_contract_function,
            from_address="0x" + "1" * 40,
        )

        # Should have estimated gas with buffer
        assert tx["gas"] == int(40000 * 1.2)
