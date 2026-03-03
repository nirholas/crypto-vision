"""Tests for transaction simulation module."""

import pytest
from unittest.mock import Mock, MagicMock, patch

from abi_to_mcp.runtime.simulator import TransactionSimulator
from abi_to_mcp.core.exceptions import SimulationError


class TestTransactionSimulator:
    """Tests for TransactionSimulator class."""

    @pytest.fixture
    def mock_web3_client(self):
        """Create mock Web3Client."""
        client = Mock()
        client.w3 = Mock()
        client.w3.eth = Mock()
        client.w3.eth.estimate_gas.return_value = 50000
        client.w3.eth.gas_price = 20_000_000_000
        client.w3.eth.get_block.return_value = {"baseFeePerGas": 10_000_000_000}
        client.w3.eth.get_transaction_count.return_value = 0
        client.w3.eth.chain_id = 1
        client.network_config = {"currency": "ETH", "chain_id": 1}
        return client

    @pytest.fixture
    def simulator(self, mock_web3_client):
        """Create simulator instance with mocked tx_builder."""
        sim = TransactionSimulator(mock_web3_client)
        # Mock the transaction builder to return predictable transactions
        sim.tx_builder = Mock()
        sim.tx_builder.build_transaction.return_value = {
            "from": "0x" + "0" * 40,
            "to": "0x" + "1" * 40,
            "gas": 50000,
            "gasPrice": 20_000_000_000,
            "data": "0x12345678",
        }
        return sim

    def test_simulator_initialization(self, mock_web3_client):
        """Test simulator initialization."""
        simulator = TransactionSimulator(mock_web3_client)
        assert simulator.client == mock_web3_client
        assert simulator.tx_builder is not None

    def test_simulate_success(self, simulator):
        """Simulate successful transaction."""
        mock_function = Mock()
        mock_function.call.return_value = True

        result = simulator.simulate(
            contract_function=mock_function,
            from_address="0x" + "2" * 40,
        )

        assert result["success"] is True
        assert "gas_estimate" in result
        assert "estimated_cost_wei" in result
        assert "estimated_cost_eth" in result

    def test_simulate_returns_gas_estimate(self, simulator, mock_web3_client):
        """Simulation should return gas estimate."""
        mock_function = Mock()
        mock_function.call.return_value = 100

        result = simulator.simulate(
            contract_function=mock_function,
            from_address="0x" + "2" * 40,
        )

        assert "gas_estimate" in result
        assert result["gas_estimate"] == 50000

    def test_simulate_with_value(self, simulator):
        """Simulate transaction with ETH value."""
        mock_function = Mock()
        mock_function.call.return_value = True
        simulator.tx_builder.build_transaction.return_value = {
            "from": "0x" + "0" * 40,
            "gas": 50000,
            "value": 10**18,
            "gasPrice": 20_000_000_000,
        }

        result = simulator.simulate(
            contract_function=mock_function,
            from_address="0x" + "2" * 40,
            value=10**18,
        )

        assert result["success"] is True

    def test_simulate_reverted_transaction(self, simulator):
        """Simulate transaction that would revert."""
        mock_function = Mock()
        mock_function.call.side_effect = Exception("execution reverted: insufficient balance")

        result = simulator.simulate(
            contract_function=mock_function,
            from_address="0x" + "2" * 40,
        )

        assert result["success"] is False
        assert result["error"] is not None
        assert "insufficient" in result["error"].lower() or "revert" in result["error"].lower()

    def test_simulate_returns_cost_in_eth(self, simulator):
        """Simulation should return cost in ETH."""
        mock_function = Mock()
        mock_function.call.return_value = True
        simulator.tx_builder.build_transaction.return_value = {
            "from": "0x" + "0" * 40,
            "gas": 21000,
            "gasPrice": 20_000_000_000,  # 20 gwei
        }

        result = simulator.simulate(
            contract_function=mock_function,
            from_address="0x" + "2" * 40,
        )

        assert "estimated_cost_eth" in result
        assert result["estimated_cost_eth"] > 0
        # Cost should be reasonable for a simple tx
        assert result["estimated_cost_eth"] < 1  # Less than 1 ETH

    def test_simulate_returns_gas_price_gwei(self, simulator):
        """Simulation should return gas price in gwei."""
        mock_function = Mock()
        mock_function.call.return_value = True
        simulator.tx_builder.build_transaction.return_value = {
            "from": "0x" + "0" * 40,
            "gas": 21000,
            "gasPrice": 20_000_000_000,  # 20 gwei
        }

        result = simulator.simulate(
            contract_function=mock_function,
            from_address="0x" + "2" * 40,
        )

        assert "gas_price_gwei" in result
        assert result["gas_price_gwei"] == 20.0

    def test_simulate_with_gas_limit(self, simulator):
        """Simulate with custom gas limit."""
        mock_function = Mock()
        mock_function.call.return_value = True
        simulator.tx_builder.build_transaction.return_value = {
            "from": "0x" + "0" * 40,
            "gas": 100000,
            "gasPrice": 20_000_000_000,
        }

        result = simulator.simulate(
            contract_function=mock_function,
            from_address="0x" + "2" * 40,
            gas_limit=100000,
        )

        assert result["gas_estimate"] == 100000

    def test_simulate_batch_transactions(self, simulator):
        """Simulate multiple transactions in sequence."""
        mock_func1 = Mock()
        mock_func1.call.return_value = True

        mock_func2 = Mock()
        mock_func2.call.return_value = True

        transactions = [
            (mock_func1, 0),
            (mock_func2, 0),
        ]

        results = simulator.simulate_batch(
            transactions=transactions,
            from_address="0x" + "2" * 40,
        )

        assert len(results) == 2
        assert results[0]["success"] is True
        assert results[1]["success"] is True

    def test_simulate_batch_stops_on_failure(self, simulator):
        """Batch simulation stops after failure."""
        mock_func1 = Mock()
        mock_func1.call.side_effect = Exception("revert")

        mock_func2 = Mock()
        mock_func2.call.return_value = True

        transactions = [
            (mock_func1, 0),
            (mock_func2, 0),
        ]

        results = simulator.simulate_batch(
            transactions=transactions,
            from_address="0x" + "2" * 40,
        )

        # Should stop after first failure
        assert len(results) == 1
        assert results[0]["success"] is False

    def test_simulate_includes_transaction_data(self, simulator):
        """Simulation result should include transaction data."""
        mock_function = Mock()
        mock_function.call.return_value = True
        simulator.tx_builder.build_transaction.return_value = {
            "from": "0x" + "0" * 40,
            "to": "0x" + "1" * 40,
            "gas": 50000,
            "gasPrice": 20_000_000_000,
            "data": "0x12345678",
        }

        result = simulator.simulate(
            contract_function=mock_function,
            from_address="0x" + "2" * 40,
        )

        assert "transaction" in result
        assert result["transaction"]["gas"] == 50000
"""Tests for simulator edge cases to achieve 100% coverage."""

import pytest
from decimal import Decimal


class TestSimulatorGasPriceBranches:
    """Test gas price branches in simulator."""
    
    def test_simulate_with_max_fee_per_gas(self):
        """Test simulation with EIP-1559 maxFeePerGas."""
        from abi_to_mcp.runtime.simulator import TransactionSimulator
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.chain_id = 1
        
        # Create mock contract function
        mock_contract_func = Mock()
        mock_contract_func.call.return_value = "result"
        
        # Create mock transaction with EIP-1559 fee
        mock_tx = {
            "gas": 21000,
            "maxFeePerGas": 100000000000,  # 100 gwei
        }
        mock_contract_func.build_transaction.return_value = mock_tx
        
        # Mock client
        mock_client = Mock(spec=Web3Client)
        mock_client.w3 = mock_w3
        mock_client.get_transaction_count.return_value = 5
        
        simulator = TransactionSimulator(mock_client)
        
        result = simulator.simulate(
            contract_function=mock_contract_func,
            from_address="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        )
        
        assert result["success"] is True
        assert result["gas_price_wei"] == 100000000000
    
    def test_simulate_with_legacy_gas_price(self):
        """Test simulation with legacy gasPrice."""
        from abi_to_mcp.runtime.simulator import TransactionSimulator
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.chain_id = 1
        
        mock_contract_func = Mock()
        mock_contract_func.call.return_value = "result"
        
        # Create mock transaction with legacy gas price
        mock_tx = {
            "gas": 21000,
            "gasPrice": 50000000000,  # 50 gwei
        }
        mock_contract_func.build_transaction.return_value = mock_tx
        
        mock_client = Mock(spec=Web3Client)
        mock_client.w3 = mock_w3
        mock_client.get_transaction_count.return_value = 5
        
        simulator = TransactionSimulator(mock_client)
        
        result = simulator.simulate(
            contract_function=mock_contract_func,
            from_address="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        )
        
        assert result["success"] is True
        assert result["gas_price_wei"] == 50000000000
    
    def test_simulate_fallback_gas_price(self):
        """Test simulation with fallback gas price from network."""
        from abi_to_mcp.runtime.simulator import TransactionSimulator
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.chain_id = 1
        mock_w3.eth.gas_price = 75000000000  # 75 gwei
        
        mock_contract_func = Mock()
        mock_contract_func.call.return_value = "result"
        
        # Create mock transaction without gas price
        mock_tx = {
            "gas": 21000,
            # No gas price fields
        }
        mock_contract_func.build_transaction.return_value = mock_tx
        
        mock_client = Mock(spec=Web3Client)
        mock_client.w3 = mock_w3
        mock_client.get_transaction_count.return_value = 5
        
        simulator = TransactionSimulator(mock_client)
        
        result = simulator.simulate(
            contract_function=mock_contract_func,
            from_address="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        )
        
        assert result["success"] is True
        assert result["gas_price_wei"] == 75000000000
    
    def test_simulate_call_reverts(self):
        """Test simulation when call reverts."""
        from abi_to_mcp.runtime.simulator import TransactionSimulator
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.chain_id = 1
        
        mock_contract_func = Mock()
        mock_contract_func.call.side_effect = Exception("execution reverted: insufficient balance")
        
        mock_tx = {
            "gas": 21000,
            "gasPrice": 50000000000,
        }
        mock_contract_func.build_transaction.return_value = mock_tx
        
        mock_client = Mock(spec=Web3Client)
        mock_client.w3 = mock_w3
        mock_client.get_transaction_count.return_value = 5
        
        simulator = TransactionSimulator(mock_client)
        
        result = simulator.simulate(
            contract_function=mock_contract_func,
            from_address="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        )
        
        assert result["success"] is False
        assert "insufficient balance" in result["error"]
    
    def test_simulate_outer_exception(self):
        """Test simulation with outer exception raises SimulationError."""
        from abi_to_mcp.runtime.simulator import TransactionSimulator
        from abi_to_mcp.runtime.web3_client import Web3Client
        from abi_to_mcp.runtime.transaction import TransactionBuilder
        
        mock_contract_func = Mock()
        
        mock_client = Mock(spec=Web3Client)
        mock_client.get_transaction_count.return_value = 5
        
        simulator = TransactionSimulator(mock_client)
        
        # Make the tx_builder.build_transaction raise an exception
        with patch.object(simulator.tx_builder, 'build_transaction', side_effect=Exception("Network error")):
            with pytest.raises(SimulationError, match="Transaction simulation failed"):
                simulator.simulate(
                    contract_function=mock_contract_func,
                    from_address="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
                )


class TestSimulatorWithValue:
    """Test simulator with value parameter."""
    
    def test_simulate_with_value(self):
        """Test simulation with ETH value."""
        from abi_to_mcp.runtime.simulator import TransactionSimulator
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.chain_id = 1
        
        mock_contract_func = Mock()
        mock_contract_func.call.return_value = "result"
        
        mock_tx = {
            "gas": 50000,
            "gasPrice": 50000000000,
            "value": 1000000000000000000,  # 1 ETH
        }
        mock_contract_func.build_transaction.return_value = mock_tx
        
        mock_client = Mock(spec=Web3Client)
        mock_client.w3 = mock_w3
        mock_client.get_transaction_count.return_value = 5
        
        simulator = TransactionSimulator(mock_client)
        
        result = simulator.simulate(
            contract_function=mock_contract_func,
            from_address="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
            value=1000000000000000000,
        )
        
        assert result["success"] is True
        assert result["transaction"]["value"] == 1000000000000000000
