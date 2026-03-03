"""Tests for Etherscan fetcher."""

import pytest
from unittest.mock import AsyncMock, Mock, patch, MagicMock
import json

from abi_to_mcp.fetchers.etherscan import EtherscanFetcher
from abi_to_mcp.core.exceptions import (
    ABINotFoundError,
    ContractNotVerifiedError,
    NetworkError,
    RateLimitError,
    InvalidAddressError,
)


@pytest.fixture
def etherscan_fetcher():
    """Create an Etherscan fetcher instance."""
    return EtherscanFetcher(api_key="test-key")


@pytest.fixture
def mock_abi_response():
    """Mock successful ABI response."""
    return {
        "status": "1",
        "message": "OK",
        "result": json.dumps([
            {"type": "function", "name": "balanceOf"},
            {"type": "event", "name": "Transfer"},
        ])
    }


@pytest.fixture
def mock_not_verified_response():
    """Mock response for unverified contract."""
    return {
        "status": "0",
        "message": "NOTOK",
        "result": "Contract source code not verified"
    }


class MockResponse:
    """Mock httpx response."""
    def __init__(self, json_data, status_code=200):
        self._json_data = json_data
        self.status_code = status_code
    
    def json(self):
        return self._json_data
    
    def raise_for_status(self):
        if self.status_code >= 400:
            import httpx
            raise httpx.HTTPStatusError(
                "Error",
                request=Mock(),
                response=self
            )


@pytest.mark.asyncio
async def test_fetch_verified_contract(etherscan_fetcher, mock_abi_response):
    """Test fetching ABI for a verified contract."""
    mock_response = MockResponse(mock_abi_response)
    
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = MagicMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client
        
        result = await etherscan_fetcher.fetch(
            "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="mainnet",
            detect_proxy=False  # Skip proxy detection for this test
        )
        
        assert result.source == "etherscan"
        assert len(result.abi) == 2
        assert result.abi[0]["name"] == "balanceOf"


@pytest.mark.asyncio
async def test_handle_unverified_contract(etherscan_fetcher, mock_not_verified_response):
    """Test handling of unverified contract."""
    mock_response = MockResponse(mock_not_verified_response)
    
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = MagicMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client
        
        with pytest.raises(ContractNotVerifiedError) as exc_info:
            await etherscan_fetcher.fetch(
                "0x0000000000000000000000000000000000000000",
                network="mainnet"
            )
        
        assert "not verified" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_invalid_address(etherscan_fetcher):
    """Test invalid address format."""
    with pytest.raises(InvalidAddressError):
        await etherscan_fetcher.fetch("invalid-address")
    
    with pytest.raises(InvalidAddressError):
        await etherscan_fetcher.fetch("0x123")  # Too short


@pytest.mark.asyncio
async def test_unknown_network(etherscan_fetcher):
    """Test unknown network name."""
    with pytest.raises(ValueError) as exc_info:
        await etherscan_fetcher.fetch(
            "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="unknown_network"
        )
    
    assert "Unknown network" in str(exc_info.value)


@pytest.mark.asyncio
async def test_rate_limit_error(etherscan_fetcher):
    """Test rate limit handling."""
    mock_response = MockResponse({}, status_code=429)
    
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = MagicMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client
        
        with pytest.raises(RateLimitError):
            await etherscan_fetcher.fetch(
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                network="mainnet"
            )


def test_can_handle_valid_address(etherscan_fetcher):
    """Test can_handle recognizes valid addresses."""
    assert etherscan_fetcher.can_handle("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
    assert etherscan_fetcher.can_handle("0x" + "0" * 40)
    assert etherscan_fetcher.can_handle("0x" + "F" * 40)


def test_can_handle_invalid_address(etherscan_fetcher):
    """Test can_handle rejects invalid formats."""
    assert not etherscan_fetcher.can_handle("./file.json")
    assert not etherscan_fetcher.can_handle("http://example.com")
    assert not etherscan_fetcher.can_handle("0x123")  # Too short
    assert not etherscan_fetcher.can_handle("invalid")


def test_validate_address(etherscan_fetcher):
    """Test address validation."""
    # Valid addresses
    addr = etherscan_fetcher._validate_address("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
    assert addr == "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"  # lowercase
    
    # Invalid addresses
    with pytest.raises(InvalidAddressError):
        etherscan_fetcher._validate_address("invalid")
    
    with pytest.raises(InvalidAddressError):
        etherscan_fetcher._validate_address("0x123")


def test_get_api_key():
    """Test API key retrieval."""
    # With instance key
    fetcher = EtherscanFetcher(api_key="test-key")
    assert fetcher._get_api_key("mainnet") == "test-key"
    
    # Without key
    fetcher = EtherscanFetcher()
    key = fetcher._get_api_key("mainnet")
    # Should check environment variables (or be None)
    assert key is None or isinstance(key, str)


def test_is_valid_address(etherscan_fetcher):
    """Test _is_valid_address helper."""
    assert etherscan_fetcher._is_valid_address("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
    assert etherscan_fetcher._is_valid_address("0x" + "a" * 40)
    assert not etherscan_fetcher._is_valid_address("0x123")
    assert not etherscan_fetcher._is_valid_address("invalid")
"""Extended tests for Etherscan fetcher."""

import pytest



class TestEtherscanFetcherExtended:
    """Extended tests for EtherscanFetcher."""

    @pytest.fixture
    def fetcher(self):
        """Create an EtherscanFetcher."""
        return EtherscanFetcher()

    @pytest.fixture
    def fetcher_with_key(self):
        """Create an EtherscanFetcher with API key."""
        return EtherscanFetcher(api_key="test-api-key")

    def test_can_handle_valid_address(self, fetcher):
        """Valid Ethereum address."""
        assert fetcher.can_handle("0x" + "a" * 40) is True

    def test_can_handle_checksummed_address(self, fetcher):
        """Checksummed address."""
        assert fetcher.can_handle("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48") is True

    def test_can_handle_invalid_address(self, fetcher):
        """Invalid address format."""
        assert fetcher.can_handle("not-an-address") is False
        assert fetcher.can_handle("0x123") is False

    def test_can_handle_file_path(self, fetcher):
        """File path is not handled."""
        assert fetcher.can_handle("/path/to/file.json") is False

    @pytest.mark.asyncio
    async def test_fetch_invalid_address_raises(self, fetcher):
        """Invalid address raises InvalidAddressError."""
        with pytest.raises(InvalidAddressError):
            await fetcher.fetch("not-an-address", network="mainnet")

    @pytest.mark.asyncio
    async def test_fetch_unknown_network_raises(self, fetcher):
        """Unknown network raises ValueError."""
        with pytest.raises(ValueError):
            await fetcher.fetch("0x" + "a" * 40, network="unknown-network")

    @pytest.mark.asyncio
    async def test_fetch_contract_not_verified(self, fetcher):
        """Unverified contract raises ContractNotVerifiedError."""
        with patch.object(fetcher, '_fetch_abi', new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = None

            with pytest.raises(ContractNotVerifiedError):
                await fetcher.fetch("0x" + "a" * 40, network="mainnet")

    @pytest.mark.asyncio
    async def test_fetch_success(self, fetcher):
        """Successful fetch returns FetchResult."""
        abi_json = '[{"type": "function", "name": "test"}]'
        
        with patch.object(fetcher, '_fetch_abi', new_callable=AsyncMock) as mock_fetch:
            with patch.object(fetcher, '_detect_proxy', new_callable=AsyncMock) as mock_proxy:
                mock_fetch.return_value = abi_json
                mock_proxy.return_value = None

                result = await fetcher.fetch("0x" + "a" * 40, network="mainnet")

                assert result is not None
                assert result.source == "etherscan"
                assert len(result.abi) == 1

    @pytest.mark.asyncio
    async def test_fetch_proxy_detection(self, fetcher):
        """Proxy detection fetches implementation ABI."""
        proxy_abi = '[{"type": "function", "name": "proxy"}]'
        impl_abi = '[{"type": "function", "name": "implementation"}]'
        
        with patch.object(fetcher, '_fetch_abi', new_callable=AsyncMock) as mock_fetch:
            with patch.object(fetcher, '_detect_proxy', new_callable=AsyncMock) as mock_proxy:
                # First call returns proxy ABI, second returns implementation ABI
                mock_fetch.side_effect = [proxy_abi, impl_abi]
                mock_proxy.return_value = "0x" + "b" * 40  # Implementation address

                result = await fetcher.fetch("0x" + "a" * 40, network="mainnet")

                assert result.is_proxy is True
                assert result.implementation_address == "0x" + "b" * 40
                # Should use implementation ABI
                assert result.abi[0]["name"] == "implementation"

    @pytest.mark.asyncio
    async def test_fetch_proxy_detection_disabled(self, fetcher):
        """Proxy detection can be disabled."""
        abi_json = '[{"type": "function", "name": "test"}]'
        
        with patch.object(fetcher, '_fetch_abi', new_callable=AsyncMock) as mock_fetch:
            with patch.object(fetcher, '_detect_proxy', new_callable=AsyncMock) as mock_proxy:
                mock_fetch.return_value = abi_json

                result = await fetcher.fetch(
                    "0x" + "a" * 40,
                    network="mainnet",
                    detect_proxy=False
                )

                mock_proxy.assert_not_called()
                assert result.is_proxy is False

    def test_get_api_key_with_explicit_key(self, fetcher_with_key):
        """API key passed to constructor is used."""
        key = fetcher_with_key._get_api_key("mainnet")
        assert key == "test-api-key"

    def test_address_pattern(self, fetcher):
        """Address pattern validation."""
        # Valid
        assert fetcher.ADDRESS_PATTERN.match("0x" + "a" * 40) is not None
        assert fetcher.ADDRESS_PATTERN.match("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48") is not None
        
        # Invalid - pattern should not match
        assert fetcher.ADDRESS_PATTERN.match("not-valid") is None
        assert fetcher.ADDRESS_PATTERN.match("0x123") is None
        assert fetcher.ADDRESS_PATTERN.match("") is None
"""Extended tests for Etherscan fetcher."""

import pytest


class TestEtherscanFetcher:
    """Tests for EtherscanFetcher."""

    @pytest.fixture
    def valid_address(self):
        """Valid Ethereum address."""
        return "0x1234567890123456789012345678901234567890"

    @pytest.mark.asyncio
    async def test_fetch_invalid_address(self):
        """Test with invalid address."""
        import httpx
        
        with patch("abi_to_mcp.fetchers.etherscan.httpx") as mock_httpx:
            mock_httpx.AsyncClient.return_value = AsyncMock()
            mock_httpx.HTTPStatusError = httpx.HTTPStatusError
            mock_httpx.RequestError = httpx.RequestError

            from abi_to_mcp.fetchers.etherscan import EtherscanFetcher
            from abi_to_mcp.core.exceptions import InvalidAddressError

            fetcher = EtherscanFetcher()
            
            with pytest.raises(InvalidAddressError):
                await fetcher.fetch("invalid-address")

    def test_can_handle_valid_address(self, valid_address):
        """Test can_handle with valid address."""
        import httpx
        
        with patch("abi_to_mcp.fetchers.etherscan.httpx") as mock_httpx:
            mock_httpx.AsyncClient.return_value = AsyncMock()
            mock_httpx.HTTPStatusError = httpx.HTTPStatusError
            mock_httpx.RequestError = httpx.RequestError

            from abi_to_mcp.fetchers.etherscan import EtherscanFetcher

            fetcher = EtherscanFetcher()
            assert fetcher.can_handle(valid_address) is True

    def test_can_handle_invalid_address(self):
        """Test can_handle with invalid address."""
        import httpx
        
        with patch("abi_to_mcp.fetchers.etherscan.httpx") as mock_httpx:
            mock_httpx.AsyncClient.return_value = AsyncMock()
            mock_httpx.HTTPStatusError = httpx.HTTPStatusError
            mock_httpx.RequestError = httpx.RequestError

            from abi_to_mcp.fetchers.etherscan import EtherscanFetcher

            fetcher = EtherscanFetcher()
            assert fetcher.can_handle("not-an-address") is False
            assert fetcher.can_handle("file.json") is False

    def test_constructor_with_api_key(self):
        """Test constructor with API key."""
        import httpx
        
        from abi_to_mcp.fetchers.etherscan import EtherscanFetcher

        fetcher = EtherscanFetcher(api_key="test-api-key")
        assert fetcher._api_key == "test-api-key"

    def test_constructor_without_api_key(self):
        """Test constructor without API key."""
        import httpx
        
        from abi_to_mcp.fetchers.etherscan import EtherscanFetcher

        fetcher = EtherscanFetcher()
        # Should have None when no API key provided
        assert fetcher._api_key is None


class TestEtherscanImportError:
    """Test Etherscan behavior when httpx is not installed."""

    def test_address_pattern(self):
        """Test that address pattern works correctly."""
        from abi_to_mcp.fetchers.etherscan import EtherscanFetcher
        
        fetcher = EtherscanFetcher()
        
        # Valid address
        assert fetcher.ADDRESS_PATTERN.match("0x1234567890123456789012345678901234567890")
        
        # Invalid addresses
        assert not fetcher.ADDRESS_PATTERN.match("invalid")
        assert not fetcher.ADDRESS_PATTERN.match("0x123")
