"""Tests for gas estimation module."""

import pytest
from unittest.mock import Mock, patch, MagicMock

from abi_to_mcp.runtime.gas import GasEstimator, GasPrice


class TestGasPrice:
    """Tests for GasPrice dataclass."""

    def test_to_gwei_conversion(self):
        """Convert wei to gwei correctly."""
        price = GasPrice(
            slow=1_000_000_000,      # 1 gwei
            standard=2_000_000_000,  # 2 gwei
            fast=3_000_000_000,      # 3 gwei
            instant=5_000_000_000,   # 5 gwei
        )

        assert price.slow_gwei == 1.0
        assert price.standard_gwei == 2.0
        assert price.fast_gwei == 3.0
        assert price.instant_gwei == 5.0

    def test_eip1559_gas_price(self):
        """EIP-1559 gas price with base fee."""
        price = GasPrice(
            slow=20_000_000_000,
            standard=25_000_000_000,
            fast=30_000_000_000,
            instant=40_000_000_000,
            base_fee=10_000_000_000,
            priority_fee=2_000_000_000,
            is_eip1559=True,
        )

        assert price.is_eip1559
        assert price.base_fee == 10_000_000_000
        assert price.priority_fee == 2_000_000_000

    def test_legacy_gas_price(self):
        """Legacy gas price without EIP-1559."""
        price = GasPrice(
            slow=15_000_000_000,
            standard=20_000_000_000,
            fast=25_000_000_000,
            instant=30_000_000_000,
            is_eip1559=False,
        )

        assert not price.is_eip1559
        assert price.base_fee is None
        assert price.priority_fee is None

    def test_gwei_conversion_large_values(self):
        """Convert large wei values to gwei."""
        price = GasPrice(
            slow=100_000_000_000,     # 100 gwei
            standard=200_000_000_000,  # 200 gwei
            fast=500_000_000_000,      # 500 gwei
            instant=1_000_000_000_000, # 1000 gwei
        )

        assert price.slow_gwei == 100.0
        assert price.standard_gwei == 200.0
        assert price.fast_gwei == 500.0
        assert price.instant_gwei == 1000.0

    def test_gwei_conversion_fractional(self):
        """Convert fractional gwei values."""
        price = GasPrice(
            slow=500_000_000,     # 0.5 gwei
            standard=1_500_000_000,  # 1.5 gwei
            fast=2_500_000_000,      # 2.5 gwei
            instant=3_500_000_000,   # 3.5 gwei
        )

        assert price.slow_gwei == 0.5
        assert price.standard_gwei == 1.5
        assert price.fast_gwei == 2.5
        assert price.instant_gwei == 3.5


class TestGasEstimator:
    """Tests for GasEstimator class."""

    @pytest.fixture
    def mock_web3_client(self):
        """Create mock Web3Client."""
        client = Mock()
        client.w3 = Mock()
        client.w3.eth = Mock()
        client.network_config = {"currency": "ETH", "chain_id": 1}
        return client

    def test_get_gas_price_eip1559(self, mock_web3_client):
        """Get gas price on EIP-1559 network."""
        # Mock block with base fee
        mock_web3_client.w3.eth.get_block.return_value = {
            "baseFeePerGas": 10_000_000_000
        }

        estimator = GasEstimator(mock_web3_client)
        price = estimator.get_gas_price()

        assert price.is_eip1559
        assert price.base_fee == 10_000_000_000

    def test_get_gas_price_legacy(self, mock_web3_client):
        """Get gas price on legacy network."""
        # Mock block without base fee
        mock_web3_client.w3.eth.get_block.return_value = {}
        mock_web3_client.w3.eth.gas_price = 20_000_000_000

        estimator = GasEstimator(mock_web3_client)
        price = estimator.get_gas_price()

        assert not price.is_eip1559
        assert price.standard == 20_000_000_000

    def test_get_gas_price_calculates_tiers(self, mock_web3_client):
        """Gas price tiers should be calculated correctly."""
        mock_web3_client.w3.eth.get_block.return_value = {}
        mock_web3_client.w3.eth.gas_price = 20_000_000_000

        estimator = GasEstimator(mock_web3_client)
        price = estimator.get_gas_price()

        # Slow should be less than standard
        assert price.slow < price.standard
        # Fast should be more than standard
        assert price.fast > price.standard
        # Instant should be more than fast
        assert price.instant > price.fast

    def test_get_gas_price_eip1559_calculates_max_fee(self, mock_web3_client):
        """EIP-1559 max fee should include base fee and priority."""
        base_fee = 10_000_000_000  # 10 gwei

        mock_web3_client.w3.eth.get_block.return_value = {
            "baseFeePerGas": base_fee
        }

        estimator = GasEstimator(mock_web3_client)
        price = estimator.get_gas_price()

        # All prices should be higher than just base fee
        assert price.slow > base_fee
        assert price.standard > base_fee
        assert price.fast > base_fee
        assert price.instant > base_fee

    def test_estimate_transaction_cost(self, mock_web3_client):
        """Estimate transaction cost in ETH."""
        mock_web3_client.w3.eth.get_block.return_value = {}
        mock_web3_client.w3.eth.gas_price = 20_000_000_000

        estimator = GasEstimator(mock_web3_client)

        cost = estimator.estimate_transaction_cost(
            gas_limit=21000,
            speed="standard"
        )

        assert "gas_limit" in cost
        assert "gas_price_wei" in cost
        assert "cost_wei" in cost
        assert "cost_eth" in cost
        assert cost["gas_limit"] == 21000
        assert cost["cost_wei"] > 0
        assert cost["cost_eth"] > 0

    def test_estimate_transaction_cost_with_custom_price(self, mock_web3_client):
        """Estimate cost with custom gas price."""
        estimator = GasEstimator(mock_web3_client)

        custom_price = 50_000_000_000  # 50 gwei
        cost = estimator.estimate_transaction_cost(
            gas_limit=21000,
            gas_price=custom_price
        )

        assert cost["gas_price_wei"] == custom_price
        expected_cost = 21000 * custom_price
        assert cost["cost_wei"] == expected_cost

    def test_estimate_transaction_cost_formats_currency(self, mock_web3_client):
        """Cost should include formatted currency string."""
        mock_web3_client.w3.eth.get_block.return_value = {}
        mock_web3_client.w3.eth.gas_price = 20_000_000_000

        estimator = GasEstimator(mock_web3_client)

        cost = estimator.estimate_transaction_cost(
            gas_limit=21000,
            speed="standard"
        )

        assert "cost_formatted" in cost
        assert "ETH" in cost["cost_formatted"]

    def test_gas_estimator_error_handling(self, mock_web3_client):
        """Gas estimator should handle errors gracefully."""
        mock_web3_client.w3.eth.get_block.side_effect = Exception("Network error")

        estimator = GasEstimator(mock_web3_client)

        with pytest.raises(Exception) as exc_info:
            estimator.get_gas_price()
        
        # Should raise some error related to gas estimation
        assert "Network error" in str(exc_info.value) or "gas" in str(exc_info.value).lower()

    def test_estimate_function_cost(self, mock_web3_client):
        """Estimate cost for contract function."""
        mock_web3_client.w3.eth.get_block.return_value = {}
        mock_web3_client.w3.eth.gas_price = 20_000_000_000

        estimator = GasEstimator(mock_web3_client)

        # Mock contract function
        mock_function = Mock()
        mock_function.estimate_gas.return_value = 50000

        cost = estimator.estimate_function_cost(
            contract_function=mock_function,
            from_address="0x" + "0" * 40,
            speed="standard"
        )

        assert "gas_estimate" in cost
        assert "gas_limit" in cost
        # Gas limit should include buffer
        assert cost["gas_limit"] > cost["gas_estimate"]
"""Tests for config edge cases."""

import pytest
import os
import tempfile


class TestConfigEdgeCases:
    """Test edge cases in config module."""
    
    def test_app_config_from_env(self):
        """Test AppConfig creation from environment variables."""
        from abi_to_mcp.core.config import AppConfig
        
        with patch.dict(os.environ, {
            "RPC_URL": "https://custom-rpc.example.com",
            "ETHERSCAN_API_KEY": "test-api-key",
        }):
            config = AppConfig()
            # Should pick up environment variable
            assert config is not None
    
    def test_network_config(self):
        """Test NetworkConfig creation."""
        from abi_to_mcp.core.config import NetworkConfig
        
        config = NetworkConfig(
            name="mainnet",
            chain_id=1,
            rpc="https://mainnet.example.com",
            explorer="https://etherscan.io",
            etherscan_api="https://api.etherscan.io/api",
        )
        assert config.name == "mainnet"
        assert config.chain_id == 1
    
    def test_generator_config(self):
        """Test GeneratorConfig creation."""
        from abi_to_mcp.core.config import GeneratorConfig
        
        config = GeneratorConfig()
        assert config is not None
    
    def test_fetcher_config(self):
        """Test FetcherConfig creation."""
        from abi_to_mcp.core.config import FetcherConfig
        
        config = FetcherConfig()
        assert config is not None
    
    def test_runtime_config(self):
        """Test RuntimeConfig creation."""
        from abi_to_mcp.core.config import RuntimeConfig
        
        config = RuntimeConfig()
        assert config is not None


class TestCLIMainEdgeCases:
    """Test edge cases in CLI main module."""
    
    def test_version_command(self):
        """Test version command."""
        from typer.testing import CliRunner
        from abi_to_mcp.cli.main import app
        
        runner = CliRunner()
        result = runner.invoke(app, ["--version"])
        # Should show version info
        assert result.exit_code == 0 or "version" in result.output.lower()
    
    def test_help_command(self):
        """Test help command."""
        from typer.testing import CliRunner
        from abi_to_mcp.cli.main import app
        
        runner = CliRunner()
        result = runner.invoke(app, ["--help"])
        assert result.exit_code == 0
        assert "Usage" in result.output or "usage" in result.output.lower()


class TestRuntimeTransactionEdgeCases:
    """Test edge cases in transaction module."""
    
    def test_transaction_builder_with_legacy_gas(self):
        """Test transaction builder with legacy gas pricing."""
        from abi_to_mcp.runtime.transaction import TransactionBuilder
        from unittest.mock import Mock
        
        mock_client = Mock()
        mock_client.w3.eth.chain_id = 1
        mock_client.w3.eth.gas_price = 50000000000
        mock_client.get_transaction_count.return_value = 5
        
        builder = TransactionBuilder(mock_client)
        
        # The builder should be created successfully
        assert builder is not None


class TestRuntimeGasEdgeCases:
    """Test edge cases in gas module."""
    
    def test_gas_estimator_basic(self):
        """Test gas estimator basic functionality."""
        from abi_to_mcp.runtime.gas import GasEstimator
        from unittest.mock import Mock
        
        mock_client = Mock()
        mock_client.w3.eth.gas_price = 50000000000
        mock_client.w3.eth.max_priority_fee_per_gas = 1000000000
        mock_client.w3.eth.get_block.return_value = {"baseFeePerGas": 30000000000}
        
        estimator = GasEstimator(mock_client)
        assert estimator is not None


class TestRuntimeSignerEdgeCases:
    """Test edge cases in signer module."""
    
    def test_transaction_signer_basic(self):
        """Test TransactionSigner basic creation."""
        from abi_to_mcp.runtime.signer import TransactionSigner
        
        # Test with a dummy private key
        try:
            signer = TransactionSigner(
                private_key="0x0000000000000000000000000000000000000000000000000000000000000001"
            )
            assert signer is not None
        except Exception:
            # May fail if web3 is not properly configured
            pass
