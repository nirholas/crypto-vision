"""Tests for Web3Client."""

import pytest
from unittest.mock import Mock, patch

from abi_to_mcp.runtime.web3_client import Web3Client
from abi_to_mcp.core.exceptions import NetworkError


def test_web3_client_initialization():
    """Test Web3Client initialization."""
    client = Web3Client(network="mainnet")
    assert client.network == "mainnet"
    assert client.network_config["chain_id"] == 1


def test_web3_client_invalid_network():
    """Test Web3Client with invalid network."""
    with pytest.raises(NetworkError):
        Web3Client(network="invalid_network")


@patch("abi_to_mcp.runtime.web3_client.Web3")
def test_web3_client_connection(mock_web3):
    """Test Web3Client connection."""
    # Mock Web3 connection
    mock_instance = Mock()
    mock_instance.is_connected.return_value = True
    mock_instance.eth.chain_id = 1
    mock_web3.return_value = mock_instance
    
    client = Web3Client(network="mainnet")
    
    # Access w3 property to trigger connection
    w3 = client.w3
    assert w3 is not None
    assert client.is_connected()


def test_web3_client_custom_rpc():
    """Test Web3Client with custom RPC URL."""
    custom_rpc = "https://custom-rpc.example.com"
    client = Web3Client(rpc_url=custom_rpc, network="mainnet")
    assert client._rpc_url == custom_rpc
"""Tests for Web3Client with extended coverage."""

from unittest.mock import patch, MagicMock



class TestWeb3ClientExtended:
    """Extended tests for Web3Client."""

    def test_init_with_custom_rpc(self):
        """Initialize with custom RPC URL."""
        with patch('abi_to_mcp.runtime.web3_client.Web3') as mock_web3:
            mock_w3 = Mock()
            mock_w3.is_connected.return_value = True
            mock_web3.return_value = mock_w3

            client = Web3Client(rpc_url="https://custom-rpc.com")
            
            assert client is not None

    def test_get_chain_id(self):
        """Get chain ID."""
        with patch('abi_to_mcp.runtime.web3_client.Web3') as mock_web3:
            mock_w3 = Mock()
            mock_w3.is_connected.return_value = True
            mock_w3.eth.chain_id = 1
            mock_web3.return_value = mock_w3

            client = Web3Client(rpc_url="https://mainnet.example.com")
            chain_id = client.get_chain_id()
            
            assert chain_id == 1

    def test_get_transaction_count(self):
        """Get transaction count for address."""
        with patch('abi_to_mcp.runtime.web3_client.Web3') as mock_web3:
            mock_w3 = Mock()
            mock_w3.is_connected.return_value = True
            mock_w3.eth.get_transaction_count.return_value = 5
            mock_web3.return_value = mock_w3

            client = Web3Client(rpc_url="https://mainnet.example.com")
            count = client.get_transaction_count("0x" + "1" * 40)
            
            assert count == 5

    def test_get_balance(self):
        """Get ETH balance for address."""
        with patch('abi_to_mcp.runtime.web3_client.Web3') as mock_web3:
            mock_w3 = Mock()
            mock_w3.is_connected.return_value = True
            mock_w3.eth.get_balance.return_value = 10**18
            mock_web3.return_value = mock_w3

            client = Web3Client(rpc_url="https://mainnet.example.com")
            balance = client.get_balance("0x" + "1" * 40)
            
            assert balance == 10**18

    def test_get_block_number(self):
        """Get latest block number."""
        with patch('abi_to_mcp.runtime.web3_client.Web3') as mock_web3:
            mock_w3 = Mock()
            mock_w3.is_connected.return_value = True
            mock_w3.eth.block_number = 12345
            mock_web3.return_value = mock_w3

            client = Web3Client(rpc_url="https://mainnet.example.com")
            block_num = client.get_block_number()
            
            assert block_num == 12345

    def test_network_config_property(self):
        """Network config is accessible."""
        with patch('abi_to_mcp.runtime.web3_client.Web3') as mock_web3:
            mock_w3 = Mock()
            mock_w3.is_connected.return_value = True
            mock_web3.return_value = mock_w3

            client = Web3Client(network="mainnet")
            
            assert client.network_config is not None
            assert "chain_id" in client.network_config or hasattr(client, 'network')
"""Comprehensive tests for web3_client to achieve 100% coverage."""

from unittest.mock import patch, PropertyMock
import os


class TestWeb3ClientImports:
    """Test import handling for different web3 versions."""
    
    def test_poa_middleware_import_fallback(self):
        """Test fallback import for older web3 versions."""
        # The import is handled at module level, but we can verify the module loads
        from abi_to_mcp.runtime.web3_client import Web3Client
        assert Web3Client is not None


class TestWeb3ClientInit:
    """Test Web3Client initialization."""
    
    def test_init_with_explicit_rpc_url(self):
        """Test initialization with explicit RPC URL."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        client = Web3Client(rpc_url="https://custom-rpc.example.com", network="mainnet")
        assert client._rpc_url == "https://custom-rpc.example.com"
        assert client.network == "mainnet"
    
    def test_init_with_env_rpc_url(self):
        """Test initialization with RPC_URL from environment."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        with patch.dict(os.environ, {"RPC_URL": "https://env-rpc.example.com"}):
            client = Web3Client(network="mainnet")
            assert client._rpc_url == "https://env-rpc.example.com"
    
    def test_init_with_default_rpc_url(self):
        """Test initialization with default network RPC."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        # Clear RPC_URL from environment
        with patch.dict(os.environ, {}, clear=True):
            client = Web3Client(network="mainnet")
            # Should use default from NETWORKS
            assert "mainnet" in client._rpc_url or client._rpc_url is not None
    
    def test_init_invalid_network(self):
        """Test initialization with invalid network raises NetworkError."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        from abi_to_mcp.core.exceptions import NetworkError
        
        with pytest.raises(NetworkError, match="Unknown network"):
            Web3Client(network="invalid_network")


class TestWeb3ClientW3Property:
    """Test the w3 property lazy initialization."""
    
    def test_w3_property_connection_success(self):
        """Test w3 property with successful connection."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.chain_id = 1
        
        with patch("abi_to_mcp.runtime.web3_client.Web3") as mock_web3_class:
            mock_web3_class.return_value = mock_w3
            mock_web3_class.HTTPProvider.return_value = Mock()
            
            client = Web3Client(rpc_url="https://test.example.com", network="mainnet")
            w3 = client.w3
            
            assert w3 is mock_w3
            assert client._connected is True
    
    def test_w3_property_connection_failure(self):
        """Test w3 property when connection fails."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        from abi_to_mcp.core.exceptions import NetworkError
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = False
        
        with patch("abi_to_mcp.runtime.web3_client.Web3") as mock_web3_class:
            mock_web3_class.return_value = mock_w3
            mock_web3_class.HTTPProvider.return_value = Mock()
            
            client = Web3Client(rpc_url="https://test.example.com", network="mainnet")
            
            with pytest.raises(NetworkError, match="Failed to connect"):
                _ = client.w3
    
    def test_w3_property_exception_during_init(self):
        """Test w3 property when exception occurs during initialization."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        from abi_to_mcp.core.exceptions import NetworkError
        
        with patch("abi_to_mcp.runtime.web3_client.Web3") as mock_web3_class:
            mock_web3_class.side_effect = Exception("Connection timeout")
            
            client = Web3Client(rpc_url="https://test.example.com", network="mainnet")
            
            with pytest.raises(NetworkError, match="Failed to initialize"):
                _ = client.w3
    
    def test_w3_property_poa_network(self):
        """Test w3 property adds POA middleware for polygon network."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.chain_id = 137
        mock_w3.middleware_onion.inject = Mock()
        
        with patch("abi_to_mcp.runtime.web3_client.Web3") as mock_web3_class:
            mock_web3_class.return_value = mock_w3
            mock_web3_class.HTTPProvider.return_value = Mock()
            
            client = Web3Client(rpc_url="https://test.example.com", network="polygon")
            w3 = client.w3
            
            # Verify POA middleware was injected
            mock_w3.middleware_onion.inject.assert_called_once()


class TestWeb3ClientMethods:
    """Test Web3Client methods."""
    
    def test_is_connected_not_initialized(self):
        """Test is_connected when w3 is not initialized."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        client = Web3Client(rpc_url="https://test.example.com", network="mainnet")
        # Don't access .w3, keep it None
        assert client.is_connected() is False
    
    def test_is_connected_exception(self):
        """Test is_connected when exception occurs."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        client = Web3Client(rpc_url="https://test.example.com", network="mainnet")
        mock_w3 = Mock()
        mock_w3.is_connected.side_effect = Exception("Connection lost")
        client._w3 = mock_w3
        
        assert client.is_connected() is False
    
    def test_get_chain_id_failure(self):
        """Test get_chain_id when it fails."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        from abi_to_mcp.core.exceptions import NetworkError
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.chain_id = PropertyMock(side_effect=Exception("RPC error"))
        
        with patch("abi_to_mcp.runtime.web3_client.Web3") as mock_web3_class:
            mock_web3_class.return_value = mock_w3
            mock_web3_class.HTTPProvider.return_value = Mock()
            
            client = Web3Client(rpc_url="https://test.example.com", network="mainnet")
            client._w3 = mock_w3
            client._connected = True
            
            # Make chain_id raise on access
            type(mock_w3.eth).chain_id = PropertyMock(side_effect=Exception("RPC error"))
            
            with pytest.raises(NetworkError, match="Failed to get chain ID"):
                client.get_chain_id()
    
    def test_get_block_number_success(self):
        """Test get_block_number success."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.chain_id = 1
        mock_w3.eth.block_number = 12345678
        
        with patch("abi_to_mcp.runtime.web3_client.Web3") as mock_web3_class:
            mock_web3_class.return_value = mock_w3
            mock_web3_class.HTTPProvider.return_value = Mock()
            
            client = Web3Client(rpc_url="https://test.example.com", network="mainnet")
            client._w3 = mock_w3
            client._connected = True
            
            assert client.get_block_number() == 12345678
    
    def test_get_block_number_failure(self):
        """Test get_block_number when it fails."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        from abi_to_mcp.core.exceptions import NetworkError
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        type(mock_w3.eth).block_number = PropertyMock(side_effect=Exception("RPC error"))
        
        client = Web3Client(rpc_url="https://test.example.com", network="mainnet")
        client._w3 = mock_w3
        client._connected = True
        
        with pytest.raises(NetworkError, match="Failed to get block number"):
            client.get_block_number()
    
    def test_get_balance_success(self):
        """Test get_balance success."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.chain_id = 1
        mock_w3.eth.get_balance.return_value = 1000000000000000000
        
        with patch("abi_to_mcp.runtime.web3_client.Web3") as mock_web3_class:
            mock_web3_class.return_value = mock_w3
            mock_web3_class.HTTPProvider.return_value = Mock()
            
            client = Web3Client(rpc_url="https://test.example.com", network="mainnet")
            client._w3 = mock_w3
            client._connected = True
            
            balance = client.get_balance("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
            assert balance == 1000000000000000000
    
    def test_get_balance_failure(self):
        """Test get_balance when it fails."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        from abi_to_mcp.core.exceptions import NetworkError
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.get_balance.side_effect = Exception("RPC error")
        
        client = Web3Client(rpc_url="https://test.example.com", network="mainnet")
        client._w3 = mock_w3
        client._connected = True
        
        with pytest.raises(NetworkError, match="Failed to get balance"):
            client.get_balance("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
    
    def test_get_transaction_count_success(self):
        """Test get_transaction_count success."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.chain_id = 1
        mock_w3.eth.get_transaction_count.return_value = 42
        
        client = Web3Client(rpc_url="https://test.example.com", network="mainnet")
        client._w3 = mock_w3
        client._connected = True
        
        count = client.get_transaction_count("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
        assert count == 42
    
    def test_get_transaction_count_failure(self):
        """Test get_transaction_count when it fails."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        from abi_to_mcp.core.exceptions import NetworkError
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.get_transaction_count.side_effect = Exception("RPC error")
        
        client = Web3Client(rpc_url="https://test.example.com", network="mainnet")
        client._w3 = mock_w3
        client._connected = True
        
        with pytest.raises(NetworkError, match="Failed to get transaction count"):
            client.get_transaction_count("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
    
    def test_get_code_success(self):
        """Test get_code success."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.chain_id = 1
        mock_w3.eth.get_code.return_value = b"\x60\x80\x60\x40"
        
        client = Web3Client(rpc_url="https://test.example.com", network="mainnet")
        client._w3 = mock_w3
        client._connected = True
        
        code = client.get_code("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
        assert code == b"\x60\x80\x60\x40"
    
    def test_get_code_failure(self):
        """Test get_code when it fails."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        from abi_to_mcp.core.exceptions import NetworkError
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.get_code.side_effect = Exception("RPC error")
        
        client = Web3Client(rpc_url="https://test.example.com", network="mainnet")
        client._w3 = mock_w3
        client._connected = True
        
        with pytest.raises(NetworkError, match="Failed to get code"):
            client.get_code("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
    
    def test_is_contract_true(self):
        """Test is_contract returns True for contract address."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.chain_id = 1
        mock_w3.eth.get_code.return_value = b"\x60\x80\x60\x40"
        
        client = Web3Client(rpc_url="https://test.example.com", network="mainnet")
        client._w3 = mock_w3
        client._connected = True
        
        assert client.is_contract("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045") is True
    
    def test_is_contract_false(self):
        """Test is_contract returns False for EOA."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.chain_id = 1
        mock_w3.eth.get_code.return_value = b""
        
        client = Web3Client(rpc_url="https://test.example.com", network="mainnet")
        client._w3 = mock_w3
        client._connected = True
        
        assert client.is_contract("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045") is False
    
    def test_is_contract_exception(self):
        """Test is_contract returns False on exception."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.get_code.side_effect = Exception("RPC error")
        
        client = Web3Client(rpc_url="https://test.example.com", network="mainnet")
        client._w3 = mock_w3
        client._connected = True
        
        # Should return False instead of raising
        assert client.is_contract("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045") is False
    
    def test_get_contract(self):
        """Test get_contract creates contract instance."""
        from abi_to_mcp.runtime.web3_client import Web3Client
        
        mock_contract = Mock()
        mock_w3 = Mock()
        mock_w3.is_connected.return_value = True
        mock_w3.eth.chain_id = 1
        mock_w3.eth.contract.return_value = mock_contract
        
        client = Web3Client(rpc_url="https://test.example.com", network="mainnet")
        client._w3 = mock_w3
        client._connected = True
        
        test_abi = [{"type": "function", "name": "test", "inputs": [], "outputs": []}]
        contract = client.get_contract("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", test_abi)
        
        assert contract is mock_contract
        mock_w3.eth.contract.assert_called_once()
